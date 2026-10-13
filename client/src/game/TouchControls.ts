import Phaser from "phaser";
import type { MoveInput, GameMode } from "./Player";
import { INK } from "./palette";
import { fillPoly, jitterPoints, rectCorners, seededFor, sketchLine, sketchPoly } from "./sketch";

const DEPTH = 1800;
/** Button edge length in world px. */
const BUTTON_SIZE = 120;
const EDGE_MARGIN = 40;
const BUTTON_GAP = 30;
const HIT_PADDING = 20;
const MIN_TOUCH_POINTERS = 3;

type ActionKind = "left" | "right" | "up" | "down" | "jump" | "pause" | "fire";
type Button = {
  kind: ActionKind;
  x: number;
  y: number;
  w: number;
  h: number;
  art: Phaser.GameObjects.Graphics;
  pressed: boolean;
};

/** True on touch devices, or anywhere with ?touch=1 (for testing on desktop). */
export function touchControlsEnabled(scene: Phaser.Scene): boolean {
  return (
    scene.sys.game.device.input.touch || new URLSearchParams(window.location.search).get("touch") === "1"
  );
}

/**
 * On-Screen Touch-Steuerung für Smartphone und Tablet.
 * - Jump 'n' Run: Links, Rechts, Sprung, Feuerball (🔥), Pause
 * - RPG Maker: 4-Wege D-Pad (Hoch, Runter, Links, Rechts) + Sprung/Dash, Feuerball (🔥)
 */
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly buttons: Button[];
  private readonly gameMode: GameMode;
  private visible = true;

  constructor(scene: Phaser.Scene, gameMode: GameMode = "jump_n_run") {
    this.scene = scene;
    this.gameMode = gameMode;

    const missing = MIN_TOUCH_POINTERS - (scene.input.manager.pointers.length - 1);
    if (missing > 0) scene.input.addPointer(missing);

    const { width, height } = scene.scale;
    const isSmall = height <= 600;
    const btnSize = isSmall ? 82 : BUTTON_SIZE;
    const edgeMargin = isSmall ? 22 : EDGE_MARGIN;
    const btnGap = isSmall ? 18 : BUTTON_GAP;

    const y = height - edgeMargin - btnSize / 2;
    const jumpX = width - edgeMargin - btnSize / 2;
    const fireX = jumpX - btnSize - btnGap;
    const pauseX = width - (isSmall ? 46 : 60);
    const pauseY = isSmall ? 46 : 60;
    const pauseSize = isSmall ? 48 : 64;

    if (gameMode === "rpg_labyrinth") {
      // 🧭 RPG Maker Modus: Kompaktes 4-Wege Kreuz
      const cx = edgeMargin + (isSmall ? 85 : 120);
      const cy = height - edgeMargin - (isSmall ? 80 : 110);
      const step = isSmall ? 64 : 82;
      const dpadSize = isSmall ? 64 : 80;

      this.buttons = [
        this.createButton("up", cx, cy - step, dpadSize, dpadSize),
        this.createButton("down", cx, cy + step, dpadSize, dpadSize),
        this.createButton("left", cx - step, cy, dpadSize, dpadSize),
        this.createButton("right", cx + step, cy, dpadSize, dpadSize),
        this.createButton("fire", fireX, y, btnSize, btnSize),
        this.createButton("jump", jumpX, y, btnSize, btnSize),
        this.createButton("pause", pauseX, pauseY, pauseSize, pauseSize),
      ];
    } else {
      // 🏃‍♂️ Klassischer Platformer Modus
      const leftX = edgeMargin + btnSize / 2;
      this.buttons = [
        this.createButton("left", leftX, y, btnSize, btnSize),
        this.createButton("right", leftX + btnSize + btnGap, y, btnSize, btnSize),
        this.createButton("fire", fireX, y, btnSize, btnSize),
        this.createButton("jump", jumpX, y, btnSize, btnSize),
        this.createButton("pause", pauseX, pauseY, pauseSize, pauseSize),
      ];
    }
  }

  /** Blendet die Touch-Steuerung ein oder aus (z.B. wenn ein Controller aktiv verwendet wird) */
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const b of this.buttons) {
      b.art.setVisible(visible);
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Which buttons are held right now. Call every frame. */
  read(): MoveInput & { pause: boolean; fire: boolean } {
    const held = { left: false, right: false, up: false, down: false, jump: false, pause: false, fire: false };

    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown) continue;
      // Sobald der Bildschirm berührt wird, Touch-Steuerung wieder einblenden!
      if (!this.visible) {
        this.setVisible(true);
      }
      for (const b of this.buttons) {
        if (
          Math.abs(pointer.x - b.x) <= b.w / 2 + HIT_PADDING &&
          Math.abs(pointer.y - b.y) <= b.h / 2 + HIT_PADDING
        ) {
          if (b.kind === "pause") {
            if (!b.pressed) held.pause = true;
          } else {
            held[b.kind] = true;
          }
        }
      }
    }

    for (const b of this.buttons) {
      const isDown = held[b.kind];
      if (b.pressed !== isDown) {
        b.pressed = isDown;
        this.draw(b);
      }
    }

    return held;
  }

  private createButton(kind: ActionKind, x: number, y: number, w: number, h: number): Button {
    const art = this.scene.add.graphics().setPosition(x, y).setScrollFactor(0).setDepth(DEPTH);
    const button: Button = { kind, x, y, w, h, art, pressed: false };
    this.draw(button);
    return button;
  }

  private draw({ kind, x, y, w, h, art, pressed }: Button) {
    const hw = w / 2;
    const hh = h / 2;
    const rng = seededFor(`touch:${kind}`);
    art.clear();
    const corners = jitterPoints(rectCorners(-hw, -hh, w, h), 3, rng);
    fillPoly(art, corners, pressed ? 0xbcd3ff : INK.paper, pressed ? 0.85 : 0.6);
    sketchPoly(art, corners, { color: INK.black, width: 3.5, alpha: pressed ? 0.9 : 0.6, wobble: 2 }, rng);

    const ink = { color: pressed ? INK.blueDark : INK.black, width: 5, alpha: pressed ? 0.95 : 0.7, wobble: 1.2 };

    if (kind === "pause") {
      // Pause symbol: zwei parallele Balken
      sketchLine(art, { x: -8, y: -14 }, { x: -8, y: 14 }, ink, rng);
      sketchLine(art, { x: 8, y: -14 }, { x: 8, y: 14 }, ink, rng);
      return;
    }

    if (kind === "fire") {
      // Feuerball-Symbol (orange-gelbe Flamme)
      fillPoly(art, corners, pressed ? 0xfecaca : 0xffedd5, pressed ? 0.9 : 0.7);
      sketchPoly(art, corners, { color: 0xea580c, width: 3.5, alpha: pressed ? 0.95 : 0.7, wobble: 2 }, rng);
      art.fillStyle(0xf97316, 0.95);
      art.fillCircle(0, 4, 14);
      art.fillStyle(0xfacc15, 0.95);
      art.fillCircle(0, 1, 9);
      art.fillStyle(0xffffff, 0.95);
      art.fillCircle(0, -1, 4.5);
      return;
    }

    // Pfeile für Links/Rechts/Hoch/Runter/Sprung
    let dir: [number, number] = [0, -1];
    if (kind === "left") dir = [-1, 0];
    else if (kind === "right") dir = [1, 0];
    else if (kind === "down") dir = [0, 1];
    else if (kind === "up") dir = [0, -1];
    else if (kind === "jump") {
      dir = this.gameMode === "rpg_labyrinth" ? [1, 0] : [0, -1];
    }

    const [dx, dy] = dir;
    const px = -dy;
    const py = dx;
    const arrowLen = Math.min(28, w * 0.32);
    const arrowHead = Math.min(20, w * 0.25);
    const at = (along: number, across: number) => ({ x: dx * along + px * across, y: dy * along + py * across });

    sketchLine(art, at(-arrowLen, 0), at(arrowLen, 0), ink, rng);
    sketchLine(art, at(arrowLen, 0), at(arrowLen - arrowHead, -arrowHead), ink, rng);
    sketchLine(art, at(arrowLen, 0), at(arrowLen - arrowHead, arrowHead), ink, rng);
  }
}
