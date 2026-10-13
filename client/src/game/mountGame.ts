import Phaser from "phaser";
import { GRAVITY, WORLD_H, WORLD_W } from "@sketchquest/shared";
import { GameScene, GAME_SCENE_KEY } from "./GameScene";
import { prepareLevel } from "./prepareLevel";
import { DEBUG } from "./debug";
import { installAudioUnlock } from "./audio";
import { lockTouchBehavior } from "./touchLock";
import type { BackgroundTheme } from "./paper";
import type { GameMode } from "./Player";

export type GameHandle = {
  game: Phaser.Game;
  /**
   * Tear down and rebuild the scene from level JSON. No page refresh.
   * Accepts untrusted data (e.g. raw Gemini output): bad entities are
   * clamped or dropped by sanitizeLevel() instead of throwing, and
   * fixLevel() moves the spawn/goal/coins somewhere playable.
   */
  loadLevel(level: unknown): void;
  restartLevel(): void;
  togglePause(): void;
  setTvMode(tv: boolean): void;
  destroy(): void;
};

let current: GameHandle | null = null;

export function mountGame(
  el: HTMLElement,
  options?: {
    tvMode?: boolean;
    background?: BackgroundTheme;
    gameMode?: GameMode;
    gamepadSwapAB?: boolean;
    isSmartphone?: boolean;
  }
): GameHandle {
  installAudioUnlock();
  const bgTheme = options?.background || "paper";
  const gameMode = options?.gameMode || "jump_n_run";
  const bgColor =
    bgTheme === "space"
      ? "#131728"
      : bgTheme === "jungle"
      ? "#d8ece0"
      : bgTheme === "volcano"
      ? "#200e12"
      : "#f7f2e3";

  const arcadeGravity = gameMode === "rpg_labyrinth" ? 0 : GRAVITY;

  // Auf Smartphones wird ein vergrößerter Ausschnitt (960x540) mit Kameraführung auf Dino genutzt,
  // damit Dino & Hindernisse groß genug sind. Auf Desktop bleibt die volle 1600x900 Übersicht.
  const isPhone =
    !!options?.isSmartphone ||
    (typeof window !== "undefined" &&
      (window.innerWidth <= 768 || window.innerHeight <= 540 || /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent)));

  const gameWidth = isPhone ? 960 : WORLD_W;
  const gameHeight = isPhone ? 540 : WORLD_H;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: el,
    width: gameWidth,
    height: gameHeight,
    backgroundColor: bgColor,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: arcadeGravity }, debug: DEBUG } },
    scene: [GameScene],
  });

  game.registry.set("isSmartphone", isPhone);
  game.registry.set("tvMode", !!options?.tvMode);
  game.registry.set("backgroundTheme", bgTheme);
  game.registry.set("gameMode", gameMode);
  game.registry.set("gamepadSwapAB", !!options?.gamepadSwapAB);

  // The canvas exists once Phaser has booted (immediately, if the DOM was already ready).
  const lockCanvas = () => lockTouchBehavior(game.canvas);
  if (game.isBooted) lockCanvas();
  else game.events.once(Phaser.Core.Events.BOOT, lockCanvas);

  const handle: GameHandle = {
    game,
    loadLevel(level) {
      const parsed = prepareLevel(level) as any;
      if (level && typeof level === "object" && "originalImage" in level) {
        parsed.originalImage = (level as any).originalImage;
      }
      const start = () => game.scene.start(GAME_SCENE_KEY, { level: parsed });
      if (game.isBooted) start();
      else game.events.once(Phaser.Core.Events.READY, start);
    },
    restartLevel() {
      const scene = game.scene.getScene(GAME_SCENE_KEY) as GameScene;
      if (scene && typeof (scene as any).restartLevel === "function") {
        (scene as any).restartLevel();
      }
    },
    togglePause() {
      const scene = game.scene.getScene(GAME_SCENE_KEY) as GameScene;
      if (scene && typeof (scene as any).togglePause === "function") {
        (scene as any).togglePause();
      }
    },
    setTvMode(tv: boolean) {
      game.registry.set("tvMode", tv);
    },
    destroy() {
      if (current === handle) current = null;
      game.destroy(true);
    },
  };

  current = handle;
  return handle;
}

/** Load a level into the currently mounted game. */
export function loadLevel(level: unknown): void {
  if (!current) throw new Error("loadLevel called before mountGame");
  current.loadLevel(level);
}
