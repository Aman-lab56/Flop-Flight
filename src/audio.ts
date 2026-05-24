/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer for 8-bit retro gaming sounds
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
        }
      } catch (e) {
        console.warn('Web Audio API not supported in this browser.', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (enabled) {
      this.initContext();
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public playJump() {
    this.initContext();
    if (!this.soundEnabled || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    // Classic short slide up
    const startTime = this.ctx.currentTime;
    osc.frequency.setValueAtTime(350, startTime);
    osc.frequency.exponentialRampToValueAtTime(750, startTime + 0.12);

    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.15);
  }

  public playPoint() {
    this.initContext();
    if (!this.soundEnabled || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startTime = this.ctx.currentTime;
    
    // Classic arcade ding (two-tone Arpeggio)
    osc.frequency.setValueAtTime(587.33, startTime); // D5
    osc.frequency.setValueAtTime(880.00, startTime + 0.08); // A5

    gain.gain.setValueAtTime(0.08, startTime);
    gain.gain.setValueAtTime(0.08, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.25);
  }

  public playHit() {
    this.initContext();
    if (!this.soundEnabled || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    const startTime = this.ctx.currentTime;
    // Rapid downwards pitch slide with distortion feel
    osc.frequency.setValueAtTime(180, startTime);
    osc.frequency.linearRampToValueAtTime(40, startTime + 0.2);

    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.25);
  }

  public playScoreMilestone() {
    this.initContext();
    if (!this.soundEnabled || !this.ctx) return;

    const startTime = this.ctx.currentTime;
    // Multiple notes creating a mini fanfare
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);
      gain.gain.setValueAtTime(0.06, startTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.1 + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime + idx * 0.1);
      osc.stop(startTime + idx * 0.1 + 0.2);
    });
  }

  public playFall() {
    this.initContext();
    if (!this.soundEnabled || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startTime = this.ctx.currentTime;
    osc.frequency.setValueAtTime(250, startTime);
    osc.frequency.exponentialRampToValueAtTime(60, startTime + 0.4);

    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.linearRampToValueAtTime(0.01, startTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + 0.4);
  }
}

export const sfx = new SoundSynthesizer();
