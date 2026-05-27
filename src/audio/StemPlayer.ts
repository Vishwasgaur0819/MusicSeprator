import {
  AudioContext,
  AudioBufferSourceNode,
  GainNode,
} from 'react-native-audio-api';
import {getMusicGain, getVocalNetGain} from './stemMix';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Live-reconstruction player.
 *
 *   output = musicGain * mix + (vocalGain - musicGain) * vocals
 *
 * Both `mix` and `vocals` sources are always started in sync. The vocal
 * `GainNode` carries the signed net gain (`vocalGain - musicGain`), so when the
 * user picks Music Only (vocalGain=0, musicGain=1), the vocal bus is driven at
 * gain -1 and phase-cancels the singer out of `mix` instead of relying on a
 * pre-rendered instrumental file with baked-in phase-inverted residue.
 */
export class StemPlayer {
  private context: AudioContext | null = null;
  private vocalsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private vocalsSource: AudioBufferSourceNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private vocalsBuffer: Awaited<
    ReturnType<AudioContext['decodeAudioData']>
  > | null = null;
  private mixBuffer: Awaited<
    ReturnType<AudioContext['decodeAudioData']>
  > | null = null;
  private vocalGainValue = 1;
  private musicGainValue = 1;
  private startedAt = 0;
  private pausedAt = 0;
  private isPlaying = false;
  private isPaused = false;

  async load(mixPath: string, vocalsPath: string): Promise<void> {
    await this.stop();
    this.context = new AudioContext();
    this.vocalsGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.vocalsGain.connect(this.context.destination);
    this.musicGain.connect(this.context.destination);

    this.mixBuffer = await this.context.decodeAudioData(toFileUri(mixPath));
    this.vocalsBuffer = await this.context.decodeAudioData(
      toFileUri(vocalsPath),
    );

    this.applyGains();
  }

  setVocalGain(value: number): void {
    this.vocalGainValue = value;
    this.applyGains();
  }

  setMusicGain(value: number): void {
    this.musicGainValue = value;
    this.applyGains();
  }

  private applyGains(): void {
    if (!this.vocalsGain || !this.musicGain) {
      return;
    }
    this.musicGain.gain.value = getMusicGain(
      this.vocalGainValue,
      this.musicGainValue,
    );
    this.vocalsGain.gain.value = getVocalNetGain(
      this.vocalGainValue,
      this.musicGainValue,
    );
  }

  play(): void {
    if (!this.context || !this.mixBuffer || !this.vocalsBuffer) {
      return;
    }

    this.stopSources();
    this.applyGains();

    const offset = this.isPaused ? this.pausedAt : 0;

    this.musicSource = this.context.createBufferSource();
    this.musicSource.buffer = this.mixBuffer;
    this.musicSource.connect(this.musicGain!);
    this.musicSource.start(0, offset);

    this.vocalsSource = this.context.createBufferSource();
    this.vocalsSource.buffer = this.vocalsBuffer;
    this.vocalsSource.connect(this.vocalsGain!);
    this.vocalsSource.start(0, offset);

    this.startedAt = this.context.currentTime - offset;
    this.isPlaying = true;
    this.isPaused = false;
  }

  pause(): void {
    if (!this.context || !this.isPlaying) {
      return;
    }
    this.pausedAt = this.context.currentTime - this.startedAt;
    this.stopSources();
    this.isPlaying = false;
    this.isPaused = true;
  }

  /**
   * Reset playback to the start without tearing down the audio context.
   * Use this when the user hits "restart" or when the song reaches its end —
   * keeps decoded buffers and `GainNode`s alive so the next `play()` is instant.
   */
  rewindToStart(): void {
    this.stopSources();
    this.pausedAt = 0;
    this.isPaused = false;
    this.isPlaying = false;
    this.startedAt = 0;
  }

  /** Rewind and immediately start playing from the beginning. */
  restart(): void {
    if (!this.context || !this.mixBuffer || !this.vocalsBuffer) {
      return;
    }
    this.rewindToStart();
    this.play();
  }

  async stop(): Promise<void> {
    this.stopSources();
    if (this.context) {
      await this.context.close();
    }
    this.context = null;
    this.vocalsGain = null;
    this.musicGain = null;
    this.vocalsBuffer = null;
    this.mixBuffer = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAt = 0;
    this.startedAt = 0;
  }

  getCurrentTime(): number {
    if (!this.context) {
      return 0;
    }
    if (this.isPaused) {
      return this.pausedAt;
    }
    if (this.isPlaying) {
      return this.context.currentTime - this.startedAt;
    }
    return 0;
  }

  getDuration(): number {
    return this.mixBuffer?.duration ?? this.vocalsBuffer?.duration ?? 0;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  private stopSources(): void {
    try {
      this.vocalsSource?.stop();
      this.musicSource?.stop();
    } catch {
      // already stopped
    }
    this.vocalsSource = null;
    this.musicSource = null;
  }
}

export const stemPlayer = new StemPlayer();
