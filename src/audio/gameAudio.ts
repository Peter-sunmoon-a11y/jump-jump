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
}

export const gameAudio = new GameAudio();
