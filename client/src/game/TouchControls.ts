import Phaser from "phaser";
import type { MoveInput } from "./Player";
import { INK } from "./palette";
import { fillPoly, jitterPoints, rectCorners, seededFor, sketchLine, sketchPoly } from "./sketch";

const DEPTH = 1800;
/** Button edge length in world px. */
const BUTTON_SIZE = 120;
const EDGE_MARGIN = 40;
const BUTTON_GAP = 30;
const HIT_PADDING = 20;
const MIN_TOUCH_POINTERS = 3;

type ActionKind = keyof MoveInput | "pause";
type Button = { kind: ActionKind; x: number; y: number; w: number; h: number; art: Phaser.GameObjects.Graphics; pressed: boolean };

/** True on touch devices, or anywhere with ?touch=1 (for testing on desktop). */
export function touchControlsEnabled(scene: Phaser.Scene): boolean {
  return (
    scene.sys.game.device.input.touch || new URLSearchParams(window.location.search).get("touch") === "1"
  );
}

/**
 * On-Screen Touch-Steuerung für Smartphone und Tablet.
 * Große Tasten links/rechts, Sprungtaste rechts unten, Pause-Taste oben rechts.
 */
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly buttons: Button[];
  private pauseTriggered = false;
  private visible = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const missing = MIN_TOUCH_POINTERS - (scene.input.manager.pointers.length - 1);
    if (missing > 0) scene.input.addPointer(missing);

    const { width, height } = scene.scale;
    const y = height - EDGE_MARGIN - BUTTON_SIZE / 2;
    const leftX = EDGE_MARGIN + BUTTON_SIZE / 2;

    this.buttons = [
      this.createButton("left", leftX, y, BUTTON_SIZE, BUTTON_SIZE),
      this.createButton("right", leftX + BUTTON_SIZE + BUTTON_GAP, y, BUTTON_SIZE, BUTTON_SIZE),
      this.createButton("jump", width - EDGE_MARGIN - BUTTON_SIZE / 2, y, BUTTON_SIZE, BUTTON_SIZE),
      this.createButton("pause", width - 60, 60, 64, 64),
    ];
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
  read(): MoveInput & { pause: boolean } {
    const held = { left: false, right: false, jump: false, pause: false };

    for (const pointer of this.scene.input.manager.pointers) {
      if (!pointer.isDown) continue;
      // Sobald der Bildschirm berührt wird, Touch-Steuerung wieder einblenden!
      if (!this.visible) {
        this.setVisible(true);
      }
      for (const b of this.buttons) {
        if (Math.abs(pointer.x - b.x) <= b.w / 2 + HIT_PADDING && Math.abs(pointer.y - b.y) <= b.h / 2 + HIT_PADDING) {
          if (b.kind === "left" || b.kind === "right" || b.kind === "jump") {
            held[b.kind] = true;
          } else if (b.kind === "pause" && !b.pressed) {
            held.pause = true;
          }
        }
      }
    }

    for (const b of this.buttons) {
      const isDown =
        b.kind === "left" ? held.left :
        b.kind === "right" ? held.right :
        b.kind === "jump" ? held.jump :
        held.pause;

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

    // Pfeile für Links/Rechts/Sprung
    const dir = kind === "left" ? [-1, 0] : kind === "right" ? [1, 0] : [0, -1];
    const [dx, dy] = dir;
    const px = -dy;
    const py = dx;
    const at = (along: number, across: number) => ({ x: dx * along + px * across, y: dy * along + py * across });
    sketchLine(art, at(-28, 0), at(28, 0), ink, rng);
    sketchLine(art, at(28, 0), at(6, -22), ink, rng);
    sketchLine(art, at(28, 0), at(6, 22), ink, rng);
  }
}
