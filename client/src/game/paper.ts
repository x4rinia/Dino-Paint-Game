import Phaser from "phaser";
import { WORLD_H, WORLD_W } from "@sketchquest/shared";
import { makeRng } from "./sketch";
import { DEPTH } from "./palette";

export type BackgroundTheme = "paper" | "jungle" | "space";

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
    name: "Notizheft",
    subtitle: "Klassisches liniertes Heftpapier (Standard)",
    icon: "📜",
    color: "#f7f2e3",
  },
  {
    id: "jungle",
    name: "Urzeit-Dschungel",
    subtitle: "Prähistorische Natur & sanfte Palmen",
    icon: "🌴",
    color: "#e2ede2",
  },
  {
    id: "space",
    name: "Kosmische Nacht",
    subtitle: "Sternenhimmel, Mond & Galaxie",
    icon: "🌌",
    color: "#181f38",
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
 * Erzeugt eine der 3 wählbaren Hintergrund-Texturen für Phaser:
 * 1. "paper": Klassisches Notizheft mit roten und blauen Linien
 * 2. "jungle": Malerischer Urzeit-Dschungel mit Farnen, Bergen & Sonnenlicht
 * 3. "space": Kosmische Nacht mit funkelnden Sternen & Sichelmond
 */
function ensureBackgroundTexture(scene: Phaser.Scene, theme: BackgroundTheme) {
  const key = getTextureKey(theme);
  if (scene.textures.exists(key)) return;

  const tex = scene.textures.createCanvas(key, WORLD_W, WORLD_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const rng = makeRng(theme === "paper" ? 0x5ce7c4 : theme === "jungle" ? 0x7ab941 : 0x1f3c88);

  if (theme === "paper") {
    drawPaperTexture(ctx, rng);
  } else if (theme === "jungle") {
    drawJungleTexture(ctx, rng);
  } else if (theme === "space") {
    drawSpaceTexture(ctx, rng);
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

/** 2. Urzeit-Dschungel (Prähistorische Naturwelt) */
function drawJungleTexture(ctx: CanvasRenderingContext2D, rng: () => number) {
  // Himmel / Dunst: weicher Farbverlauf von Mint zu sonnigem Hellgrün
  const skyGrad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  skyGrad.addColorStop(0, "#d8ece0");
  skyGrad.addColorStop(0.5, "#e7f3e8");
  skyGrad.addColorStop(1, "#f3f8eb");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Sonnenschein / Sonnenkegel von oben rechts
  const sunGrad = ctx.createRadialGradient(WORLD_W * 0.82, WORLD_H * 0.15, 0, WORLD_W * 0.82, WORLD_H * 0.15, 600);
  sunGrad.addColorStop(0, "rgba(255, 245, 175, 0.35)");
  sunGrad.addColorStop(0.5, "rgba(255, 245, 175, 0.12)");
  sunGrad.addColorStop(1, "rgba(255, 245, 175, 0)");
  ctx.fillStyle = sunGrad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Entfernte Urzeit-Berg- & Vulkansilhouetten im Hintergrund
  ctx.fillStyle = "rgba(110, 165, 130, 0.16)";
  ctx.beginPath();
  ctx.moveTo(0, WORLD_H * 0.72);
  ctx.quadraticCurveTo(WORLD_W * 0.25, WORLD_H * 0.52, WORLD_W * 0.45, WORLD_H * 0.74);
  ctx.quadraticCurveTo(WORLD_W * 0.7, WORLD_H * 0.48, WORLD_W, WORLD_H * 0.7);
  ctx.lineTo(WORLD_W, WORLD_H);
  ctx.lineTo(0, WORLD_H);
  ctx.closePath();
  ctx.fill();

  // Nähere sanfte Dschungelhügel
  ctx.fillStyle = "rgba(75, 145, 95, 0.14)";
  ctx.beginPath();
  ctx.moveTo(0, WORLD_H * 0.84);
  ctx.quadraticCurveTo(WORLD_W * 0.35, WORLD_H * 0.68, WORLD_W * 0.6, WORLD_H * 0.86);
  ctx.quadraticCurveTo(WORLD_W * 0.85, WORLD_H * 0.72, WORLD_W, WORLD_H * 0.82);
  ctx.lineTo(WORLD_W, WORLD_H);
  ctx.lineTo(0, WORLD_H);
  ctx.closePath();
  ctx.fill();

  // Feine stilisierte Palmen- und Farnblätter an den oberen Rändern
  ctx.strokeStyle = "rgba(46, 125, 50, 0.28)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // Farn links oben
  for (let i = 0; i < 4; i++) {
    const angle = 0.2 + i * 0.25;
    const len = 180 + i * 40;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const endX = Math.cos(angle) * len;
    const endY = Math.sin(angle) * len;
    ctx.quadraticCurveTo(endX * 0.6, endY * 0.2, endX, endY);
    ctx.stroke();

    // Kleine Blättchen
    for (let f = 30; f < len; f += 25) {
      const px = Math.cos(angle) * f;
      const py = Math.sin(angle) * f;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 12, py - 10);
      ctx.stroke();
    }
  }

  // Farn rechts oben
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI - (0.2 + i * 0.3);
    const len = 160 + i * 35;
    ctx.beginPath();
    ctx.moveTo(WORLD_W, 0);
    const endX = WORLD_W + Math.cos(angle) * len;
    const endY = Math.sin(angle) * len;
    ctx.quadraticCurveTo(WORLD_W + (endX - WORLD_W) * 0.6, endY * 0.2, endX, endY);
    ctx.stroke();
  }

  // Zarte Orientierungs-Rasterlinien im handgemalten Stil
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(70, 140, 90, 0.18)";
  for (let y = FIRST_LINE_Y; y < WORLD_H; y += LINE_GAP) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 40; x <= WORLD_W + 40; x += 40) ctx.lineTo(x, y + (rng() - 0.5) * 1.0);
    ctx.stroke();
  }

  // Dschungel-Vignette
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const vig = ctx.createRadialGradient(cx, cy, WORLD_H * 0.45, cx, cy, WORLD_W * 0.65);
  vig.addColorStop(0, "rgba(40, 90, 50, 0)");
  vig.addColorStop(1, "rgba(25, 75, 40, 0.18)");
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

  // Feine Blueprint-Rasterlinien zur Orientierung für Sprünge
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = "rgba(100, 150, 240, 0.16)";
  for (let y = FIRST_LINE_Y; y < WORLD_H; y += LINE_GAP) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 40; x <= WORLD_W + 40; x += 40) ctx.lineTo(x, y + (rng() - 0.5) * 0.8);
    ctx.stroke();
  }

  // Kosmische Vignette
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  const vig = ctx.createRadialGradient(cx, cy, WORLD_H * 0.45, cx, cy, WORLD_W * 0.65);
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(1, "rgba(5, 7, 15, 0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
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
