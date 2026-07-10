import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import Phaser from 'phaser';
import { GameScene } from './GameScene';
import type { GameBridgeEvents, Quality } from './types';

export interface PhaserGameHandle {
  extend(blocks: number): void;
  snapshot(): ReturnType<GameScene['getSnapshot']> | null;
}

interface Props extends GameBridgeEvents { seed: number; practice: boolean; quality: Quality; reducedMotion: boolean; }

function resolvedQuality(quality: Quality): Quality {
  if (quality !== 'auto') return quality;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || memory <= 3) return 'smooth';
  if (cores >= 8 && memory >= 6) return 'high';
  return 'balanced';
}

export const PhaserGame = forwardRef<PhaserGameHandle, Props>(function PhaserGame(props, ref) {
  const root = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<GameScene | null>(null);

  useImperativeHandle(ref, () => ({
    extend: (blocks) => scene.current?.extend(blocks),
    snapshot: () => scene.current?.getSnapshot() ?? null,
  }), []);

  useEffect(() => {
    if (!root.current || game.current) return;
    const activeScene = new GameScene(props, props.seed, props.practice, resolvedQuality(props.quality), props.reducedMotion, props.quality === 'auto');
    scene.current = activeScene;
    game.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: root.current,
      width: 420,
      height: 760,
      backgroundColor: '#181b3d',
      pixelArt: true,
      roundPixels: true,
      physics: { default: 'matter', matter: { gravity: { x: 0, y: 1.1 }, enableSleeping: true } },
      scene: activeScene,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: false, pixelArt: true, roundPixels: true },
    });
    return () => {
      game.current?.destroy(true);
      game.current = null;
      scene.current = null;
    };
    // One Phaser instance per round; callbacks are intentionally captured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    scene.current?.setQuality(resolvedQuality(props.quality), props.quality === 'auto');
  }, [props.quality]);

  useEffect(() => {
    scene.current?.setReducedMotion(props.reducedMotion);
  }, [props.reducedMotion]);

  return <div className="phaser-root" ref={root} />;
});

export default PhaserGame;
