import assert from "node:assert/strict";
import {
  analyzeDrawing,
  classifyPixel,
  rgbToHsv,
  validateLevel,
  LevelSchema,
  type PixelData,
} from "@sketchquest/shared";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    throw err;
  }
}

console.log("=== Dino Draw: Tests für Farberkennung und Levelgenerierung ===\n");

// 1. Farbraum & Pixel-Klassifikation
test("rgbToHsv konvertiert RGB-Werte präzise in HSV", () => {
  const [hRed, sRed, vRed] = rgbToHsv(255, 0, 0);
  assert.equal(hRed, 0);
  assert.equal(sRed, 1);
  assert.equal(vRed, 1);

  const [hGreen, sGreen, vGreen] = rgbToHsv(0, 255, 0);
  assert.equal(hGreen, 120);
  assert.equal(sGreen, 1);
  assert.equal(vGreen, 1);

  const [hBlue, sBlue, vBlue] = rgbToHsv(0, 0, 255);
  assert.equal(hBlue, 240);
  assert.equal(sBlue, 1);
  assert.equal(vBlue, 1);
});

test("classifyPixel erkennt die sechs Spielfarben und Papierhintergrund deterministisch", () => {
  // Schwarz (Marker, Bleistift, dunkle Linien)
  assert.equal(classifyPixel(20, 20, 25), "black");
  assert.equal(classifyPixel(45, 45, 50), "black");

  // Weiß / Papier / Hintergrund
  assert.equal(classifyPixel(255, 255, 255), "background");
  assert.equal(classifyPixel(245, 240, 230), "background"); // warmes Papier

  // Rot (Gefahren)
  assert.equal(classifyPixel(220, 40, 40), "red");
  assert.equal(classifyPixel(180, 30, 20), "red");

  // Grün (Trampoline)
  assert.equal(classifyPixel(40, 190, 60), "green");
  assert.equal(classifyPixel(30, 150, 45), "green");

  // Blau (Bewegliche Physikobjekte)
  assert.equal(classifyPixel(35, 100, 240), "blue");
  assert.equal(classifyPixel(20, 70, 190), "blue");

  // Gelb (Sammelobjekte)
  assert.equal(classifyPixel(245, 200, 20), "yellow");
  assert.equal(classifyPixel(255, 220, 30), "yellow");

  // Lila (Teleporter)
  assert.equal(classifyPixel(155, 60, 210), "purple");
  assert.equal(classifyPixel(130, 40, 180), "purple");
});

// 2. Synthetisches Zeichnungs-Bild mit allen 4 Elementen
function createSyntheticDrawing(): PixelData {
  const width = 640;
  const height = 360;
  const data = new Uint8Array(width * height * 4);

  // Weißer Papierhintergrund
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 250;     // R
    data[i + 1] = 248; // G
    data[i + 2] = 242; // B
    data[i + 3] = 255; // A
  }

  function fillBox(x0: number, y0: number, w: number, h: number, r: number, g: number, b: number) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const idx = (y * width + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
      }
    }
  }

  // 1. Schwarze Plattform (Boden links)
  fillBox(40, 300, 200, 30, 25, 25, 25);

  // 2. Schwarze Plattform (Boden rechts)
  fillBox(380, 300, 220, 30, 25, 25, 25);

  // 3. Rote Gefahr (Stacheln in der Mitte)
  fillBox(260, 310, 60, 20, 220, 35, 35);

  // 4. Grünes Trampolin (Sprungfläche vor der Lücke)
  fillBox(200, 290, 50, 15, 35, 180, 55);

  // 5. Blauer beweglicher Physikblock
  fillBox(420, 240, 40, 40, 35, 110, 235);

  // 6. Gelbes Sammelobjekt (Dino-Ei in der Luft)
  fillBox(150, 180, 24, 24, 250, 215, 25);

  // 7. Lila Teleporter Portal 1 (auf linker Plattform)
  fillBox(90, 240, 25, 45, 155, 60, 210);

  // 8. Lila Teleporter Portal 2 (auf rechter Plattform)
  fillBox(500, 240, 25, 45, 155, 60, 210);

  return { width, height, data };
}

test("analyzeDrawing erzeugt valide Plattformen, Gefahren, Trampoline, Blöcke, Eier und Portale", () => {
  const drawing = createSyntheticDrawing();
  const result = analyzeDrawing(drawing, { name: "Test-Zeichnung" });

  assert.ok(result.level, "Level muss erzeugt werden");
  assert.equal(result.level.version, 2);

  // Plattformen vorhanden
  assert.ok(result.level.platforms.length >= 2, `Mindestens 2 Plattformen erwartet, erhalten: ${result.level.platforms.length}`);

  // Gefahren (Rot) erkannt
  assert.ok(result.level.hazards.length >= 1, `Mindestens 1 Gefahr erwartet, erhalten: ${result.level.hazards.length}`);
  assert.equal(result.level.hazards[0].type, "spike");

  // Trampoline (Grün) erkannt
  assert.ok((result.level.bouncers ?? []).length >= 1, `Mindestens 1 Trampolin erwartet, erhalten: ${result.level.bouncers?.length}`);

  // Bewegliche Objekte (Blau) erkannt
  assert.ok((result.level.movers ?? []).length >= 1, `Mindestens 1 Block erwartet, erhalten: ${result.level.movers?.length}`);

  // Sammelobjekte (Gelb) erkannt
  assert.ok((result.level.collectibles ?? []).length >= 1, `Mindestens 1 Sammelobjekt erwartet, erhalten: ${result.level.collectibles?.length}`);
  assert.equal(result.level.collectibles![0].type, "egg");

  // Teleporter (Lila) erkannt und paarweise verknüpft
  assert.equal((result.level.teleporters ?? []).length, 2, `Genau 2 Teleporter erwartet, erhalten: ${result.level.teleporters?.length}`);
  const [t1, t2] = result.level.teleporters!;
  assert.equal(t1.pairIndex, 1, "Teleporter 1 muss pairIndex 1 haben");
  assert.equal(t2.pairIndex, 1, "Teleporter 2 muss pairIndex 1 haben");
  assert.equal(t1.targetId, t2.id, "Teleporter 1 muss auf Teleporter 2 zielen");
  assert.equal(t2.targetId, t1.id, "Teleporter 2 muss auf Teleporter 1 zielen");

  // Zod-Schema-Validierung
  const parsed = LevelSchema.safeParse(result.level);
  assert.ok(parsed.success, "Level muss LevelSchema entsprechen");

  // Start und Ziel liegen im Spielfeldbereich
  assert.ok(result.level.start.x >= 0 && result.level.start.x <= 1000);
  assert.ok(result.level.start.y >= 0 && result.level.start.y <= 1000);
  assert.ok(result.level.goal.x >= 0 && result.level.goal.x <= 1000);

  console.log(`  Statistik: ${result.stats.platformsCount} Plattformen, ${result.stats.hazardsCount} Gefahren, ${result.stats.bouncersCount} Trampoline, ${result.stats.moversCount} Blöcke, ${result.stats.collectiblesCount} Eier, ${result.stats.teleportersCount} Portale in ${result.stats.durationMs}ms`);
});

test("analyzeDrawing toleriert leere Zeichnungen mit automatischem Sicherheitsboden", () => {
  const emptyDrawing: PixelData = {
    width: 300,
    height: 200,
    data: new Uint8Array(300 * 200 * 4).fill(255),
  };

  const result = analyzeDrawing(emptyDrawing, { name: "Leeres Blatt" });
  assert.ok(result.level.platforms.length >= 1, "Sicherheits-Boden muss erzeugt werden");
  assert.equal(result.level.platforms[0].id, "ground-auto");
});

test("Reachability-Validator bewertet das generierte Level positiv", () => {
  const drawing = createSyntheticDrawing();
  const result = analyzeDrawing(drawing);
  const val = validateLevel(result.level);

  assert.equal(val.reachable, true, `Level sollte lösbar sein. Bericht: ${val.report.join(", ")}`);
});

console.log("\nAlle 5 Farberkennungs- und Pipeline-Tests erfolgreich bestanden!\n");
