import type { Level, SavedLevelItem } from "@sketchquest/shared";

/**
 * 1. Dinos Erstes Abenteuer
 * Einsteigerfreundliches Tutorial-Level mit Plattformen, grünem Trampolin,
 * einem gelben Dino-Ei und Ziel.
 */
export const starterLevelTutorial: Level = {
  version: 2,
  name: "Dinos Erstes Abenteuer",
  intro: "Willkommen! Sammle das goldene Dino-Ei und hüpfe über das grüne Trampolin ins Ziel!",
  quips: [
    "Das Trampolin federt dich super nach oben!",
    "Vergiss nicht, das Ei einzusammeln!",
    "Ein Kinderspiel für einen echten Dino!",
  ],
  start: { x: 80, y: 880 },
  goal: { id: "goal", x: 920, y: 620, w: 48, h: 74 },
  platforms: [
    { id: "floor-1", x: 0, y: 920, w: 420, h: 80 },
    { id: "floor-2", x: 620, y: 920, w: 380, h: 80 },
    { id: "step-1", x: 260, y: 800, w: 140, h: 28 },
    { id: "step-2", x: 740, y: 720, w: 200, h: 28 },
  ],
  hazards: [
    { id: "hazard-1", type: "lava", x: 440, y: 950, w: 160, h: 30 },
  ],
  bouncers: [
    { id: "bounce-1", x: 470, y: 890, w: 100, h: 26 },
  ],
  movers: [],
  collectibles: [
    { id: "egg-1", x: 320, y: 740, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-2", x: 520, y: 620, w: 30, h: 30, type: "egg", collected: false },
  ],
  teleporters: [],
  movingPlatforms: [],
  coins: [
    { id: "coin-1", x: 180, y: 860 },
    { id: "coin-2", x: 840, y: 660 },
  ],
  enemies: [],
};

/**
 * 2. Das Geheimnis der Portale
 * Zeigt die neuen lila Teleporter-Portale (P1 ↔ P2) und Sammel-Eier.
 */
export const starterLevelPortals: Level = {
  version: 2,
  name: "Portal-Express",
  intro: "Betritt das lila Portal, um dich direkt zur anderen Seite zu beamen!",
  quips: [
    "Huch, schon drüben!",
    "Wuuusch! Teleportation funktioniert einwandfrei!",
    "Erst alle Eier holen, dann ist das Ziel offen!",
  ],
  start: { x: 70, y: 880 },
  goal: { id: "goal", x: 920, y: 560, w: 48, h: 74 },
  platforms: [
    { id: "base-left", x: 0, y: 920, w: 360, h: 80 },
    { id: "step-left", x: 320, y: 840, w: 120, h: 28 },
    { id: "step-mid", x: 420, y: 760, w: 100, h: 28 },
    { id: "step-right", x: 500, y: 840, w: 120, h: 28 },
    { id: "base-right", x: 580, y: 920, w: 420, h: 80 },
    { id: "upper-island", x: 740, y: 650, w: 240, h: 30 },
  ],
  hazards: [
    { id: "lava-pit", type: "lava", x: 620, y: 950, w: 120, h: 30 },
  ],
  bouncers: [
    { id: "trampoline-right", x: 760, y: 890, w: 110, h: 26 },
  ],
  movers: [],
  collectibles: [
    { id: "egg-p1", x: 220, y: 860, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-p2", x: 880, y: 590, w: 30, h: 30, type: "egg", collected: false },
  ],
  teleporters: [
    { id: "portal-a", x: 280, y: 860, w: 35, h: 55, targetId: "portal-b", pairIndex: 1 },
    { id: "portal-b", x: 660, y: 860, w: 35, h: 55, targetId: "portal-a", pairIndex: 1 },
  ],
  movingPlatforms: [],
  coins: [
    { id: "c-1", x: 150, y: 860 },
    { id: "c-2", x: 820, y: 590 },
  ],
  enemies: [],
};

/**
 * 3. Die 8 Farben-Arena
 * Vereint alle 8 Farben im Spiel:
 * Schwarz (Plattformen), Rot (Gefahren), Grün (Trampoline),
 * Blau (Beweglicher Kasten), Gelb (Dino-Eier), Lila (Teleporter),
 * Braun (Holz-Schwebelift), Orange (Patrouillierender Dino-Gegner).
 */
export const starterLevelAllColors: Level = {
  version: 2,
  name: "Die 8 Farben-Arena",
  intro: "Das Meisterstück: Alle 8 Spielfarben inklusive lila Portalen, braunem Schwebelift und patrouillierendem Dino-Gegner!",
  quips: [
    "Meisterhaft gezeichnet!",
    "Der braune Holz-Lift fährt dich sicher hinüber!",
    "Vorsicht vor dem orangefarbenen Gegner!",
    "Wuuusch durch das lila Portal!",
    "Super Sprung mit dem Trampolin!",
  ],
  start: { x: 70, y: 880 },
  goal: { id: "goal", x: 880, y: 540, w: 48, h: 74 },
  platforms: [
    { id: "ground-left", x: 0, y: 920, w: 300, h: 80 },
    { id: "step-l", x: 260, y: 850, w: 110, h: 28 },
    { id: "ground-mid", x: 360, y: 920, w: 260, h: 80 },
    { id: "high-platform", x: 480, y: 720, w: 200, h: 30 },
    { id: "step-r", x: 640, y: 850, w: 110, h: 28 },
    { id: "ground-right", x: 680, y: 920, w: 320, h: 80 },
    { id: "goal-island", x: 740, y: 620, w: 240, h: 30 },
  ],
  hazards: [
    { id: "lava-1", type: "lava", x: 310, y: 950, w: 45, h: 25 },
    { id: "spikes-2", type: "spike", x: 630, y: 950, w: 40, h: 20 },
  ],
  bouncers: [
    { id: "trampoline-arena", x: 440, y: 890, w: 100, h: 26 },
  ],
  movers: [
    { id: "box-1", x: 200, y: 860, w: 50, h: 50 },
  ],
  collectibles: [
    { id: "egg-arena-1", x: 140, y: 860, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-arena-2", x: 490, y: 720, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-arena-3", x: 800, y: 560, w: 30, h: 30, type: "egg", collected: false },
  ],
  teleporters: [
    { id: "tele-1", x: 720, y: 860, w: 35, h: 55, targetId: "tele-2", pairIndex: 1 },
    { id: "tele-2", x: 740, y: 560, w: 35, h: 55, targetId: "tele-1", pairIndex: 1 },
  ],
  movingPlatforms: [
    { id: "lift-arena", x: 400, y: 810, w: 100, h: 22, axis: "horizontal", distance: 140, speed: 75 },
  ],
  coins: [
    { id: "coin-a", x: 180, y: 860 },
    { id: "coin-b", x: 510, y: 860 },
  ],
  enemies: [
    { id: "enemy-1", x: 480, y: 900, patrol: 70 },
  ],
};

export const DEFAULT_STARTER_LEVELS: SavedLevelItem[] = [];
