import Phaser from "phaser";
import { WORLD_H, WORLD_W } from "@sketchquest/shared";
import { makeRng } from "./sketch";
import { DEPTH } from "./palette";

export type BackgroundTheme = "paper" | "jungle" | "space" | "volcano";

export interface BackgroundThemeInfo {
  id: BackgroundTheme;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
}

export const BACKGROUND_THEMES: BackgroundThemeInfo[] = [
  {
    id: "paper",
    name: "Notizheft (Klassik)",
    subtitle: "Ausgewogene Standard-Welt mit präziser Kontrolle & sauberer Physik 📜",
    icon: "📜",
    color: "#f7f2e3",
  },
  {
    id: "jungle",
    name: "Urzeit-Dschungel",
    subtitle: "Tropischer Wind: Sanfte Windbrisen & wirbelnde Blätter in Gängen & Höhen 🍃",
    icon: "🌴",
    color: "#e2ede2",
  },
  {
    id: "space",
    name: "Kosmische Nacht",
    subtitle: "Schwerelosigkeit: Weite Schwebe-Sprünge & schwereloses Zero-G Raumgleiten 🌌",
    icon: "🌌",
    color: "#181f38",
  },
  {
    id: "volcano",
    name: "Vulkanlandschaft (Glutberg)",
    subtitle: "Magma-Power: Doppelsprung im Jump 'n' Run & Turbo-Doppel-Dash im Labyrinth 🌋",
    icon: "🌋",
    color: "#2a1515",
  },
];

const LINE_GAP = 48;
const FIRST_LINE_Y = 132;
const MARGIN_X = 158;
const GRAIN_TILE = 256;

function getTextureKey(theme: BackgroundTheme): string {
  return `sq-bg-${theme}`;
}

/**
 * Erzeugt eine der 4 wählbaren Hintergrund-Texturen für Phaser:
 * 1. "paper": Klassisches Notizheft mit roten und blauen Linien
 * 2. "jungle": Malerischer Urzeit-Dschungel mit Farnen, Bergen & Sonnenlicht
 * 3. "space": Kosmische Nacht mit funkelnden Sternen & Sichelmond
 * 4. "volcano": Vulkanlandschaft mit glühender Lava & Doppelsprung
 */
function ensureBackgroundTexture(scene: Phaser.Scene, theme: BackgroundTheme) {
  const key = getTextureKey(theme);
  if (scene.textures.exists(key)) return;

  const tex = scene.textures.createCanvas(key, WORLD_W, WORLD_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const rng = makeRng(
    theme === "paper" ? 0x5ce7c4 : theme === "jungle" ? 0x7ab941 : theme === "space" ? 0x1f3c88 : 0xdf382b
  );

  if (theme === "paper") {
    drawPaperTexture(ctx, rng);
  } else if (theme === "jungle") {
    drawJungleTexture(ctx, rng);
  } else if (theme === "space") {
    drawSpaceTexture(ctx, rng);
  } else if (theme === "volcano") {
    drawVolcanoTexture(ctx, rng);
  }

  tex.refresh();
}

/** 1. Klassisches Notizbuch-Papier */
function drawPaperTexture(ctx: CanvasRenderingContext2D, rng: () => number) {
  ctx.fillStyle = "#f7f2e3";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Zarte weiche Flecken für Vintage-Papieroptik
  for (let i = 0; i < 26; i++) {
    const x = rng() * WORLD_W;
    const y = rng() * WORLD_H;
    const r = 120 + rng() * 260;
    const warm = rng() > 0.5;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, warm ? "rgba(214,190,130,0.07)" : "rgba(150,150,140,0.05)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Papierkörnung
  const tile = document.createElement("canvas");
  tile.width = tile.height = GRAIN_TILE;
  const tctx = tile.getContext("2d");
  if (tctx) {
    const img = tctx.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = rng();
      const dark = n < 0.5;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = dark ? 90 : 255;
      img.data[i + 3] = Math.floor(rng() * (dark ? 16 : 22));
    }
    tctx.putImageData(img, 0, 0);
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    }
  }

  // Blaue Notizlinien
  ctx.lineCap = "round";
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(78,133,214,0.34)";
  for (let y = FIRST_LINE_Y; y < WORLD_H; y += LINE_GAP) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 40; x <= WORLD_W + 40; x += 40) ctx.lineTo(x, y + (rng() - 0.5) * 1.2);
    ctx.stroke();
  }

  // Rote Randlinie
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(214,69,61,0.32)";
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 0);
  for (let y = 40; y <= WORLD_H + 40; y += 40) ctx.lineTo(MARGIN_X + (rng() - 0.5) * 1.2, y);
  ctx.stroke();

  // Vignette
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const vignette = ctx.createRadialGradient(cx, cy, WORLD_H * 0.42, cx, cy, WORLD_W * 0.62);
  vignette.addColorStop(0, "rgba(120,100,60,0)");
  vignette.addColorStop(1, "rgba(120,100,60,0.24)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

/** 2. Urzeit-Dschungel (Baumkronen- & Blätterwelt / Im Urwaldbaum) */
function drawJungleTexture(ctx: CanvasRenderingContext2D, rng: () => number) {
  // 1. Dichter Urwald-Baldachin: Tiefgrüner, stimmungsvoller Farbverlauf
  const canopyGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  canopyGrad.addColorStop(0, "#16341d");   // Oben: Dichtes, schattiges Blätterdach
  canopyGrad.addColorStop(0.35, "#224b2a"); // Mittlerer Baldachin
  canopyGrad.addColorStop(0.7, "#1b3c22");  // Tiefes Moosgrün
  canopyGrad.addColorStop(1, "#122616");    // Unten: Urwald-Dickicht
  ctx.fillStyle = canopyGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // 2. Weiche Sonnenstrahlen (Komorebi / Licht durchs Blätterdach)
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const rx = 180 + i * 260;
    const ray = ctx.createLinearGradient(rx, 0, rx + 140, WORLD_H);
    ray.addColorStop(0, "rgba(255, 248, 175, 0.16)");
    ray.addColorStop(0.6, "rgba(220, 255, 190, 0.06)");
    ray.addColorStop(1, "rgba(255, 248, 175, 0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(rx - 30, 0);
    ctx.lineTo(rx + 70, 0);
    ctx.lineTo(rx + 240, WORLD_H);
    ctx.lineTo(rx + 90, WORLD_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // 3. Mächtige Baumstämme an den Flanken (wie im Inneren eines Urwaldbaums)
  // Linker gigantischer Baumstamm
  const leftTrunk = ctx.createLinearGradient(0, 0, 240, 0);
  leftTrunk.addColorStop(0, "#1c120a");
  leftTrunk.addColorStop(0.6, "#2b1c11");
  leftTrunk.addColorStop(0.85, "#3d2a1c");
  leftTrunk.addColorStop(1, "rgba(61, 42, 28, 0)");
  ctx.fillStyle = leftTrunk;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(140, WORLD_H * 0.4, 90, WORLD_H);
  ctx.lineTo(0, WORLD_H);
  ctx.closePath();
  ctx.fill();

  // Rinde & Moos auf linkem Stamm
  ctx.strokeStyle = "rgba(75, 140, 70, 0.35)";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.quadraticCurveTo(110, WORLD_H * 0.45, 65, WORLD_H);
  ctx.stroke();

  // Rechter Baumstamm
  const rightTrunk = ctx.createLinearGradient(WORLD_W - 220, 0, WORLD_W, 0);
  rightTrunk.addColorStop(0, "rgba(61, 42, 28, 0)");
  rightTrunk.addColorStop(0.25, "#3d2a1c");
  rightTrunk.addColorStop(0.6, "#2b1c11");
  rightTrunk.addColorStop(1, "#1c120a");
  ctx.fillStyle = rightTrunk;
  ctx.beginPath();
  ctx.moveTo(WORLD_W, 0);
  ctx.quadraticCurveTo(WORLD_W - 130, WORLD_H * 0.45, WORLD_W - 80, WORLD_H);
  ctx.lineTo(WORLD_W, WORLD_H);
  ctx.closePath();
  ctx.fill();

  // Rinde & Moos auf rechtem Stamm
  ctx.strokeStyle = "rgba(75, 140, 70, 0.35)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(WORLD_W - 25, 0);
  ctx.quadraticCurveTo(WORLD_W - 95, WORLD_H * 0.4, WORLD_W - 55, WORLD_H);
  ctx.stroke();

  // 4. Quer verlaufende dicke Äste im Kronenbereich
  ctx.fillStyle = "#27190f";
  // Oberer Hauptast (ideal für Kopfüber-Deckenlauf)
  ctx.beginPath();
  ctx.moveTo(0, 60);
  ctx.bezierCurveTo(WORLD_W * 0.3, 110, WORLD_W * 0.7, 45, WORLD_W, 95);
  ctx.lineTo(WORLD_W, 130);
  ctx.bezierCurveTo(WORLD_W * 0.7, 75, WORLD_W * 0.3, 145, 0, 95);
  ctx.closePath();
  ctx.fill();

  // Ast-Moosauflage
  ctx.fillStyle = "rgba(60, 130, 60, 0.45)";
  ctx.beginPath();
  ctx.moveTo(0, 85);
  ctx.bezierCurveTo(WORLD_W * 0.3, 135, WORLD_W * 0.7, 65, WORLD_W, 115);
  ctx.lineTo(WORLD_W, 125);
  ctx.bezierCurveTo(WORLD_W * 0.7, 75, WORLD_W * 0.3, 145, 0, 95);
  ctx.closePath();
  ctx.fill();

  // Mittlerer Nebenast rechts
  ctx.fillStyle = "#27190f";
  ctx.beginPath();
  ctx.moveTo(WORLD_W, 460);
  ctx.quadraticCurveTo(WORLD_W * 0.65, 430, WORLD_W * 0.5, 480);
  ctx.quadraticCurveTo(WORLD_W * 0.65, 460, WORLD_W, 510);
  ctx.closePath();
  ctx.fill();

  // 5. Tropische Riesenblätter & Monstera / Palmwedel an den Rändern
  const drawTropicalLeaf = (cx: number, cy: number, len: number, angle: number, col: string) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -len * 0.38, len, 0);
    ctx.quadraticCurveTo(len * 0.45, len * 0.38, 0, 0);
    ctx.fill();

    // Blattader
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.92, 0);
    ctx.stroke();

    // Einkerbungen / Blattrippen
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.lineWidth = 1.2;
    for (let s = len * 0.25; s < len * 0.85; s += len * 0.18) {
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s + 18, -len * 0.22);
      ctx.moveTo(s, 0);
      ctx.lineTo(s + 18, len * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Blätterkrone entlang des oberen Rands (Deckenblätter)
  const leafColors = ["#1e532b", "#2a6937", "#327b41", "#194724"];
  for (let i = 0; i < 18; i++) {
    const lx = (i / 17) * WORLD_W;
    const ly = 15 + (rng() - 0.5) * 35;
    const rot = 0.5 + (rng() - 0.5) * 0.8;
    const size = 110 + rng() * 80;
    const col = leafColors[i % leafColors.length];
    drawTropicalLeaf(lx, ly, size, rot, col);
  }

  // Farnbüschel links oben & rechts oben
  for (let i = 0; i < 6; i++) {
    drawTropicalLeaf(15 + i * 22, 10 + i * 18, 140 - i * 10, 0.3 + i * 0.18, "#286835");
    drawTropicalLeaf(WORLD_W - (15 + i * 22), 10 + i * 18, 140 - i * 10, Math.PI - (0.3 + i * 0.18), "#22592d");
  }

  // 6. Herabhängende Lianen mit kleinen Blättern
  const drawVine = (vx: number, vy: number, vlen: number, sway: number) => {
    ctx.save();
    ctx.strokeStyle = "#436a38";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    const midY = vy + vlen * 0.5;
    const endY = vy + vlen;
    ctx.bezierCurveTo(vx + sway, midY, vx - sway, midY + 40, vx, endY);
    ctx.stroke();

    // Kleine herabhängende Herz-/Blättchen
    for (let step = vy + 30; step < endY - 15; step += 38) {
      const frac = (step - vy) / vlen;
      const curX = vx + Math.sin(frac * Math.PI) * sway;
      drawTropicalLeaf(curX, step, 26, (frac % 2 === 0 ? 0.6 : -0.6), "#4e823f");
    }
    ctx.restore();
  };

  drawVine(160, 90, 240, 28);
  drawVine(290, 110, 190, -22);
  drawVine(480, 75, 270, 32);
  drawVine(720, 85, 220, -25);
  drawVine(880, 115, 260, 30);
  drawVine(1040, 95, 210, -20);


  // 8. Dschungel-Atmosphäre Vignette (Fokus in der Mitte der Baumkrone)
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const vig = ctx.createRadialGradient(cx, cy, WORLD_H * 0.42, cx, cy, WORLD_W * 0.68);
  vig.addColorStop(0, "rgba(20, 50, 25, 0)");
  vig.addColorStop(0.7, "rgba(15, 35, 18, 0.18)");
  vig.addColorStop(1, "rgba(8, 20, 10, 0.42)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

/** 3. Kosmische Nacht (Sternen-Galaxie mit Sichelmond) */
function drawSpaceTexture(ctx: CanvasRenderingContext2D, rng: () => number) {
  // Tiefblauer Nachthimmel-Gradient
  const spaceGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  spaceGrad.addColorStop(0, "#131728");
  spaceGrad.addColorStop(0.5, "#1c2440");
  spaceGrad.addColorStop(1, "#141829");
  ctx.fillStyle = spaceGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Kosmische Nebelwolken
  const neb1 = ctx.createRadialGradient(WORLD_W * 0.3, WORLD_H * 0.4, 0, WORLD_W * 0.3, WORLD_H * 0.4, 500);
  neb1.addColorStop(0, "rgba(155, 81, 224, 0.15)");
  neb1.addColorStop(1, "rgba(155, 81, 224, 0)");
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const neb2 = ctx.createRadialGradient(WORLD_W * 0.75, WORLD_H * 0.65, 0, WORLD_W * 0.75, WORLD_H * 0.65, 600);
  neb2.addColorStop(0, "rgba(42, 109, 244, 0.14)");
  neb2.addColorStop(1, "rgba(42, 109, 244, 0)");
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Sterne im Kreidestil (ca. 140 funkelnde Punkte)
  for (let i = 0; i < 140; i++) {
    const sx = rng() * WORLD_W;
    const sy = rng() * WORLD_H;
    const radius = 1 + rng() * 2.2;
    const alpha = 0.4 + rng() * 0.55;

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Einige Sterne als 4-strahlige Glitzersterne (✦)
    if (i % 14 === 0) {
      ctx.strokeStyle = `rgba(255, 245, 190, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx - 5, sy);
      ctx.lineTo(sx + 5, sy);
      ctx.moveTo(sx, sy - 5);
      ctx.lineTo(sx, sy + 5);
      ctx.stroke();
    }
  }

  // Skizzierter Sichelmond oben rechts
  const mx = WORLD_W * 0.86;
  const my = WORLD_H * 0.18;
  const mGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
  mGrad.addColorStop(0, "rgba(255, 235, 170, 0.25)");
  mGrad.addColorStop(1, "rgba(255, 235, 170, 0)");
  ctx.fillStyle = mGrad;
  ctx.beginPath();
  ctx.arc(mx, my, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(mx, my, 32, 0, Math.PI * 2);
  ctx.fillStyle = "#fff8d6";
  ctx.fill();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(mx - 12, my - 6, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();


  // Kosmische Vignette
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const vig = ctx.createRadialGradient(cx, cy, WORLD_H * 0.45, cx, cy, WORLD_W * 0.65);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(1, "rgba(5, 7, 15, 0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
}

/** 4. Vulkanlandschaft (Glutberg & Magma-Grotte) */
function drawVolcanoTexture(ctx: CanvasRenderingContext2D, rng: () => number) {
  // Dunkler Basalt- & Glut-Himmel
  const skyGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  skyGrad.addColorStop(0, "#160b0e");
  skyGrad.addColorStop(0.5, "#281216");
  skyGrad.addColorStop(0.85, "#3b1512");
  skyGrad.addColorStop(1, "#54190f");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Glutwolken & Rauch im Hintergrund
  for (let i = 0; i < 18; i++) {
    const rx = rng() * WORLD_W;
    const ry = rng() * (WORLD_H * 0.7);
    const radius = 100 + rng() * 220;
    const smokeGrad = ctx.createRadialGradient(rx, ry, 0, rx, ry, radius);
    smokeGrad.addColorStop(0, "rgba(80, 25, 20, 0.18)");
    smokeGrad.addColorStop(0.6, "rgba(45, 15, 18, 0.08)");
    smokeGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = smokeGrad;
    ctx.beginPath();
    ctx.arc(rx, ry, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Entfernte Vulkan-Bergkette (Silhouetten mit Glutkrater)
  ctx.fillStyle = "#1e0c10";
  ctx.beginPath();
  ctx.moveTo(0, WORLD_H * 0.75);
  ctx.lineTo(WORLD_W * 0.22, WORLD_H * 0.38);
  ctx.lineTo(WORLD_W * 0.28, WORLD_H * 0.4);
  ctx.lineTo(WORLD_W * 0.5, WORLD_H * 0.55);
  ctx.lineTo(WORLD_W * 0.72, WORLD_H * 0.32); // Großer Vulkan
  ctx.lineTo(WORLD_W * 0.77, WORLD_H * 0.33);
  ctx.lineTo(WORLD_W, WORLD_H * 0.68);
  ctx.lineTo(WORLD_W, WORLD_H);
  ctx.lineTo(0, WORLD_H);
  ctx.closePath();
  ctx.fill();

  // Krater-Glut-Schein auf dem großen Vulkan
  const vx = WORLD_W * 0.745;
  const vy = WORLD_H * 0.325;
  const craterGlow = ctx.createRadialGradient(vx, vy, 0, vx, vy, 110);
  craterGlow.addColorStop(0, "rgba(255, 120, 20, 0.75)");
  craterGlow.addColorStop(0.4, "rgba(230, 60, 10, 0.35)");
  craterGlow.addColorStop(1, "rgba(255, 60, 0, 0)");
  ctx.fillStyle = craterGlow;
  ctx.beginPath();
  ctx.arc(vx, vy, 110, 0, Math.PI * 2);
  ctx.fill();

  // Magma-Adern & Lava-Risse im unteren Bereich
  for (let c = 0; c < 5; c++) {
    let px = (c + 0.5) * (WORLD_W / 5) + (rng() - 0.5) * 120;
    let py = WORLD_H * 0.85;
    ctx.strokeStyle = "rgba(255, 140, 20, 0.5)";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(px, WORLD_H);
    for (let s = 0; s < 4; s++) {
      px += (rng() - 0.5) * 80;
      py -= 35 + rng() * 25;
      ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Glühender Kern der Ader
    ctx.strokeStyle = "rgba(255, 230, 120, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Aufsteigende Glut- & Asche-Partikel
  for (let i = 0; i < 90; i++) {
    const ex = rng() * WORLD_W;
    const ey = rng() * WORLD_H;
    const er = 1.2 + rng() * 2.8;
    const isBright = rng() > 0.4;
    ctx.fillStyle = isBright ? "rgba(255, 180, 40, 0.75)" : "rgba(255, 75, 20, 0.6)";
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
  }


  // Magma-Boden-Glühen am unteren Bildschirmrand
  const bottomGlow = ctx.createLinearGradient(0, WORLD_H - 120, 0, WORLD_H);
  bottomGlow.addColorStop(0, "rgba(255, 60, 0, 0)");
  bottomGlow.addColorStop(0.7, "rgba(220, 50, 10, 0.25)");
  bottomGlow.addColorStop(1, "rgba(255, 100, 20, 0.45)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, WORLD_H - 120, WORLD_W, 120);
}

/** Fügt den gewählten Hintergrund hinter alle Spielelemente ein. */
export function addBackground(scene: Phaser.Scene, theme: BackgroundTheme = "paper") {
  ensureBackgroundTexture(scene, theme);
  const key = getTextureKey(theme);
  if (!scene.textures.exists(key)) return;
  scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.paper);
}

/** Abwärtskompatible Funktion für den klassischen Notizpapier-Hintergrund */
export function addPaper(scene: Phaser.Scene) {
  addBackground(scene, "paper");
}
