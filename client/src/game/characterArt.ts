import type Phaser from "phaser";
import { INK } from "./palette";
import { fillPoly, sketchCircle, sketchEllipse, sketchLine, sketchPoly, hatchPoly, type Pt, type Rng } from "./sketch";

/**
 * Dino Draw Your Game – Niedlicher Ankylosaurus ("Dino") als Spielfigur
 *
 * Zentriert in lokalen Koordinaten, schaut nach rechts (facing = 1).
 * Körpermaße ca. 40 x 34 px (entspricht PLAYER_W / PLAYER_H).
 */

export type PlayerPose = { tick: number; running: boolean; airborne: boolean; rising: boolean };
export type EnemyPose = { tick: number };

const BLINK_EVERY = 24;

const ellipsePoly = (cx: number, cy: number, rx: number, ry: number, n = 14): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n;
    return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
  });

/**
 * Zeichnet den kleinen, süßen Ankylosaurus mit Panzerplatten, Schwanzkeule und drolligen Augen.
 */
export function drawPlayer(g: Phaser.GameObjects.Graphics, pose: PlayerPose, rng: Rng) {
  const { tick, running, airborne, rising } = pose;
  g.clear();

  // 1. BEINE: 4 kleine, knuffige Dinobeine
  const legSwing = running ? Math.sin(tick * 1.5) : 0;
  const legY = airborne ? 11 : 14;

  const legs = [
    { x: -12 - legSwing * 5, y: legY, back: true },
    { x: -6 + legSwing * 5, y: legY, back: false },
    { x: 5 - legSwing * 5, y: legY, back: true },
    { x: 11 + legSwing * 5, y: legY, back: false },
  ];

  for (const leg of legs) {
    const color = leg.back ? 0x228b22 : 0x2e8b57;
    g.fillStyle(color, 1).fillRoundedRect(leg.x - 3, leg.y - 2, 6, 8, 3);
    sketchLine(
      g,
      { x: leg.x - 3, y: leg.y + 4 },
      { x: leg.x + 3, y: leg.y + 4 },
      { color: INK.black, width: 2, wobble: 0.5 },
      rng,
      1
    );
  }

  // 2. SCHWANZ MIT KEULE (Ankylosaurus-Markenzeichen!)
  const tailWag = Math.sin(tick * 1.8) * (running ? 3 : 1.5);
  const tailStart = { x: -14, y: 1 };
  const tailMid = { x: -22, y: 1 + tailWag };
  const tailEnd = { x: -28, y: 1 + tailWag * 1.4 };

  // Schwanzlinie
  sketchLine(g, tailStart, tailMid, { color: 0x2e8b57, width: 7, wobble: 0.8 }, rng, 1);
  sketchLine(g, tailMid, tailEnd, { color: 0x2e8b57, width: 5, wobble: 0.8 }, rng, 1);

  // Schwanzkeule (Club)
  g.fillStyle(0x708090, 1).fillCircle(tailEnd.x, tailEnd.y, 4.5);
  sketchCircle(g, tailEnd.x, tailEnd.y, 4.8, { color: INK.black, width: 2, wobble: 0.6 }, rng, 1);

  // 3. KÖRPER: Runder, robuster Dino-Körper (warmes Grün/Turquoise)
  const bodyPts = ellipsePoly(0, 0, 17, 13, 16);
  g.fillStyle(0x3cb371, 1); // Medium sea green
  fillPoly(g, bodyPts, 0x3cb371, 0.95);
  hatchPoly(g, bodyPts, { color: 0x2e8b57, width: 1.5, alpha: 0.35 }, rng, 6, -Math.PI / 4, 2);
  sketchEllipse(g, 0, 0, 17.5, 13.5, { color: INK.black, width: 3, wobble: 1.1 }, rng);

  // Bauch (hellerer Akzent)
  const bellyPts = ellipsePoly(2, 4, 11, 7, 12);
  g.fillStyle(0x98fb98, 0.8);
  fillPoly(g, bellyPts, 0x98fb98, 0.8);

  // 4. PANZERPLATTEN / STACHELN (Ankylosaurus Scutes auf dem Rücken)
  const scutes = [
    { x: -12, y: -11 },
    { x: -5, y: -13 },
    { x: 3, y: -13 },
    { x: 10, y: -10 },
  ];
  for (const sc of scutes) {
    const scutePts = [
      { x: sc.x - 3, y: sc.y + 2 },
      { x: sc.x, y: sc.y - 4 },
      { x: sc.x + 3, y: sc.y + 2 },
    ];
    g.fillStyle(0xffd700, 1); // Goldene/Gelbe Panzerplatten
    fillPoly(g, scutePts, 0xffd700, 1);
    sketchPoly(g, scutePts, { color: INK.black, width: 1.8, wobble: 0.5 }, rng);
  }

  // 5. KOPF & SCHNAUZE (schaut nach rechts)
  const headX = 14;
  const headY = -3;
  g.fillStyle(0x3cb371, 1).fillCircle(headX, headY, 9);
  sketchCircle(g, headX, headY, 9.2, { color: INK.black, width: 2.8, wobble: 0.9 }, rng, 1);

  // Schnauze / Mund
  if (airborne && rising) {
    // Fröhliches O-Mund beim Hochspringen
    g.fillStyle(INK.black, 1).fillCircle(headX + 7, headY + 2, 2.2);
  } else {
    // Niedliches Dinoschmunzeln
    sketchLine(
      g,
      { x: headX + 3, y: headY + 3 },
      { x: headX + 7, y: headY + 1 },
      { color: INK.black, width: 2.2, wobble: 0.4 },
      rng,
      1
    );
  }

  // Backen-Rouge (Rosa Bäckchen)
  g.fillStyle(0xffb6c1, 0.7).fillCircle(headX + 2, headY + 3, 2.5);

  // 6. GROSSES FREUNDLICHES AUGE
  const eyeX = headX + 3;
  const eyeY = headY - 3;
  const isBlinking = tick % BLINK_EVERY < 2;

  if (isBlinking) {
    sketchLine(
      g,
      { x: eyeX - 3.5, y: eyeY },
      { x: eyeX + 3.5, y: eyeY },
      { color: INK.black, width: 2.5, wobble: 0.3 },
      rng,
      1
    );
  } else {
    // Weißer Augapfel
    g.fillStyle(0xffffff, 1).fillCircle(eyeX, eyeY, 4.2);
    sketchCircle(g, eyeX, eyeY, 4.2, { color: INK.black, width: 1.8, wobble: 0.4 }, rng, 1);

    // Große schwarze Pupille mit Lichtreflex
    const pupilOffsetY = rising ? -1 : 0.5;
    g.fillStyle(INK.black, 1).fillCircle(eyeX + 0.8, eyeY + pupilOffsetY, 2.4);
    // Glanzpunkt
    g.fillStyle(0xffffff, 1).fillCircle(eyeX + 1.6, eyeY + pupilOffsetY - 0.9, 1.1);
  }
}

export function drawEnemy(g: Phaser.GameObjects.Graphics, pose: EnemyPose, rng: Rng) {
  const { tick } = pose;
  g.clear();
  const swing = Math.sin(tick * 1.4);
  const limb = { color: INK.black, width: 3.4, wobble: 0.9 };

  // Beine
  sketchLine(g, { x: 0, y: 8 }, { x: swing * 8, y: 16 }, limb, rng, 1);
  sketchLine(g, { x: 0, y: 8 }, { x: -swing * 8, y: 16 }, limb, rng, 1);
  // Arme
  sketchLine(g, { x: 0, y: 0 }, { x: -swing * 8, y: 6.5 }, limb, rng, 1);
  sketchLine(g, { x: 0, y: 0 }, { x: swing * 8, y: 6.5 }, limb, rng, 1);
  // Körper
  sketchLine(g, { x: 0, y: -2.5 }, { x: 0, y: 8.5 }, limb, rng);

  // Kopf
  const hx = 2;
  const hy = -9;
  fillPoly(g, ellipsePoly(hx, hy, 6.3, 6.3, 10), 0xfffaf0, 1);
  sketchCircle(g, hx, hy, 6.5, { color: INK.black, width: 3, wobble: 0.9 }, rng);
  g.fillStyle(INK.black, 1).fillCircle(hx - 1.6, hy - 0.5, 1.2).fillCircle(hx + 3, hy - 0.5, 1.2);
  const brow = { color: INK.red, width: 2, wobble: 0.3 };
  sketchLine(g, { x: hx - 3.2, y: hy - 4.2 }, { x: hx - 0.2, y: hy - 2.6 }, brow, rng, 1);
  sketchLine(g, { x: hx + 5.2, y: hy - 4.2 }, { x: hx + 2.2, y: hy - 2.6 }, brow, rng, 1);
}
