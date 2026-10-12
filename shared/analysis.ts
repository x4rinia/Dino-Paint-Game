import {
  LevelSchema,
  type Bouncer,
  type Collectible,
  type Hazard,
  type Level,
  type Mover,
  type Platform,
  type Teleporter,
  type MovingPlatform,
  type Enemy,
} from "./level";

/**
 * Dino Draw Your Game – Lokale Offline-Farberkennung & Physik-Extraktion
 *
 * Die 4 Grundfarben:
 * - SCHWARZ: Feste Plattformen, Böden, Wände (statische Physik)
 * - ROT:     Tödliche Gefahren, Hindernisse (Stacheln / Lava)
 * - GRÜN:    Sprungflächen / Trampoline (katapultiert Spieler nach oben)
 * - BLAU:    Bewegliche Physikobjekte (reagieren auf Schwerkraft & Stöße)
 *
 * Hintergrund: Weiß / Transparent / Helles Papier (keine Kollision)
 */

export type ColorClass = "background" | "black" | "red" | "green" | "blue" | "yellow" | "purple" | "brown" | "orange";

export type PixelData = {
  width: number;
  height: number;
  /** RGBA pixel buffer (Uint8Array oder Uint8ClampedArray) */
  data: Uint8Array | Uint8ClampedArray;
};

export type AnalysisOptions = {
  name?: string;
  gridWidth?: number;  // Ziel-Auflösung für Analyse, Standard z.B. 400
  gridHeight?: number; // Standard z.B. 225 (16:9 Verhältnis)
  minComponentPixels?: number; // Filtert kleine Störungen/Punkte heraus
  customStart?: { x: number; y: number }; // Manuell gesetzter Startpunkt (0-1000)
  customGoal?: { x: number; y: number };  // Manuell gesetzter Zielpunkt (0-1000)
};

export type AnalysisResult = {
  level: Level;
  debugOverlayPng?: string; // Optional: farbcodierte Vorschau
  stats: {
    platformsCount: number;
    hazardsCount: number;
    bouncersCount: number;
    moversCount: number;
    collectiblesCount: number;
    teleportersCount: number;
    movingPlatformsCount: number;
    enemiesCount: number;
    durationMs: number;
  };
};

/**
 * RGB -> HSV Konvertierung
 * r, g, b in [0..255]
 * H: 0..360, S: 0..1, V: 0..1
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;

  let h = 0;
  if (delta > 0.0001) {
    if (max === rf) {
      h = ((gf - bf) / delta) % 6;
    } else if (max === gf) {
      h = (bf - rf) / delta + 2;
    } else {
      h = (rf - gf) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return [h, s, v];
}

/**
 * Klassifiziert einen einzelnen Pixel in eine der vier Spielfarben oder Hintergrund.
 * Berücksichtigt Helligkeitsschwankungen und ungleichmäßige Ausleuchtung.
 */
export function classifyPixel(
  r: number,
  g: number,
  b: number,
  a = 255,
  paperBrightnessThreshold = 0.65
): ColorClass {
  // Transparente Pixel sind Hintergrund
  if (a < 50) return "background";

  const [h, s, v] = rgbToHsv(r, g, b);

  // 1. SCHWARZ: Geringe Sättigung, sehr dunkel
  // Auch weiche Bleistiftstriche oder Schatten von schwarzem Marker erkennen
  if (v < 0.32 || (s < 0.28 && v < 0.45)) {
    return "black";
  }

  // 2. HINTERGRUND: Helles Papier / weiß
  if (s < 0.22 && v >= paperBrightnessThreshold) {
    return "background";
  }

  // 3. FARBIGE ELEMENTE (Gelb, Blau, Grün, Rot, Lila)
  // Überprüfe Farbton (Hue) und relative Kanalstärken für maximale Robustheit
  const diffRG = r - g;
  const diffRB = r - b;
  const diffGR = g - r;
  const diffGB = g - b;
  const diffBR = b - r;
  const diffBG = b - g;

  // GELB: Hue 35° - 72° (und gesättigt / hell) ODER Rot & Grün stark, Blau schwach
  if (
    (s > 0.25 && h >= 35 && h <= 72 && v > 0.32) ||
    (r > 120 && g > 110 && b < Math.min(r, g) - 30)
  ) {
    return "yellow";
  }

  // LILA / VIOLETT: Hue 266° - 335° (gesättigt) ODER Rot & Blau dominant über Grün
  if (
    (s > 0.20 && h >= 266 && h <= 335 && v > 0.22) ||
    (r > 70 && b > 80 && g < Math.max(r, b) - 25)
  ) {
    return "purple";
  }

  // BLAU: Hue 180° - 265° ODER Blaukanal dominiert deutlich
  if (
    (s > 0.22 && h >= 180 && h <= 265 && v > 0.22) ||
    (b > 70 && diffBR > 30 && diffBG > 20)
  ) {
    return "blue";
  }

  // GRÜN: Hue 73° - 175° ODER Grünkanal dominiert
  if (
    (s > 0.20 && h >= 73 && h <= 175 && v > 0.22) ||
    (g > 65 && diffGR > 25 && diffGB > 15)
  ) {
    return "green";
  }

  // ORANGE: Hue 14° - 38°, hohe Sättigung & HELL (v >= 0.60, r >= 175) -> Bewegliche Gegner
  if (
    (s > 0.45 && h >= 14 && h <= 38 && v >= 0.60) ||
    (r >= 180 && g >= 55 && g < r - 25 && b < 85)
  ) {
    return "orange";
  }

  // BRAUN: Hue 12° - 42°, dunkleres bis mittleres V (v < 0.60, r < 180) -> Bewegliche Lifte
  if (
    (s > 0.22 && h >= 12 && h <= 42 && v >= 0.16 && v < 0.60) ||
    (r >= 60 && r < 180 && g >= 25 && g < r && b < g - 10)
  ) {
    return "brown";
  }

  // ROT: Hue 336° - 360° oder 0° - 34° ODER Rotkanal dominiert
  if (
    (s > 0.25 && (h >= 336 || h <= 34) && v > 0.25) ||
    (r > 75 && diffRG > 35 && diffRB > 35)
  ) {
    return "red";
  }

  // Dunklere Töne mit geringer Sättigung -> Schwarz Plattform
  if (v < 0.50 && s < 0.35) {
    return "black";
  }

  // Alles andere gilt als Papierhintergrund
  return "background";
}

/**
 * Abtastung des Quellbildes auf ein Arbeitsgitter (Grid).
 * Führt lokale Rauschfilterung durch.
 */
export function sampleToGrid(
  image: PixelData,
  gridW = 320,
  gridH = 180
): Uint8Array {
  const grid = new Uint8Array(gridW * gridH); // 0=bg, 1=black, 2=red, 3=green, 4=blue, 5=yellow, 6=purple, 7=brown, 8=orange
  const scaleX = image.width / gridW;
  const scaleY = image.height / gridH;

  // Schnelle Hintergrund-Helligkeitsanalyse (Median/Durchschnitt der hellen Pixel)
  let sumBrightV = 0;
  let countBright = 0;
  const step = Math.max(1, Math.floor((image.width * image.height) / 5000));
  for (let i = 0; i < image.data.length; i += step * 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const [, s, v] = rgbToHsv(r, g, b);
    if (s < 0.25 && v > 0.5) {
      sumBrightV += v;
      countBright++;
    }
  }
  const paperThreshold = countBright > 50 ? Math.max(0.55, (sumBrightV / countBright) * 0.8) : 0.65;

  for (let gy = 0; gy < gridH; gy++) {
    const srcY = Math.min(image.height - 1, Math.floor(gy * scaleY));
    for (let gx = 0; gx < gridW; gx++) {
      const srcX = Math.min(image.width - 1, Math.floor(gx * scaleX));
      const idx = (srcY * image.width + srcX) * 4;

      const r = image.data[idx];
      const g = image.data[idx + 1];
      const b = image.data[idx + 2];
      const a = image.data[idx + 3];

      const c = classifyPixel(r, g, b, a, paperThreshold);
      let val = 0;
      if (c === "black") val = 1;
      else if (c === "red") val = 2;
      else if (c === "green") val = 3;
      else if (c === "blue") val = 4;
      else if (c === "yellow") val = 5;
      else if (c === "purple") val = 6;
      else if (c === "brown") val = 7;
      else if (c === "orange") val = 8;

      grid[gy * gridW + gx] = val;
    }
  }

  // 1-Pass Rauschfilter (Eliminiere isolierte Einzelpixel)
  const cleaned = new Uint8Array(grid);
  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      const cur = grid[gy * gridW + gx];
      if (cur === 0) continue;
      // Zähle gleichfarbige Nachbarn
      let sameNeighbors = 0;
      if (grid[(gy - 1) * gridW + gx] === cur) sameNeighbors++;
      if (grid[(gy + 1) * gridW + gx] === cur) sameNeighbors++;
      if (grid[gy * gridW + (gx - 1)] === cur) sameNeighbors++;
      if (grid[gy * gridW + (gx + 1)] === cur) sameNeighbors++;

      if (sameNeighbors === 0) {
        cleaned[gy * gridW + gx] = 0; // Einzelnes Rauschpixel entfernen
      }
    }
  }

  // 2. Intelligentes Rand-Snapping: Wenn gezeichnete Striche fast den Boden oder die Seitenwände berühren (1-3 Pixel Abstand),
  // verlängere sie bis zur jeweiligen Kante, damit Böden und Wände in Ecken nahtlos abschließen.
  // (Der Himmel gy <= 3 bleibt offen, damit die Spielwelt niemals in Fels versinkt!)
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const val = grid[gy * gridW + gx];
      if (val === 1) { // Feste schwarze Plattform-Striche
        if (gy >= gridH - 4) {
          for (let y = gy + 1; y < gridH; y++) cleaned[y * gridW + gx] = 1;
        }
        if (gx <= 3) {
          for (let x = 0; x < gx; x++) cleaned[gy * gridW + x] = 1;
        }
        if (gx >= gridW - 4) {
          for (let x = gx + 1; x < gridW; x++) cleaned[gy * gridW + x] = 1;
        }
      }
    }
  }

  return cleaned;
}

type Component = {
  color: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  pixelCount: number;
  pixels: Array<[number, number]>;
};

/**
 * Findet zusammenhängende Farbflächen mittels Flood-Fill
 */
export function findConnectedComponents(
  grid: Uint8Array,
  w: number,
  h: number,
  minPixels = 6
): Component[] {
  const visited = new Uint8Array(w * h);
  const components: Component[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const color = grid[idx];
      if (color === 0 || visited[idx] !== 0) continue;

      // Neuer zusammenhängender Bereich
      visited[idx] = 1;
      const queue: Array<[number, number]> = [[x, y]];
      const pixels: Array<[number, number]> = [[x, y]];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        const neighbors: Array<[number, number]> = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nidx = ny * w + nx;
            if (visited[nidx] === 0 && grid[nidx] === color) {
              visited[nidx] = 1;
              pixels.push([nx, ny]);
              queue.push([nx, ny]);
              if (nx < minX) minX = nx;
              if (nx > maxX) maxX = nx;
              if (ny < minY) minY = ny;
              if (ny > maxY) maxY = ny;
            }
          }
        }
      }

      if (pixels.length >= minPixels) {
        components.push({
          color,
          minX,
          minY,
          maxX,
          maxY,
          pixelCount: pixels.length,
          pixels,
        });
      }
    }
  }

  return components;
}

/**
 * Schließt Hohlräume innerhalb von gezeichneten Kästchen/Rahmen.
 * Wenn ein Spieler die 4 Kanten einer Plattform zeichnet, wird der Innenraum
 * als solide Plattform gefüllt, anstatt in Dutzende Holzlatten zu zerfallen.
 */
function fillComponentHoles(comp: Component, gridW = 320, gridH = 180): void {
  const width = comp.maxX - comp.minX + 1;
  const height = comp.maxY - comp.minY + 1;
  if (width < 4 || height < 4) return;

  // Niemals einen Vollbild-Rahmen füllen (verhindert das Versinken der Spielwelt im Fels)
  if (width >= gridW - 6 && height >= gridH - 6) {
    return;
  }

  const lw = width + 2;
  const lh = height + 2;
  const local = new Uint8Array(lw * lh);

  for (const [px, py] of comp.pixels) {
    const lx = px - comp.minX + 1;
    const ly = py - comp.minY + 1;
    local[ly * lw + lx] = 1;
  }

  // Kleine 1-Pixel Lücken an Ecken schließen, damit Flood-Fill nicht ausläuft
  const closed = new Uint8Array(local);
  for (let ly = 1; ly <= height; ly++) {
    for (let lx = 1; lx <= width; lx++) {
      if (local[ly * lw + lx] === 0) {
        const nU = local[(ly - 1) * lw + lx];
        const nD = local[(ly + 1) * lw + lx];
        const nL = local[ly * lw + (lx - 1)];
        const nR = local[ly * lw + (lx + 1)];
        if ((nU && nL) || (nU && nR) || (nD && nL) || (nD && nR)) {
          closed[ly * lw + lx] = 1;
        }
      }
    }
  }

  // Boden und Seitenwände schließen ab (Himmel bleibt offen!)
  const touchesBottom = comp.maxY >= gridH - 3;
  const touchesLeft = comp.minX <= 2;
  const touchesRight = comp.maxX >= gridW - 3;

  if (touchesBottom) {
    for (let lx = 1; lx <= width; lx++) closed[(height + 1) * lw + lx] = 1;
  }
  if (touchesLeft) {
    for (let ly = 1; ly <= height; ly++) closed[ly * lw + 0] = 1;
  }
  if (touchesRight) {
    for (let ly = 1; ly <= height; ly++) closed[ly * lw + (width + 1)] = 1;
  }

  // Flood-Fill von allen noch offenen Außenrandpixeln
  const outside = new Uint8Array(lw * lh);
  const queue: Array<[number, number]> = [];

  for (let lx = 0; lx < lw; lx++) {
    if (closed[0 * lw + lx] === 0 && outside[0 * lw + lx] === 0) {
      outside[0 * lw + lx] = 1;
      queue.push([lx, 0]);
    }
    if (closed[(lh - 1) * lw + lx] === 0 && outside[(lh - 1) * lw + lx] === 0) {
      outside[(lh - 1) * lw + lx] = 1;
      queue.push([lx, lh - 1]);
    }
  }
  for (let ly = 0; ly < lh; ly++) {
    if (closed[ly * lw + 0] === 0 && outside[ly * lw + 0] === 0) {
      outside[ly * lw + 0] = 1;
      queue.push([0, ly]);
    }
    if (closed[ly * lw + (lw - 1)] === 0 && outside[ly * lw + (lw - 1)] === 0) {
      outside[ly * lw + (lw - 1)] = 1;
      queue.push([lw - 1, ly]);
    }
  }

  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    const neighbors: Array<[number, number]> = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < lw && ny >= 0 && ny < lh) {
        const nidx = ny * lw + nx;
        if (outside[nidx] === 0 && closed[nidx] === 0) {
          outside[nidx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  // Alle Pixel innerhalb der Bounding-Box, die nicht von außen erreichbar sind, gehören zum Kästchen!
  for (let ly = 1; ly <= height; ly++) {
    for (let lx = 1; lx <= width; lx++) {
      const idx = ly * lw + lx;
      if (outside[idx] === 0 && local[idx] === 0) {
        const gx = comp.minX + lx - 1;
        const gy = comp.minY + ly - 1;
        comp.pixels.push([gx, gy]);
      }
    }
  }
  comp.pixelCount = comp.pixels.length;
}

/**
 * Zerlegt zusammenhängende Pixel einer Komponente in minimale, rechteckige Physik-Kollisionsboxen.
 * Verhindert übermäßige Anzahl an Kollisionskörpern durch horizontales & vertikales Verschmelzen.
 */
export function decomposeComponentToRects(
  comp: Component,
  gridW: number,
  gridH: number
): Array<{ x: number; y: number; w: number; h: number }> {
  // 1. Innenraum geschlossener Konturen füllen – ABER NICHT bei schwarzen Wänden/Plattformen,
  // da im Labyrinth Striche als Wände gelten und nicht Räume mit Gestein gefüllt werden dürfen!
  if (comp.color !== 1) {
    fillComponentHoles(comp, gridW, gridH);
  }

  const width = comp.maxX - comp.minX + 1;
  const height = comp.maxY - comp.minY + 1;
  const fillRatio = comp.pixelCount / (width * height);
  const rawW = ((comp.maxX - comp.minX + 1) / gridW) * 1000;
  const rawH = ((comp.maxY - comp.minY + 1) / gridH) * 1000;

  // Wenn ein Interaktionsobjekt (Farben 3-8) vorliegt, oder ein kleiner kompakter Block:
  // Für schwarze Wände (color === 1) wird die exakte Linien-Segmentierung weiter unten genutzt!
  if (
    comp.color === 3 || // Grün (Trampolin)
    comp.color === 4 || // Blau (Physikblock)
    comp.color === 5 || // Gelb (Sammelobjekt)
    comp.color === 6 || // Lila (Teleporter-Portal)
    comp.color === 7 || // Braun (Bewegliche Plattform)
    comp.color === 8 || // Orange (Gegner)
    (comp.color !== 1 && fillRatio > 0.40) ||
    (width <= 8 && height <= 8)
  ) {
    if (comp.color === 5) {
      // Gelbes Sammelobjekt (z.B. Dino-Ei)
      return [
        {
          x: (comp.minX / gridW) * 1000,
          y: (comp.minY / gridH) * 1000,
          w: Math.max(20, Math.min(48, rawW)),
          h: Math.max(20, Math.min(48, rawH)),
        },
      ];
    }

    if (comp.color === 6) {
      // Lila Teleporter (Portal)
      return [
        {
          x: (comp.minX / gridW) * 1000,
          y: (comp.minY / gridH) * 1000,
          w: Math.max(25, Math.min(60, rawW)),
          h: Math.max(40, Math.min(90, rawH)),
        },
      ];
    }

    if (comp.color === 7) {
      // Braun: Bewegliche Plattform (Lift)
      return [
        {
          x: (comp.minX / gridW) * 1000,
          y: (comp.minY / gridH) * 1000,
          w: Math.max(24, rawW),
          h: Math.max(16, rawH),
        },
      ];
    }

    if (comp.color === 8) {
      // Orange: Gegner
      return [
        {
          x: (comp.minX / gridW) * 1000,
          y: (comp.minY / gridH) * 1000,
          w: Math.max(24, rawW),
          h: Math.max(24, rawH),
        },
      ];
    }

    // Schwarz (1) & Rot (2): Saubere Plattform oder Gefahr
    return [
      {
        x: (comp.minX / gridW) * 1000,
        y: (comp.minY / gridH) * 1000,
        w: Math.max(12, rawW),
        h: Math.max(12, rawH),
      },
    ];
  }

  // Für Plattformen, Wände und Spikes: Horizontale Segmente bilden und vertikal mergen
  const localGrid = new Uint8Array(width * height);
  for (const [px, py] of comp.pixels) {
    localGrid[(py - comp.minY) * width + (px - comp.minX)] = 1;
  }

  const spans: Array<{ x: number; y: number; w: number; h: number }> = [];
  const used = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (localGrid[y * width + x] === 1 && used[y * width + x] === 0) {
        // Finde maximale Breite des Segments
        let x2 = x;
        while (x2 + 1 < width && localGrid[y * width + (x2 + 1)] === 1 && used[y * width + (x2 + 1)] === 0) {
          x2++;
        }
        const spanW = x2 - x + 1;

        // Finde maximale Höhe, in der dieselbe Breite vorliegt
        let y2 = y;
        let canExtend = true;
        while (canExtend && y2 + 1 < height) {
          for (let k = x; k <= x2; k++) {
            if (localGrid[(y2 + 1) * width + k] !== 1 || used[(y2 + 1) * width + k] !== 0) {
              canExtend = false;
              break;
            }
          }
          if (canExtend) y2++;
        }

        const spanH = y2 - y + 1;
        for (let r = y; r <= y2; r++) {
          for (let c = x; c <= x2; c++) {
            used[r * width + c] = 1;
          }
        }

        spans.push({
          x: ((comp.minX + x) / gridW) * 1000,
          y: ((comp.minY + y) / gridH) * 1000,
          w: Math.max(10, (spanW / gridW) * 1000),
          h: Math.max(10, (spanH / gridH) * 1000),
        });
      }
    }
  }

  return spans.length > 0 ? spans : [
    {
      x: (comp.minX / gridW) * 1000,
      y: (comp.minY / gridH) * 1000,
      w: Math.max(12, ((comp.maxX - comp.minX + 1) / gridW) * 1000),
      h: Math.max(12, ((comp.maxY - comp.minY + 1) / gridH) * 1000),
    },
  ];
}

/**
 * Hauptfunktion: Analysiert ein Pixelbild lokal, deterministisch und ohne Cloud-Verbindung.
 * Erzeugt ein spielbares Dino Draw Your Game Level.
 */
export function analyzeDrawing(
  image: PixelData,
  options: AnalysisOptions = {}
): AnalysisResult {
  const startTime = Date.now();
  const gridW = options.gridWidth ?? 320;
  const gridH = options.gridHeight ?? 180;
  const minPixels = options.minComponentPixels ?? 5;

  const grid = sampleToGrid(image, gridW, gridH);
  const components = findConnectedComponents(grid, gridW, gridH, minPixels);

  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const bouncers: Bouncer[] = [];
  const movers: Mover[] = [];
  const collectibles: Collectible[] = [];
  const movingPlatforms: MovingPlatform[] = [];
  const rawTeleporters: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];
  const enemies: Enemy[] = [];

  let pId = 1;
  let hId = 1;
  let bId = 1;
  let mId = 1;
  let cId = 1;
  let tpId = 1;
  let liftId = 1;
  let enemyId = 1;

  for (const comp of components) {
    const rects = decomposeComponentToRects(comp, gridW, gridH);

    for (const r of rects) {
      if (comp.color === 1) {
        // Schwarz -> Plattform
        platforms.push({
          id: `plat-${pId++}`,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
        });
      } else if (comp.color === 2) {
        // Rot -> Gefahr
        hazards.push({
          id: `hazard-${hId++}`,
          type: "spike",
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
        });
      } else if (comp.color === 3) {
        // Grün -> Trampolin / Sprungfläche
        bouncers.push({
          id: `bounce-${bId++}`,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
        });
      } else if (comp.color === 4) {
        // Blau -> Bewegliches Physikobjekt
        movers.push({
          id: `mover-${mId++}`,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
        });
      } else if (comp.color === 5) {
        // Gelb -> Sammelobjekt (Dino-Ei)
        collectibles.push({
          id: `egg-${cId++}`,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
          type: "egg",
          collected: false,
        });
      } else if (comp.color === 6) {
        // Lila -> Teleporter-Portal
        rawTeleporters.push({
          id: `tp-${tpId++}`,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.w),
          h: Math.round(r.h),
        });
      } else if (comp.color === 7) {
        // Braun -> Bewegliche Plattform / Lift:
        // Breiter als hoch: fährt links <-> rechts
        // Höher als breit: fährt hoch <-> runter
        const rw = Math.round(r.w);
        const rh = Math.round(r.h);
        const isHorizontal = rw >= rh;
        const axis = isHorizontal ? "horizontal" : "vertical";
        const distance = Math.min(260, Math.max(120, Math.round((isHorizontal ? rw : rh) * 1.5)));
        movingPlatforms.push({
          id: `lift-${liftId++}`,
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: rw,
          h: rh,
          axis,
          distance,
          speed: 80,
        });
      } else if (comp.color === 8) {
        // Orange -> Beweglicher patrouillierender Gegner
        enemies.push({
          id: `enemy-${enemyId++}`,
          x: Math.round(r.x + r.w / 2),
          y: Math.round(r.y + r.h / 2),
          patrol: Math.max(40, Math.min(240, Math.round(r.w * 1.6))),
        });
      }
    }
  }

  // Lila Teleporter paarweise verknüpfen (1 <-> 2, 3 <-> 4, etc.)
  // Wenn ungerade oder nur 1 Portal: targetId bleibt undefined (agiert im Spiel als magischer Katapult-Vortex!)
  const teleporters: Teleporter[] = [];
  for (let i = 0; i < rawTeleporters.length; i++) {
    const tp = rawTeleporters[i];
    const pairIndex = Math.floor(i / 2);
    let targetId: string | undefined = undefined;
    if (i % 2 === 0 && i + 1 < rawTeleporters.length) {
      targetId = rawTeleporters[i + 1].id;
    } else if (i % 2 === 1) {
      targetId = rawTeleporters[i - 1].id;
    }
    teleporters.push({
      id: tp.id,
      x: tp.x,
      y: tp.y,
      w: tp.w,
      h: tp.h,
      targetId,
      pairIndex,
    });
  }

  // Standard-Boden hinzufügen, falls keine einzige Plattform oder Sprungfläche gezeichnet wurde
  if (platforms.length === 0 && bouncers.length === 0 && movingPlatforms.length === 0) {
    platforms.push({
      id: "ground-auto",
      x: 0,
      y: 920,
      w: 1000,
      h: 80,
    });
  }

  // Intelligente Positionierung von Start (S) und Ziel (Z)
  const standables = [...platforms, ...bouncers, ...movingPlatforms];
  standables.sort((a, b) => a.x - b.x);

  const startPlatform = standables[0] ?? { x: 50, y: 880, w: 200, h: 40 };
  const autoStartX = Math.min(900, Math.max(50, Math.round(startPlatform.x + Math.min(50, startPlatform.w / 2))));
  const autoStartY = Math.max(40, Math.round(startPlatform.y - 36));

  const rightmostPlatform = [...standables].sort((a, b) => (b.x + b.w) - (a.x + a.w))[0] ?? startPlatform;
  const autoGoalX = Math.min(950, Math.max(100, Math.round(rightmostPlatform.x + rightmostPlatform.w - 50)));
  const autoGoalY = Math.max(30, Math.round(rightmostPlatform.y - 70));

  const startX = options.customStart ? Math.round(options.customStart.x) : autoStartX;
  const startY = options.customStart ? Math.round(options.customStart.y) : autoStartY;

  const goalX = options.customGoal ? Math.round(options.customGoal.x) : autoGoalX;
  const goalY = options.customGoal ? Math.round(options.customGoal.y) : autoGoalY;

  const level: Level = LevelSchema.parse({
    version: 2,
    name: options.name || "Mein Dino-Level",
    intro: "Zeichnung erfolgreich analysiert!",
    quips: [],
    start: { x: startX, y: startY },
    goal: { id: "goal", x: goalX, y: goalY, w: 45, h: 70 },
    platforms,
    hazards,
    bouncers,
    movers,
    collectibles,
    teleporters,
    movingPlatforms,
    coins: [],
    enemies,
  });

  const durationMs = Date.now() - startTime;

  return {
    level,
    stats: {
      platformsCount: platforms.length,
      hazardsCount: hazards.length,
      bouncersCount: bouncers.length,
      moversCount: movers.length,
      collectiblesCount: collectibles.length,
      teleportersCount: teleporters.length,
      movingPlatformsCount: movingPlatforms.length,
      enemiesCount: enemies.length,
      durationMs,
    },
  };
}
