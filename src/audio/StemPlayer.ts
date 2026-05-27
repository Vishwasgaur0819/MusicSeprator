import {
  AudioContext,
  AudioBufferSourceNode,
  GainNode,
} from 'react-native-audio-api';
import {
  getEffectiveVocalGain,
} from './stemMix';

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

const GAIN_AUDIBLE = 0.001;

export class StemPlayer {
  private context: AudioContext | null = null;
  private vocalsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private vocalsSource: AudioBufferSourceNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private vocalsBuffer: Awaited<
    ReturnType<AudioContext['decodeAudioData']>
  > | null = null;
  private musicBuffer: Awaited<
    ReturnType<AudioContext['decodeAudioData']>
  > | null = null;
  private vocalGainValue = 1;
  private musicGainValue = 1;
  private startedAt = 0;
  private pausedAt = 0;
  private isPlaying = false;
  private isPaused = false;

  async load(vocalsPath: string, instrumentalPath: string): Promise<void> {
    await this.stop();
    this.context = new AudioContext();
    this.vocalsGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.vocalsGain.connect(this.context.destination);
    this.musicGain.connect(this.context.destination);

    this.vocalsBuffer = await this.context.decodeAudioData(
      toFileUri(vocalsPath),
    );
    this.musicBuffer = await this.context.decodeAudioData(
      toFileUri(instrumentalPath),
    );

    this.applyGains();
  }

  setVocalGain(value: number): void {
    this.vocalGainValue = value;
    this.applyGains();
    this.restartIfPlaying();
  }

  setMusicGain(value: number): void {
    this.musicGainValue = value;
    this.applyGains();
    this.restartIfPlaying();
  }

  private applyGains(): void {
    if (!this.vocalsGain || !this.musicGain) {
      return;
    }
    this.vocalsGain.gain.value = getEffectiveVocalGain(this.vocalGainValue);
    this.musicGain.gain.value = this.musicGainValue;
  }

  private restartIfPlaying(): void {
    if (!this.isPlaying) {
      return;
    }
    const position = this.getCurrentTime();
    this.stopSources();
    this.isPlaying = false;
    this.isPaused = true;
    this.pausedAt = position;
    this.play();
  }

  play(): void {
    if (!this.context || !this.vocalsBuffer || !this.musicBuffer) {
      return;
    }

    this.stopSources();
    this.applyGains();

    const offset = this.isPaused ? this.pausedAt : 0;
    const effectiveVocalGain = getEffectiveVocalGain(this.vocalGainValue);
    const playVocals = Math.abs(effectiveVocalGain) > GAIN_AUDIBLE;
    const playMusic = this.musicGainValue > GAIN_AUDIBLE;

    if (playVocals) {
      this.vocalsSource = this.context.createBufferSource();
      this.vocalsSource.buffer = this.vocalsBuffer;
      this.vocalsSource.connect(this.vocalsGain!);
      this.vocalsSource.start(0, offset);
    }

    if (playMusic) {
      this.musicSource = this.context.createBufferSource();
      this.musicSource.buffer = this.musicBuffer;
      this.musicSource.connect(this.musicGain!);
      this.musicSource.start(0, offset);
    }

    if (!playVocals && !playMusic) {
      return;
    }

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

  async stop(): Promise<void> {
    this.stopSources();
    if (this.context) {
      await this.context.close();
    }
    this.context = null;
    this.vocalsGain = null;
    this.musicGain = null;
    this.vocalsBuffer = null;
    this.musicBuffer = null;
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
    return this.vocalsBuffer?.duration ?? this.musicBuffer?.duration ?? 0;
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
