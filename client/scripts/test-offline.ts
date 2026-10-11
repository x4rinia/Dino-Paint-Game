import { validateLevel } from "@sketchquest/shared";
import { DEFAULT_STARTER_LEVELS, starterLevelTutorial, starterLevelPortals, starterLevelAllColors } from "../src/storage/starterLevels.js";
import fs from "fs";
import path from "path";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

console.log("=== Dino Draw: PWA- und Offline-Validierungstests ===\n");

test("Starter-Level 1 (Tutorial) ist valide und beatable", () => {
  const res = validateLevel(starterLevelTutorial);
  if (!res.reachable) throw new Error("Tutorial level validation report: " + res.report.join(" | "));
  if (starterLevelTutorial.collectibles.length !== 2) throw new Error("Tutorial level needs 2 eggs");
  if (starterLevelTutorial.bouncers.length !== 1) throw new Error("Tutorial level needs 1 bouncer");
});

test("Starter-Level 2 (Portale) ist valide mit gepaarten Teleportern", () => {
  const res = validateLevel(starterLevelPortals);
  if (!res.reachable) throw new Error("Portal level validation report: " + res.report.join(" | "));
  if (starterLevelPortals.teleporters.length !== 2) throw new Error("Portal level needs 2 teleporters");
  const pA = starterLevelPortals.teleporters[0];
  const pB = starterLevelPortals.teleporters[1];
  if (pA.targetId !== pB.id || pB.targetId !== pA.id) throw new Error("Teleporter pair mismatch");
});

test("Starter-Level 3 (Die 6 Farben-Arena) enthält alle 6 Spielmechaniken", () => {
  const res = validateLevel(starterLevelAllColors);
  if (!res.reachable) throw new Error("All-colors arena validation report: " + res.report.join(" | "));
  if (starterLevelAllColors.platforms.length === 0) throw new Error("Needs black platforms");
  if (starterLevelAllColors.hazards.length === 0) throw new Error("Needs red hazards");
  if (starterLevelAllColors.bouncers.length === 0) throw new Error("Needs green trampolines");
  if (starterLevelAllColors.movers.length === 0) throw new Error("Needs blue movers");
  if (starterLevelAllColors.collectibles.length === 0) throw new Error("Needs yellow collectibles");
  if (starterLevelAllColors.teleporters.length === 0 && starterLevelAllColors.movingPlatforms.length === 0) {
    throw new Error("Needs purple moving platforms or teleporters");
  }
});

test("PWA Web Manifest ist vorhanden und valide", () => {
  const manifestPath = path.resolve(process.cwd(), "client/public/manifest.webmanifest");
  if (!fs.existsSync(manifestPath)) throw new Error("manifest.webmanifest fehlt!");
  const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (content.name !== "Dino Paint Game") throw new Error("Manifest Name falsch");
  if (content.display !== "standalone") throw new Error("Manifest display muss standalone sein");
  if (!content.icons || content.icons.length < 4) throw new Error("Mindestens 4 Icons erwartet");
});

test("PWA App-Icons existieren und sind nicht leer", () => {
  const iconFiles = [
    "client/public/icons/icon-192.png",
    "client/public/icons/icon-512.png",
    "client/public/icons/icon-maskable-512.png",
    "client/public/icons/apple-touch-icon.png",
    "client/public/favicon.svg",
  ];
  for (const f of iconFiles) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) throw new Error(`Icon fehlt: ${f}`);
    const stat = fs.statSync(p);
    if (stat.size < 50) throw new Error(`Icondatei ist verdächtig klein: ${f}`);
  }
});

test("Service Worker ist vorhanden und definiert Offline-Caching", () => {
  const swPath = path.resolve(process.cwd(), "client/public/sw.js");
  if (!fs.existsSync(swPath)) throw new Error("sw.js fehlt!");
  const code = fs.readFileSync(swPath, "utf-8");
  if (!code.includes("addEventListener(\"install\"")) throw new Error("install handler fehlt");
  if (!code.includes("addEventListener(\"fetch\"")) throw new Error("fetch handler fehlt");
  if (!code.includes("caches.open")) throw new Error("Cache API fehlt");
});

test("Client Build-Distributable existiert und hat relative Pfade", () => {
  const indexPath = path.resolve(process.cwd(), "client/dist/index.html");
  if (!fs.existsSync(indexPath)) throw new Error("client/dist/index.html fehlt!");
  const html = fs.readFileSync(indexPath, "utf-8");
  if (!html.includes('src="./assets/')) throw new Error("Assets müssen relative Pfade (./assets/) haben");
  if (!html.includes('href="./manifest.webmanifest"')) throw new Error("Manifest-Link fehlt im HTML");
});

console.log("\nAlle 7 Offline- und PWA-Validierungstests erfolgreich bestanden!");
