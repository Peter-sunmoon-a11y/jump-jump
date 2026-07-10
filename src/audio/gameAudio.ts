type SoundName = 'start' | 'land' | 'reward' | 'fall' | 'settle' | 'upgrade';

const patterns: Record<SoundName, Array<[number, number, number]>> = {
  start: [[392, 0, 0.08], [523, 0.08, 0.12]],
  land: [[330, 0, 0.06]],
  reward: [[523, 0, 0.08], [659, 0.08, 0.08], [784, 0.16, 0.14]],
  fall: [[260, 0, 0.1], [190, 0.08, 0.18]],
  settle: [[392, 0, 0.08], [523, 0.09, 0.08], [659, 0.18, 0.16]],
  upgrade: [[523, 0, 0.08], [659, 0.07, 0.08], [784, 0.14, 0.08], [1046, 0.22, 0.2]],
};

class GameAudio {
  private context: AudioContext | null = null;
  private chargeOscillator: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;

  play(name: SoundName, enabled = true) {
    if (!enabled || typeof AudioContext === 'undefined') return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    const now = this.context.currentTime;
    for (const [frequency, offset, duration] of patterns[name]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = name === 'fall' ? 'square' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.055, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.02);
    }
  }

  startCharge(enabled = true) {
    if (!enabled || typeof AudioContext === 'undefined' || this.chargeOscillator) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(105, now);
    oscillator.frequency.exponentialRampToValueAtTime(430, now + 1.8);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.025, now + 0.08);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start();
    this.chargeOscillator = oscillator;
    this.chargeGain = gain;
  }

  stopCharge() {
    if (!this.context || !this.chargeOscillator || !this.chargeGain) return;
    const now = this.context.currentTime;
    this.chargeGain.gain.cancelScheduledValues(now);
    this.chargeGain.gain.setValueAtTime(Math.max(0.0001, this.chargeGain.gain.value), now);
    this.chargeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    this.chargeOscillator.stop(now + 0.045);
    this.chargeOscillator = null;
    this.chargeGain = null;
  }
}

export const gameAudio = new GameAudio();
