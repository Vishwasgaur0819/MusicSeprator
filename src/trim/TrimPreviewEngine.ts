import {
  AudioBufferSourceNode,
  AudioContext,
} from 'react-native-audio-api';
import {CHANNELS, SAMPLE_RATE} from '../constants/audio';

export type TrimPreviewSnapshot = {
  playheadSec: number;
  isPlaying: boolean;
  regionStartSec: number;
  regionEndSec: number;
  durationSec: number;
};

type AudioBuffer = Awaited<ReturnType<AudioContext['decodeAudioData']>>;

export class TrimPreviewEngine {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(snapshot: TrimPreviewSnapshot) => void>();
  private regionStartSec = 0;
  private regionEndSec = 0;
  private playheadSec = 0;
  private playOffsetSec = 0;
  private startedAtContextTime = 0;
  private isPlaying = false;

  subscribe(listener: (snapshot: TrimPreviewSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  loadFromBuffer(buffer: AudioBuffer): void {
    this.stopSource();
    this.isPlaying = false;

    if (!this.context) {
      this.context = new AudioContext();
    }

    this.buffer = buffer;
    this.regionStartSec = 0;
    this.regionEndSec = buffer.duration;
    this.playheadSec = 0;
    this.emit();
  }

  loadFromPcm(pcm: Float32Array): void {
    if (!this.context) {
      this.context = new AudioContext();
    }

    const frames = Math.floor(pcm.length / CHANNELS);
    const buffer = this.context.createBuffer(CHANNELS, frames, SAMPLE_RATE);

    for (let ch = 0; ch < CHANNELS; ch++) {
      const channel = buffer.getChannelData(ch);
      for (let i = 0; i < frames; i++) {
        channel[i] = pcm[i * CHANNELS + ch];
      }
    }

    this.loadFromBuffer(buffer);
  }

  setRegion(
    startSec: number,
    endSec: number,
    options?: {pauseOnChange?: boolean},
  ): void {
    const duration = this.getDuration();
    const nextStart = Math.max(0, Math.min(startSec, duration));
    const nextEnd = Math.max(nextStart, Math.min(endSec, duration));

    this.regionStartSec = nextStart;
    this.regionEndSec = nextEnd;

    if (this.playheadSec < nextStart || this.playheadSec > nextEnd) {
      this.playheadSec = nextStart;
    }

    if (options?.pauseOnChange !== false && this.isPlaying) {
      this.pause();
    }

    this.emit();
  }

  setPlayhead(sec: number, resumeIfPlaying = false): void {
    const duration = this.getDuration();
    this.playheadSec = Math.max(0, Math.min(sec, duration));

    if (resumeIfPlaying && this.isPlaying) {
      void this.startPlayback();
      return;
    }

    this.emit();
  }

  getSnapshot(): TrimPreviewSnapshot {
    return {
      playheadSec: this.isPlaying ? this.getCurrentAbsoluteTime() : this.playheadSec,
      isPlaying: this.isPlaying,
      regionStartSec: this.regionStartSec,
      regionEndSec: this.regionEndSec,
      durationSec: this.getDuration(),
    };
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  async togglePlayback(): Promise<boolean> {
    if (this.isPlaying) {
      this.pause();
      return false;
    }
    return this.startPlayback();
  }

  restartPreview(): void {
    this.playheadSec = this.regionStartSec;
    if (this.isPlaying) {
      void this.startPlayback();
    } else {
      this.emit();
    }
  }

  pause(): void {
    if (!this.isPlaying) {
      return;
    }

    this.playheadSec = this.getCurrentAbsoluteTime();
    this.stopSource();
    this.isPlaying = false;
    this.emit();
  }

  async startPlayback(): Promise<boolean> {
    if (!this.context || !this.buffer) {
      return false;
    }

    await this.ensureContextRunning();

    let fromSec = this.playheadSec;
    if (fromSec >= this.regionEndSec - 0.05) {
      fromSec = this.regionStartSec;
    }
    fromSec = Math.max(fromSec, this.regionStartSec);
    fromSec = Math.min(fromSec, this.getDuration() - 0.01);

    const remaining = this.regionEndSec - fromSec;
    if (remaining <= 0.05) {
      return false;
    }

    this.stopSource();
    this.playOffsetSec = fromSec;
    this.playheadSec = fromSec;
    this.startedAtContextTime = this.context.currentTime;
    this.isPlaying = true;

    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.context.destination);
    this.source.onEnded = () => {
      this.handlePlaybackEnded();
    };

    try {
      // Play to buffer end; progress loop stops at regionEndSec. Avoids native
      // duration-arg bugs and matches StemPlayer's two-arg start pattern.
      this.source.start(0, fromSec);
    } catch {
      this.isPlaying = false;
      this.emit();
      return false;
    }

    this.startProgressLoop();
    this.emit();
    return true;
  }

  async destroy(): Promise<void> {
    this.stopSource();
    this.isPlaying = false;
    this.listeners.clear();
    if (this.context) {
      await this.context.close();
    }
    this.context = null;
    this.buffer = null;
  }

  private async ensureContextRunning(): Promise<void> {
    if (!this.context) {
      return;
    }

    try {
      if (this.context.state === 'suspended') {
        await this.context.resume();
        return;
      }
    } catch {
      // try generic resume below
    }

    try {
      await this.context.resume();
    } catch {
      // already running
    }
  }

  private getCurrentAbsoluteTime(): number {
    if (!this.context || !this.isPlaying) {
      return this.playheadSec;
    }

    const elapsed = this.context.currentTime - this.startedAtContextTime;
    return Math.min(this.regionEndSec, this.playOffsetSec + elapsed);
  }

  private startProgressLoop(): void {
    this.stopProgressLoop();
    this.progressTimer = setInterval(() => {
      if (!this.isPlaying) {
        return;
      }

      this.playheadSec = this.getCurrentAbsoluteTime();
      this.emit();

      if (this.playheadSec >= this.regionEndSec - 0.05) {
        this.handlePlaybackEnded();
      }
    }, 100);
  }

  private handlePlaybackEnded(): void {
    this.playheadSec = this.regionStartSec;
    this.stopSource();
    this.isPlaying = false;
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private stopSource(): void {
    this.stopProgressLoop();
    const source = this.source;
    this.source = null;
    if (!source) {
      return;
    }

    // stop() fires onEnded; detach first so pause/restart does not look like
    // natural playback completion.
    source.onEnded = null;
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }

  private stopProgressLoop(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
}
