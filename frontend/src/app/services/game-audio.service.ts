import { Injectable } from '@angular/core';

type Sfx = 'countdown' | 'go' | 'pearl' | 'mega' | 'speed' | 'teleport' | 'decoy' | 'nearmiss' | 'checkpoint' | 'hit' | 'win' | 'boss' | 'swim';

@Injectable({ providedIn: 'root' })
export class GameAudioService {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private swimOsc: OscillatorNode | null = null;
  private swimGain: GainNode | null = null;
  private swimTimer = 0;

  private ensureCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopSwim();
  }

  play(sfx: Sfx): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const tones: Record<Sfx, { f: number; d: number; type: OscillatorType; vol: number }> = {
      countdown: { f: 440, d: 0.12, type: 'sine', vol: 0.08 },
      go: { f: 660, d: 0.25, type: 'triangle', vol: 0.12 },
      pearl: { f: 880, d: 0.18, type: 'sine', vol: 0.1 },
      mega: { f: 1046, d: 0.35, type: 'sine', vol: 0.12 },
      speed: { f: 520, d: 0.2, type: 'sawtooth', vol: 0.06 },
      teleport: { f: 330, d: 0.3, type: 'triangle', vol: 0.1 },
      decoy: { f: 280, d: 0.22, type: 'square', vol: 0.05 },
      nearmiss: { f: 740, d: 0.08, type: 'sine', vol: 0.07 },
      checkpoint: { f: 523, d: 0.28, type: 'triangle', vol: 0.1 },
      hit: { f: 110, d: 0.45, type: 'sawtooth', vol: 0.14 },
      win: { f: 784, d: 0.5, type: 'sine', vol: 0.12 },
      boss: { f: 165, d: 0.6, type: 'square', vol: 0.08 },
      swim: { f: 200, d: 0.05, type: 'sine', vol: 0.02 },
    };

    const t = tones[sfx];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type;
    osc.frequency.setValueAtTime(t.f, now);
    if (sfx === 'win') {
      osc.frequency.exponentialRampToValueAtTime(1200, now + t.d);
    }
    gain.gain.setValueAtTime(t.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + t.d);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + t.d + 0.05);
  }

  tickSwim(moving: boolean, dt: number): void {
    if (!moving) {
      this.swimTimer = 0;
      this.stopSwim();
      return;
    }
    this.swimTimer += dt;
    if (this.swimTimer > 0.35) {
      this.swimTimer = 0;
      this.play('swim');
    }
  }

  private stopSwim(): void {
    if (this.swimOsc) {
      try {
        this.swimOsc.stop();
      } catch {
        /* already stopped */
      }
      this.swimOsc.disconnect();
      this.swimOsc = null;
    }
    if (this.swimGain) {
      this.swimGain.disconnect();
      this.swimGain = null;
    }
  }
}
