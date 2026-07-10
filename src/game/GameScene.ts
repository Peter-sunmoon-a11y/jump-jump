import Phaser from 'phaser';
import { defaultReward, practiceReward, surpriseReward } from './rules';
import type { GameBridgeEvents, Quality, RewardHit } from './types';

type PlatformData = { index: number; x: number; y: number; width: number; top: Phaser.GameObjects.Shape; face: Phaser.GameObjects.Shape; label?: Phaser.GameObjects.Text };

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
    for (let i = 0; i <= 24; i++) this.createPlatform(i);
    const start = this.platforms[0];
    this.shadow = this.add.ellipse(start.x, start.y - 2, 20, 6, 0x11152f, 0.28).setDepth(8);
    this.hero = this.createHero(start.x, start.y - 19);
    this.createHud();
    this.cameras.main.startFollow(this.hero, true, 0.08, 0, -140, 0);
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
    const width = index === 0 ? 82 : Math.round(52 + this.random(index, 1) * 30);
    const gap = index === 0 ? 0 : Math.round(28 + Math.min(index, 180) * 0.06 + this.random(index, 2) * 20);
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
    const shapeKind = checkpoint ? 4 : Math.floor(this.random(index, 11) * 4);
    const half = width / 2;
    const topHalf = 15;
    const depthBoost = Math.round(this.random(index, 13) * 20);
    const facePointsByKind = [
      [0, 0, half, 16, half, 48 + depthBoost, half * 0.48, 42 + depthBoost, 0, 61 + depthBoost, -half * 0.48, 42 + depthBoost, -half, 48 + depthBoost, -half, 16],
      [0, 0, half, 16, half - 8, 45 + depthBoost, 15, 38 + depthBoost, 6, 68 + depthBoost, 0, 82 + depthBoost, -6, 68 + depthBoost, -15, 38 + depthBoost, -half + 8, 45 + depthBoost, -half, 16],
      [0, 0, half, 16, half - 7, 31, half, 43, half - 15, 43, half - 15, 57 + depthBoost, 18, 57 + depthBoost, 18, 70 + depthBoost, 0, 88 + depthBoost, -18, 70 + depthBoost, -18, 57 + depthBoost, -half + 15, 57 + depthBoost, -half + 15, 43, -half, 43, -half + 7, 31, -half, 16],
      [0, 0, half, 16, half - 5, 39, 22, 34, 15, 58 + depthBoost, 8, 49 + depthBoost, 0, 94 + depthBoost, -8, 49 + depthBoost, -15, 58 + depthBoost, -22, 34, -half + 5, 39, -half, 16],
      [0, 0, half, 16, half - 4, 51 + depthBoost, 19, 43 + depthBoost, 10, 65 + depthBoost, 0, 78 + depthBoost, -10, 65 + depthBoost, -19, 43 + depthBoost, -half + 4, 51 + depthBoost, -half, 16],
    ];
    const face = this.add.polygon(x, y + 14, facePointsByKind[shapeKind], faceColor).setDepth(2);
    const keelDepth = 92 + depthBoost * 2 + shapeKind * 8;
    const keelWidth = Math.max(20, width * (shapeKind === 3 ? 0.72 : 0.56));
    const keelPoints = [
      -keelWidth / 2, -12, keelWidth / 2, -12,
      keelWidth * 0.42, 25, keelWidth * 0.24, 48,
      10, keelDepth * 0.68, 0, keelDepth,
      -10, keelDepth * 0.68, -keelWidth * 0.24, 48,
      -keelWidth * 0.42, 25,
    ];
    this.add.polygon(x, y + 38, keelPoints, faceColor, 0.78).setStrokeStyle(3, edgeColor, 0.28).setDepth(1);
    const chainLength = 34 + Math.round(this.random(index, 17) * 42);
    for (const side of [-1, 1]) {
      const chainX = x + side * Math.min(half - 10, keelWidth * 0.62);
      this.add.rectangle(chainX, y + 50 + chainLength / 2, 3, chainLength, edgeColor, 0.28).setDepth(1);
      this.add.rectangle(chainX, y + 51 + chainLength, 9, 9, edgeColor, 0.5).setAngle(45).setDepth(2);
    }
    this.add.rectangle(x, y + 63 + depthBoost, 13, 13, edgeColor, 0.48).setAngle(45).setStrokeStyle(2, 0xffffff, 0.18).setDepth(3);
    // The playable landing surface always matches the logical collision width.
    // Shape variation is deliberately restricted to the non-playable structure below it.
    const top = this.add.rectangle(x, y, width, topHalf * 2, topColor).setStrokeStyle(3, edgeColor).setDepth(3);
    if (shapeKind === 0) {
      this.add.rectangle(x - half + 7, y + 21, 6, 22, 0xffffff, 0.12).setDepth(4);
      this.add.rectangle(x, y + 57 + depthBoost, Math.max(12, width * 0.34), 5, edgeColor, 0.19).setDepth(4);
    } else if (shapeKind === 1) {
      this.add.rectangle(x, y + 22, Math.max(18, width - 30), 4, edgeColor, 0.24).setDepth(4);
      this.add.rectangle(x, y + 35, Math.max(10, width - 48), 3, 0xffffff, 0.1).setDepth(4);
      this.add.rectangle(x, y + 77 + depthBoost, 9, 15, edgeColor, 0.3).setDepth(4).setAngle(45);
    } else if (shapeKind === 2) {
      for (const offset of [-half + 13, half - 13]) this.add.rectangle(x + offset, y + 22, 8, 8, edgeColor, 0.28).setDepth(4).setAngle(45);
      this.add.rectangle(x, y + 78 + depthBoost, 18, 5, edgeColor, 0.22).setDepth(4);
    } else if (shapeKind === 3) {
      this.add.rectangle(x, y + 39, 8, 12, edgeColor, 0.28).setDepth(4).setAngle(45);
      this.add.rectangle(x - 20, y + 29, 5, 5, 0xffffff, 0.14).setDepth(4);
      this.add.rectangle(x + 21, y + 31, 4, 4, 0xffffff, 0.14).setDepth(4);
      for (const [offset, size] of [[-28, 7], [25, 5], [-14, 4]] as const) {
        this.add.rectangle(x + offset, y + 64 + depthBoost + Math.abs(offset) * 0.25, size, size, edgeColor, 0.24).setDepth(4).setAngle(45);
      }
    } else {
      this.add.rectangle(x, y + 29, Math.max(20, width - 34), 5, 0xffeea5, 0.34).setDepth(4);
      this.add.star(x, y - 2, 4, 5, 10, 0xfff4bd).setStrokeStyle(2, 0xb76d35).setDepth(5);
      this.add.star(x, y + 65 + depthBoost, 4, 5, 11, 0xffeea5, 0.32).setDepth(4);
    }
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
    this.body = this.add.rectangle(0, 1, 16, 22, 0xff7eb6).setStrokeStyle(2, 0x5f315b);
    const face = this.add.rectangle(0, -5, 12, 10, 0xffb0d1);
    const eye1 = this.add.rectangle(-3, -6, 2, 2, 0x382a4d);
    const eye2 = this.add.rectangle(3, -6, 2, 2, 0x382a4d);
    const foot1 = this.add.rectangle(-5, 13, 6, 4, 0x5f315b);
    const foot2 = this.add.rectangle(5, 13, 6, 4, 0x5f315b);
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
    const distance = 38 + this.charge * 142;
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
      this.charge = Math.min(1, this.charge + delta / 1800);
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
    const overlap = Math.min(heroCenter + 7, right) - Math.max(heroCenter - 7, left);
    const centerInside = heroCenter >= left && heroCenter <= right;
    const landingX = Phaser.Math.Clamp(heroCenter, left + 7, right - 7);
    const edgeDepth = Math.min(landingX - left, right - landingX);
    const assisted = heroCenter !== landingX;
    if (overlap > 0 && centerInside) {
      this.current += 1;
      while (this.platforms.length <= this.current + 24) this.createPlatform(this.platforms.length);
      this.hero.setPosition(landingX, target.y - 19);
      this.shadow.setPosition(landingX, target.y - 2).setScale(1).setAlpha(0.28);
      this.stable = true;
      this.charge = 0;
      this.chargeBar.width = 0;
      this.landBurst(edgeDepth < 9 || assisted);
      const reward = this.practice ? practiceReward(this.current, this.seed) : (defaultReward(this.current) ?? surpriseReward(this.current, this.seed));
      if (reward) {
        this.rewards.push(reward);
        this.bridge.onReward(reward);
      }
      this.emitSnapshot();
      if (this.current >= this.gateAt) {
        this.stable = false;
        this.bridge.onExtensionGate(this.current);
      } else {
        const practiceCheers = ['太稳啦！', '手感火热！', '漂亮起飞！', '星光为你亮起！', '完美节奏！'];
        this.hint.setText(this.practice ? practiceCheers[this.current % practiceCheers.length] : edgeDepth < 9 || assisted ? '惊险站稳！继续保持' : this.current % 10 === 0 ? '奖励已锁定 ✦' : '漂亮！继续向前').setVisible(true);
        this.time.delayedCall(900, () => this.hint.setVisible(false));
      }
    } else {
      this.fall(heroCenter < target.x ? -1 : 1);
    }
  }

  private landBurst(edge: boolean) {
    const baseCount = this.quality === 'smooth' ? 4 : this.quality === 'high' ? 14 : 8;
    const count = this.reducedMotion ? 0 : this.practice ? Math.min(18, baseCount + 5) : baseCount;
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
      shape: { type: 'rectangle', width: 16, height: 26 },
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
