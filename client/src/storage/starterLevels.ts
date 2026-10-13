import type { Level, SavedLevelItem } from "@sketchquest/shared";

/**
 * 1. Dinos Erstes Abenteuer
 * Einsteigerfreundliches Tutorial-Level mit Plattformen, grünem Trampolin,
 * einem gelben Dino-Ei und Ziel.
 */
export const starterLevelTutorial: Level = {
  version: 2,
  name: "Dinos Erstes Abenteuer",
  intro: "Willkommen im Dschungel! Nutze Trampoline, spucke Feuerbälle auf Gegner mit Y/X und sammle alle Dino-Eier!",
  quips: [
    "Das Trampolin federt dich super nach oben!",
    "Treffer mit dem Feuerball!",
    "Super Sprung!",
    "Ein Kinderspiel für einen echten Dino!",
  ],
  theme: "jungle",
  start: { x: 70, y: 870 },
  goal: { id: "goal", x: 910, y: 620, w: 48, h: 74 },
  platforms: [
    { id: "floor-1", x: 0, y: 920, w: 320, h: 80 },
    { id: "step-1", x: 260, y: 830, w: 140, h: 30 },
    { id: "mid-plat", x: 440, y: 830, w: 180, h: 30 },
    { id: "floor-mid", x: 380, y: 920, w: 300, h: 80 },
    { id: "high-plat", x: 720, y: 700, w: 260, h: 40 },
  ],
  hazards: [
    { id: "hazard-1", type: "lava", x: 325, y: 950, w: 50, h: 30 },
  ],
  bouncers: [
    { id: "bounce-start", x: 190, y: 890, w: 80, h: 26 },
    { id: "bounce-1", x: 580, y: 890, w: 90, h: 26 },
  ],
  movers: [],
  collectibles: [
    { id: "egg-1", x: 330, y: 770, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-2", x: 530, y: 770, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-3", x: 800, y: 640, w: 30, h: 30, type: "egg", collected: false },
  ],
  teleporters: [],
  movingPlatforms: [],
  coins: [
    { id: "coin-1", x: 160, y: 860 },
    { id: "coin-2", x: 490, y: 770 },
    { id: "coin-3", x: 760, y: 640 },
  ],
  enemies: [
    { id: "en-tuto-1", x: 520, y: 790, patrol: 55 },
    { id: "en-tuto-2", x: 820, y: 660, patrol: 50 },
  ],
};

/**
 * 2. Das Geheimnis der Portale
 * Zeigt die neuen lila Teleporter-Portale (P1 ↔ P2) und Sammel-Eier.
 */
export const starterLevelPortals: Level = {
  version: 2,
  name: "Portal-Express",
  intro: "Kosmos-Station: Nutze Portale und Trampoline, und grille feindliche Insekten mit deinem Feuerball!",
  quips: [
    "Wuuusch! Teleportation funktioniert perfekt!",
    "Feuerball trifft Flug-Insekt!",
    "Schwerelos durchs All hüpfen!",
    "Erst alle Dino-Eier sammeln!",
  ],
  theme: "space",
  start: { x: 70, y: 870 },
  goal: { id: "goal", x: 910, y: 630, w: 48, h: 74 },
  platforms: [
    { id: "base-left", x: 0, y: 920, w: 420, h: 80 },
    { id: "step-left", x: 180, y: 810, w: 140, h: 30 },
    { id: "center-wall", x: 440, y: 450, w: 60, h: 550 },
    { id: "base-right", x: 520, y: 920, w: 460, h: 80 },
    { id: "float-island-1", x: 620, y: 810, w: 140, h: 30 },
    { id: "float-island-2", x: 780, y: 710, w: 200, h: 30 },
  ],
  hazards: [
    { id: "cosmic-hazard", type: "lava", x: 530, y: 955, w: 80, h: 25 },
  ],
  bouncers: [
    { id: "space-bouncer-left", x: 220, y: 890, w: 80, h: 26 },
    { id: "space-bouncer", x: 650, y: 780, w: 80, h: 26 },
  ],
  movers: [],
  collectibles: [
    { id: "egg-p1", x: 250, y: 750, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-p2", x: 700, y: 630, w: 30, h: 30, type: "egg", collected: false },
  ],
  teleporters: [
    { id: "portal-a", x: 360, y: 855, w: 40, h: 65, targetId: "portal-b", pairIndex: 1 },
    { id: "portal-b", x: 540, y: 855, w: 40, h: 65, targetId: "portal-a", pairIndex: 1 },
  ],
  movingPlatforms: [],
  coins: [
    { id: "c-1", x: 120, y: 860 },
    { id: "c-2", x: 840, y: 650 },
  ],
  enemies: [
    { id: "en-portal-1", x: 250, y: 770, patrol: 50 },
    { id: "en-portal-2", x: 700, y: 770, patrol: 50 },
    { id: "en-portal-3", x: 860, y: 670, patrol: 45 },
  ],
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
  intro: "Das Meisterstück: Alle 8 Spielfarben vereint! Kisten schieben, Schwebelift fahren, Portale nutzen und Gegner mit Feuerbällen bezwingen!",
  quips: [
    "Meisterhaft gezeichnet!",
    "Der braune Schwebelift fährt dich rüber!",
    "Treffer mit dem Feuerball!",
    "Wuuusch durch das lila Portal!",
    "Alle 8 Farben erfolgreich gemeistert!",
  ],
  theme: "paper",
  start: { x: 60, y: 870 },
  goal: { id: "goal", x: 910, y: 550, w: 48, h: 74 },
  platforms: [
    { id: "ground-1", x: 0, y: 920, w: 280, h: 80 },
    { id: "step-box", x: 280, y: 820, w: 140, h: 30 },
    { id: "ground-mid", x: 460, y: 920, w: 220, h: 80 },
    { id: "upper-plateau", x: 740, y: 630, w: 240, h: 35 },
    { id: "ground-right", x: 720, y: 920, w: 260, h: 80 },
  ],
  hazards: [
    { id: "spikes-1", type: "lava", x: 425, y: 955, w: 30, h: 20 },
    { id: "spikes-2", type: "lava", x: 685, y: 955, w: 30, h: 20 },
  ],
  bouncers: [
    { id: "bounce-arena-start", x: 200, y: 890, w: 80, h: 26 },
    { id: "trampoline-mid", x: 480, y: 890, w: 80, h: 26 },
    { id: "bounce-arena-right", x: 780, y: 890, w: 80, h: 26 },
  ],
  movers: [
    { id: "box-1", x: 180, y: 865, w: 48, h: 48 },
  ],
  collectibles: [
    { id: "egg-1", x: 220, y: 770, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-2", x: 520, y: 690, w: 30, h: 30, type: "egg", collected: false },
    { id: "egg-3", x: 800, y: 570, w: 30, h: 30, type: "egg", collected: false },
  ],
  teleporters: [
    { id: "tele-1", x: 620, y: 855, w: 35, h: 60, targetId: "tele-2", pairIndex: 1 },
    { id: "tele-2", x: 760, y: 855, w: 35, h: 60, targetId: "tele-1", pairIndex: 1 },
  ],
  movingPlatforms: [
    { id: "lift-arena", x: 570, y: 760, w: 110, h: 24, axis: "horizontal", distance: 130, speed: 65 },
  ],
  coins: [
    { id: "coin-1", x: 120, y: 860 },
    { id: "coin-2", x: 350, y: 770 },
    { id: "coin-3", x: 870, y: 570 },
  ],
  enemies: [
    { id: "enemy-1", x: 840, y: 900, patrol: 50 },
    { id: "enemy-2", x: 340, y: 780, patrol: 50 },
    { id: "enemy-3", x: 550, y: 880, patrol: 50 },
    { id: "enemy-4", x: 820, y: 590, patrol: 45 },
  ],
};

export const DEFAULT_STARTER_LEVELS: SavedLevelItem[] = [];
