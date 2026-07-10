import Phaser from 'phaser';
import { defaultReward, surpriseReward } from './rules';
import type { GameBridgeEvents, Quality, RewardHit } from './types';

type PlatformData = { index: number; x: number; y: number; width: number; top: Phaser.GameObjects.Rectangle; face: Phaser.GameObjects.Polygon; label?: Phaser.GameObjects.Text };

export class GameScene extends Phaser.Scene {
  private bridge: GameBridgeEvents;
  private seed: number;
  private practice: boolean;
  private quality: Quality;
  private reducedMotion: boolean;
  private adaptiveQuality: boolean;
  private frameSampleMs = 0;
  private frameSampleCount = 0;
  private hero!: Phaser.GameObjects.Container;
  private body!: Phaser.GameObjects.Rectangle;
  private shadow!: Phaser.GameObjects.Ellipse;
  private platforms: PlatformData[] = [];
  private current = 0;
  private charge = 0;
  private charging = false;
  private jumping = false;
  private stable = true;
  private jumpStart = 0;
  private from = { x: 0, y: 0 };
  private to = { x: 0, y: 0 };
  private rewards: RewardHit[] = [];
  private gateAt = 100;
  private particles: Phaser.GameObjects.Rectangle[] = [];
  private chargeBar!: Phaser.GameObjects.Rectangle;
  private chargeGlow!: Phaser.GameObjects.Rectangle;
  private hint!: Phaser.GameObjects.Text;

  constructor(bridge: GameBridgeEvents, seed: number, practice: boolean, quality: Quality, reducedMotion = false, adaptiveQuality = false) {
    super('game');
    this.bridge = bridge;
    this.seed = seed;
    this.practice = practice;
    this.quality = quality;
    this.reducedMotion = reducedMotion;
    this.adaptiveQuality = adaptiveQuality;
  }

  create() {
    this.cameras.main.setBackgroundColor('#181b3d');
    this.createSky();
    for (let i = 0; i <= 110; i++) this.createPlatform(i);
    const start = this.platforms[0];
    this.shadow = this.add.ellipse(start.x, start.y - 2, 34, 10, 0x11152f, 0.28).setDepth(8);
    this.hero = this.createHero(start.x, start.y - 31);
    this.createHud();
    this.cameras.main.startFollow(this.hero, true, 0.08, 0, -110, 0);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('gameout', this.onUp, this);
    this.emitSnapshot();
  }

  private createSky() {
    const colors = [0x202655, 0x293064, 0x333a70];
    for (let i = 0; i < 12; i++) {
      this.add.rectangle(i * 420, 330, 420, 760, colors[i % colors.length]).setScrollFactor(0.14).setDepth(-20);
      this.add.rectangle(i * 420 + 80, 145 + (i % 3) * 74, 5, 5, 0xfff1a6, 0.65).setScrollFactor(0.07).setDepth(-18);
      this.add.rectangle(i * 420 + 220, 90 + (i % 2) * 120, 3, 3, 0xffffff, 0.48).setScrollFactor(0.09).setDepth(-18);
    }
    for (let i = 0; i < 25; i++) {
      const x = i * 190 + (i % 4) * 31;
      this.add.rectangle(x, 648, 150, 170 + (i % 4) * 28, 0x11152f, 0.5).setOrigin(0.5, 1).setScrollFactor(0.45).setDepth(-10);
      for (let w = 0; w < 4; w++) this.add.rectangle(x - 48 + w * 30, 540 - (i % 4) * 20, 5, 8, 0xffd85c, 0.38).setScrollFactor(0.45).setDepth(-9);
    }
  }

  private random(index: number, salt: number) {
    const x = Math.sin(this.seed * 0.001 + index * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  private createPlatform(index: number) {
    const previous = this.platforms[index - 1];
    const width = index === 0 ? 112 : Math.round(72 + this.random(index, 1) * 42);
    const gap = index === 0 ? 0 : Math.round(55 + Math.min(index, 180) * 0.08 + this.random(index, 2) * 38);
    const x = index === 0 ? 150 : previous.x + previous.width / 2 + gap + width / 2;
    const y = 545 + Math.round((this.random(index, 3) - 0.5) * 32);
    const checkpoint = index > 0 && index % 10 === 0;
    const skyPalettes = [
      { top: 0x66d9c2, face: 0x338c87, edge: 0xb4fff0 },
      { top: 0x71b9f4, face: 0x3c72b0, edge: 0xc5e8ff },
      { top: 0xff8fba, face: 0xb94f80, edge: 0xffd1e3 },
      { top: 0xffad68, face: 0xbd663f, edge: 0xffddad },
      { top: 0xa88cf2, face: 0x6953b8, edge: 0xded2ff },
      { top: 0x92d36e, face: 0x548a4c, edge: 0xd8ffc3 },
    ];
    const dreamPalettes = [
      { top: 0x8c7cf7, face: 0x5945bd, edge: 0xd8d1ff },
      { top: 0xe778d5, face: 0x9b438f, edge: 0xffcef7 },
      { top: 0x55d6ed, face: 0x2d829f, edge: 0xc6f7ff },
      { top: 0xff7597, face: 0xb34268, edge: 0xffccdb },
    ];
    const palettes = index > 100 ? dreamPalettes : skyPalettes;
    const palette = palettes[Math.floor(this.random(index, 7) * palettes.length) % palettes.length];
    const topColor = checkpoint ? 0xffd45e : palette.top;
    const faceColor = checkpoint ? 0xc6823e : palette.face;
    const edgeColor = checkpoint ? 0xffeea5 : palette.edge;
    const face = this.add.polygon(x, y + 14, [0, 0, width / 2, 18, width / 2, 44, 0, 27, -width / 2, 44, -width / 2, 18], faceColor).setDepth(2);
    const top = this.add.rectangle(x, y, width, 31, topColor).setStrokeStyle(3, edgeColor).setDepth(3);
    this.add.rectangle(x - width / 2 + 5, y + 20, 6, 23, 0xffffff, 0.11).setDepth(4);
    const platform: PlatformData = { index, x, y, width, top, face };
    if (checkpoint) {
      platform.label = this.add.text(x, y - 2, index > 100 ? '?' : `$${(index / 100).toFixed(2)}`, {
        fontFamily: 'monospace', fontSize: '13px', color: '#4f3518', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(5);
    }
    this.platforms.push(platform);
  }

  private createHero(x: number, y: number) {
    const hero = this.add.container(x, y).setDepth(12);
    this.body = this.add.rectangle(0, 3, 28, 38, 0xff7eb6).setStrokeStyle(3, 0x5f315b);
    const face = this.add.rectangle(0, -9, 20, 17, 0xffb0d1);
    const eye1 = this.add.rectangle(-5, -11, 3, 4, 0x382a4d);
    const eye2 = this.add.rectangle(5, -11, 3, 4, 0x382a4d);
    const foot1 = this.add.rectangle(-8, 23, 10, 6, 0x5f315b);
    const foot2 = this.add.rectangle(8, 23, 10, 6, 0x5f315b);
    hero.add([this.body, face, eye1, eye2, foot1, foot2]);
    return hero;
  }

  private createHud() {
    this.chargeGlow = this.add.rectangle(210, 697, 276, 18, 0x25294f, 0.88).setScrollFactor(0).setDepth(30).setStrokeStyle(2, 0x6b7199);
    this.chargeBar = this.add.rectangle(74, 697, 0, 12, 0x69e3c6).setOrigin(0, 0.5).setScrollFactor(0).setDepth(31);
    this.hint = this.add.text(210, 660, this.practice ? '练习：按住蓄力，松开起跳' : '按住任意空白处蓄力', {
      fontFamily: 'monospace', fontSize: '14px', color: '#eef4ff', backgroundColor: '#171a37cc', padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    if (!this.stable || this.jumping || pointer.y < 105 || pointer.y > 735) return;
    this.charging = true;
    this.charge = 0;
    this.tweens.add({ targets: this.hero, scaleY: 0.7, scaleX: 1.14, y: this.hero.y + 8, duration: 170 });
  }

  private onUp() {
    if (!this.charging || !this.stable) return;
    this.charging = false;
    this.jump();
  }

  private jump() {
    this.stable = false;
    this.jumping = true;
    this.jumpStart = this.time.now;
    this.from = { x: this.hero.x, y: this.hero.y };
    const distance = 64 + this.charge * 192;
    this.to = { x: this.from.x + distance, y: this.from.y };
    this.hero.setScale(1);
    this.hint.setVisible(false);
    this.emitSnapshot();
  }

  update(_time: number, delta: number) {
    if (this.adaptiveQuality) {
      this.frameSampleMs += delta;
      this.frameSampleCount += 1;
      if (this.frameSampleCount >= 120) {
        const fps = this.frameSampleCount / (this.frameSampleMs / 1000);
        if (fps < 42 && this.quality === 'high') this.quality = 'balanced';
        else if (fps < 34 && this.quality === 'balanced') this.quality = 'smooth';
        this.frameSampleMs = 0;
        this.frameSampleCount = 0;
      }
    }
    if (this.charging) {
      this.charge = Math.min(1, this.charge + delta / 1550);
      this.chargeBar.width = 272 * this.charge;
      this.chargeBar.fillColor = this.charge > 0.78 ? 0xffd45e : 0x69e3c6;
    }
    if (!this.jumping) return;
    const duration = 620 + this.charge * 210;
    const t = Math.min(1, (this.time.now - this.jumpStart) / duration);
    this.hero.x = Phaser.Math.Linear(this.from.x, this.to.x, t);
    this.hero.y = this.from.y - Math.sin(t * Math.PI) * (92 + this.charge * 55);
    this.hero.angle = Math.sin(t * Math.PI) * 10;
    this.shadow.x = this.hero.x;
    this.shadow.scaleX = 1 - Math.sin(t * Math.PI) * 0.45;
    this.shadow.alpha = 0.28 - Math.sin(t * Math.PI) * 0.18;
    if (t >= 1) this.resolveLanding();
  }

  private resolveLanding() {
    this.jumping = false;
    this.hero.angle = 0;
    const target = this.platforms[this.current + 1];
    const heroCenter = this.hero.x;
    const left = target.x - target.width / 2;
    const right = target.x + target.width / 2;
    const overlap = Math.min(heroCenter + 12, right) - Math.max(heroCenter - 12, left);
    const centerInside = heroCenter > left && heroCenter < right;
    const edgeDepth = Math.min(heroCenter - left, right - heroCenter);
    if (overlap > 0 && centerInside && edgeDepth >= 6) {
      this.current += 1;
      this.hero.setPosition(heroCenter, target.y - 31);
      this.shadow.setPosition(heroCenter, target.y - 2).setScale(1).setAlpha(0.28);
      this.stable = true;
      this.charge = 0;
      this.chargeBar.width = 0;
      this.landBurst(edgeDepth < 13);
      const reward = this.practice ? null : (defaultReward(this.current) ?? surpriseReward(this.current, this.seed));
      if (reward) {
        this.rewards.push(reward);
        this.bridge.onReward(reward);
      }
      this.emitSnapshot();
      if (this.current >= this.gateAt) {
        this.stable = false;
        this.bridge.onExtensionGate(this.current);
      } else {
        this.hint.setText(edgeDepth < 13 ? '惊险站稳！继续保持' : this.current % 10 === 0 ? '奖励已锁定 ✦' : '漂亮！继续向前').setVisible(true);
        this.time.delayedCall(900, () => this.hint.setVisible(false));
      }
    } else {
      this.fall(heroCenter < target.x ? -1 : 1);
    }
  }

  private landBurst(edge: boolean) {
    const count = this.reducedMotion ? 0 : this.quality === 'smooth' ? 4 : this.quality === 'high' ? 14 : 8;
    for (let i = 0; i < count; i++) {
      const p = this.add.rectangle(this.hero.x, this.hero.y + 20, 5, 5, edge ? 0xffd45e : 0x9fffe9).setDepth(14);
      this.particles.push(p);
      this.tweens.add({ targets: p, x: p.x + Phaser.Math.Between(-34, 34), y: p.y + Phaser.Math.Between(-35, -8), alpha: 0, duration: 430, onComplete: () => p.destroy() });
    }
    this.tweens.add({ targets: this.hero, scaleY: 0.78, scaleX: 1.12, duration: 80, yoyo: true });
  }

  private fall(direction: number) {
    this.stable = false;
    this.emitSnapshot();
    type FallingContainer = Phaser.GameObjects.GameObject & {
      setVelocity(x: number, y: number): FallingContainer;
      setAngularVelocity(value: number): FallingContainer;
    };
    const fallingHero = this.matter.add.gameObject(this.hero, {
      shape: { type: 'rectangle', width: 28, height: 44 },
      frictionAir: 0.012,
      restitution: 0.18,
    }) as FallingContainer;
    fallingHero.setVelocity(direction * 4.2, -1.8).setAngularVelocity(direction * 0.16);
    this.tweens.add({ targets: this.hero, alpha: 0.2, duration: 900, ease: 'Quad.easeIn' });
    this.time.delayedCall(920, () => this.bridge.onFell(this.current));
  }

  extend(blocks: number) {
    this.gateAt = this.current + blocks;
    while (this.platforms.length <= this.gateAt + 10) this.createPlatform(this.platforms.length);
    this.stable = true;
    this.hint.setText(`惊喜旅程 +${blocks} 格`).setVisible(true);
    this.time.delayedCall(1000, () => this.hint.setVisible(false));
    this.emitSnapshot();
  }

  getSnapshot() { return { block: this.current, rewards: [...this.rewards], stable: this.stable, extending: this.current > 100 }; }

  setQuality(quality: Quality, adaptive = false) { this.quality = quality; this.adaptiveQuality = adaptive; }
  setReducedMotion(enabled: boolean) { this.reducedMotion = enabled; }

  private emitSnapshot() { this.bridge.onSnapshot(this.getSnapshot()); }
}
