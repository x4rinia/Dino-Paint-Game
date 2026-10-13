import type { Level } from "@sketchquest/shared";
import type { BackgroundTheme } from "../game/paper";
import { starterLevelTutorial, starterLevelPortals, starterLevelAllColors } from "./starterLevels";
import { getSetting, setSetting, getAllLevels } from "./db";

export type WorldTheme = BackgroundTheme | "all";

export interface World {
  id: string;
  name: string;
  theme: WorldTheme;
  description: string;
  icon: string;
  levelIds: (string | null)[]; // Genau 8 Level-Slots (Index 0 bis 7)
  createdAt: number;
  updatedAt: number;
  bestTime?: number; // Schnellste Zeit in Millisekunden für den Komplettdurchlauf
}

// 8 ausgefeilte Standard-Level für Welt 1 mit allen 4 Themen des Spiels
// 8 abwechslungsreiche Level für Welt 1: Mix aus Jump 'n' Run und 4-Wege Labyrinth-Rätseln
const JUNGLE_LEVELS: Level[] = [
  starterLevelTutorial,
  {
    version: 2,
    name: "Das Stadt-Labyrinth der Rätsel",
    intro: "4-Wege Labyrinth-Rätsel! Erkunde die Gänge, weiche Lava aus, schiebe Kisten um Wege zu öffnen, federe an Bumpern ab und sammle alle Dino-Eier!",
    quips: ["Kiste geschoben!", "Treffer mit dem Feuerball!", "Perfekt durchs Labyrinth navigiert!"],
    theme: "paper",
    gameMode: "rpg_labyrinth",
    start: { x: 120, y: 140 },
    goal: { id: "goal", x: 830, y: 810, w: 50, h: 70 },
    platforms: [
      // Außenmauern
      { id: "wall-top", x: 40, y: 40, w: 920, h: 30 },
      { id: "wall-bottom", x: 40, y: 920, w: 920, h: 30 },
      { id: "wall-left", x: 40, y: 40, w: 30, h: 910 },
      { id: "wall-right", x: 920, y: 40, w: 30, h: 910 },
      // Großzügige, breite Gänge (150-200px Durchgangsbreite, Dino hat wunderbar viel Platz)
      { id: "w1", x: 260, y: 70, w: 30, h: 420 },
      { id: "w2", x: 260, y: 640, w: 30, h: 280 },
      { id: "w3", x: 500, y: 200, w: 30, h: 560 },
      { id: "w4", x: 740, y: 70, w: 30, h: 440 },
      { id: "w5", x: 740, y: 640, w: 30, h: 280 },
      // Horizontale Raumteiler mit breiten Passagen
      { id: "h1", x: 70, y: 520, w: 100, h: 30 },
      { id: "h2", x: 380, y: 480, w: 120, h: 30 },
      { id: "h3", x: 620, y: 380, w: 120, h: 30 },
    ],
    hazards: [
      { id: "lava-lab-1", type: "lava", x: 100, y: 680, w: 80, h: 40 },
      { id: "lava-lab-2", type: "lava", x: 460, y: 320, w: 80, h: 40 },
    ],
    bouncers: [
      { id: "bumper-1", x: 300, y: 720, w: 50, h: 50 },
      { id: "bumper-2", x: 660, y: 760, w: 50, h: 50 },
    ],
    movers: [
      { id: "box-lab-1", x: 300, y: 380, w: 50, h: 50 },
      { id: "box-lab-2", x: 660, y: 220, w: 50, h: 50 },
    ],
    collectibles: [
      { id: "e1", x: 120, y: 820, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 480, y: 140, w: 30, h: 30, type: "egg", collected: false },
      { id: "e3", x: 840, y: 160, w: 30, h: 30, type: "egg", collected: false },
      { id: "e4", x: 480, y: 820, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 120, y: 300 },
      { id: "c2", x: 310, y: 130 },
      { id: "c3", x: 670, y: 480 },
    ],
    enemies: [
      { id: "en-lab-1", x: 310, y: 500, patrol: 50 },
      { id: "en-lab-2", x: 670, y: 150, patrol: 45 },
      { id: "en-lab-3", x: 840, y: 680, patrol: 40 },
    ],
  },
  starterLevelPortals,
  {
    version: 2,
    name: "Vulkanisches Rätsel-Gewölbe",
    intro: "Vulkanisches 4-Wege Labyrinth! Schiebe Kisten um Durchgänge zu schaffen, federe an Bumpern ab und grille Feinde mit Feuerbällen!",
    quips: ["Schwere Kiste!", "Feuerball sitzt!", "Dino hat Bärenkräfte!"],
    theme: "volcano",
    gameMode: "rpg_labyrinth",
    start: { x: 120, y: 140 },
    goal: { id: "goal", x: 840, y: 820, w: 48, h: 74 },
    platforms: [
      // Außenmauern
      { id: "v-wall-top", x: 40, y: 40, w: 920, h: 30 },
      { id: "v-wall-bottom", x: 40, y: 920, w: 920, h: 30 },
      { id: "v-wall-left", x: 40, y: 40, w: 30, h: 910 },
      { id: "v-wall-right", x: 920, y: 40, w: 30, h: 910 },
      // Labyrinth-Struktur mit weiten Gängen
      { id: "vp1", x: 280, y: 70, w: 30, h: 460 },
      { id: "vp2", x: 280, y: 650, w: 30, h: 270 },
      { id: "vp3", x: 520, y: 200, w: 30, h: 580 },
      { id: "vp4", x: 740, y: 70, w: 30, h: 450 },
      { id: "vp5", x: 740, y: 650, w: 30, h: 270 },
      // Querbalken
      { id: "vh1", x: 70, y: 400, w: 120, h: 30 },
      { id: "vh2", x: 400, y: 500, w: 120, h: 30 },
      { id: "vh3", x: 630, y: 360, w: 110, h: 30 },
    ],
    hazards: [
      { id: "lava-vault-1", type: "lava", x: 100, y: 560, w: 80, h: 40 },
      { id: "lava-vault-2", type: "lava", x: 480, y: 260, w: 80, h: 40 },
      { id: "lava-vault-3", type: "lava", x: 820, y: 460, w: 60, h: 40 },
    ],
    bouncers: [
      { id: "b-vault-1", x: 310, y: 760, w: 50, h: 50 },
      { id: "b-vault-2", x: 680, y: 740, w: 50, h: 50 },
    ],
    movers: [
      { id: "box-vault-1", x: 310, y: 420, w: 50, h: 50 },
      { id: "box-vault-2", x: 680, y: 200, w: 50, h: 50 },
    ],
    collectibles: [
      { id: "e1", x: 120, y: 780, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 500, y: 140, w: 30, h: 30, type: "egg", collected: false },
      { id: "e3", x: 680, y: 480, w: 30, h: 30, type: "egg", collected: false },
      { id: "e4", x: 840, y: 200, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 120, y: 260 },
      { id: "c2", x: 320, y: 140 },
      { id: "c3", x: 500, y: 760 },
    ],
    enemies: [
      { id: "en-vault-1", x: 310, y: 580, patrol: 50 },
      { id: "en-vault-2", x: 680, y: 120, patrol: 45 },
      { id: "en-vault-3", x: 850, y: 640, patrol: 40 },
    ],
  },
  {
    version: 2,
    name: "Lianen-Brücken",
    intro: "Dschungel-Wipfel mit tropischem Wind: Nutze die grünen Trampoline und besiege Gegner mit Feuerbällen!",
    quips: ["Huiiiii!", "Feuerball mitten ins Schwarze!", "Ziel in Sicht!"],
    theme: "jungle",
    gameMode: "jump_n_run",
    start: { x: 70, y: 870 },
    goal: { id: "goal", x: 910, y: 520, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 0, y: 920, w: 260, h: 80 },
      { id: "p2", x: 290, y: 780, w: 160, h: 30 },
      { id: "p-safe-ground", x: 300, y: 920, w: 350, h: 80 },
      { id: "p3", x: 500, y: 810, w: 150, h: 28 },
      { id: "p4", x: 690, y: 680, w: 150, h: 30 },
      { id: "p5", x: 850, y: 600, w: 150, h: 80 },
    ],
    hazards: [
      { id: "h1", type: "lava", x: 255, y: 955, w: 50, h: 25 },
      { id: "h2", type: "lava", x: 650, y: 955, w: 60, h: 25 },
    ],
    bouncers: [
      { id: "b1", x: 180, y: 896, w: 50, h: 24 },
      { id: "b-safe", x: 420, y: 896, w: 50, h: 24 },
      { id: "b2", x: 570, y: 786, w: 50, h: 24 },
      { id: "b3", x: 740, y: 656, w: 50, h: 24 },
    ],
    movers: [],
    collectibles: [
      { id: "e1", x: 360, y: 720, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 750, y: 620, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 120, y: 860 },
      { id: "c2", x: 730, y: 620 },
    ],
    enemies: [
      { id: "en-vine-1", x: 360, y: 745, patrol: 50 },
      { id: "en-vine-2", x: 580, y: 775, patrol: 50 },
      { id: "en-vine-3", x: 760, y: 645, patrol: 50 },
    ],
  },
  {
    version: 2,
    name: "Schwebelifte über der Schlucht",
    intro: "Vulkan-Krater: Steige auf den Schwebelift über brodelnder Lava und schieße fliegende Gegner mit Feuerbällen ab!",
    quips: ["Aufzug fährt ab!", "Feuer frei!", "Sauber rübergekommen!"],
    theme: "volcano",
    gameMode: "jump_n_run",
    start: { x: 70, y: 870 },
    goal: { id: "goal", x: 910, y: 620, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 0, y: 920, w: 240, h: 80 },
      { id: "p-mid-island", x: 420, y: 820, w: 160, h: 30 },
      { id: "p-mid-ground", x: 420, y: 920, w: 160, h: 80 },
      { id: "p-goal-island", x: 770, y: 700, w: 230, h: 80 },
    ],
    hazards: [
      { id: "h1", type: "lava", x: 245, y: 955, w: 170, h: 30 },
      { id: "h2", type: "lava", x: 585, y: 955, w: 180, h: 30 },
    ],
    bouncers: [
      { id: "b-start", x: 180, y: 896, w: 50, h: 24 },
      { id: "b-recovery", x: 460, y: 896, w: 50, h: 24 },
      { id: "b-end", x: 800, y: 676, w: 50, h: 24 },
    ],
    movers: [],
    collectibles: [
      { id: "e1", x: 490, y: 760, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 840, y: 640, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [
      { id: "lift-1", x: 260, y: 840, w: 110, h: 24, axis: "horizontal", distance: 140, speed: 65 },
      { id: "lift-2", x: 600, y: 750, w: 110, h: 24, axis: "horizontal", distance: 130, speed: 65 },
    ],
    coins: [
      { id: "c1", x: 120, y: 860 },
      { id: "c2", x: 820, y: 640 },
    ],
    enemies: [
      { id: "en-lift-1", x: 480, y: 780, patrol: 50 },
      { id: "en-lift-2", x: 700, y: 670, patrol: 50 },
      { id: "en-lift-3", x: 860, y: 660, patrol: 40 },
    ],
  },
  {
    version: 2,
    name: "Das Kosmische Dimensions-Labyrinth",
    intro: "Zero-G Labyrinth mit mehreren Portalen! Teleportiere dich zwischen Raumkammern hin und her, um alle Dino-Eier zu bergen!",
    quips: ["Patsch!", "Dimensionstor durchschritten!", "Super Timing!"],
    theme: "space",
    gameMode: "rpg_labyrinth",
    start: { x: 120, y: 140 },
    goal: { id: "goal", x: 840, y: 820, w: 48, h: 74 },
    platforms: [
      // Außenmauern
      { id: "sp-wall-top", x: 40, y: 40, w: 920, h: 40 },
      { id: "sp-wall-bottom", x: 40, y: 920, w: 920, h: 40 },
      { id: "sp-wall-left", x: 40, y: 40, w: 40, h: 920 },
      { id: "sp-wall-right", x: 920, y: 40, w: 40, h: 920 },
      // Raum-Trennwände
      { id: "sw1", x: 340, y: 40, w: 40, h: 620 },
      { id: "sw2", x: 340, y: 740, w: 40, h: 220 },
      { id: "sw3", x: 660, y: 40, w: 40, h: 320 },
      { id: "sw4", x: 660, y: 440, w: 40, h: 520 },
      { id: "sh1", x: 80, y: 480, w: 260, h: 40 },
      { id: "sh2", x: 380, y: 400, w: 280, h: 40 },
      { id: "sh3", x: 700, y: 600, w: 220, h: 40 },
    ],
    hazards: [
      { id: "floating-plasma-lab-1", type: "lava", x: 160, y: 320, w: 80, h: 40 },
      { id: "floating-plasma-lab-2", type: "lava", x: 500, y: 640, w: 80, h: 40 },
    ],
    bouncers: [
      { id: "b-space-lab-1", x: 220, y: 740, w: 50, h: 50 },
      { id: "b-space-lab-2", x: 520, y: 220, w: 50, h: 50 },
    ],
    movers: [
      { id: "box-space-1", x: 480, y: 480, w: 50, h: 50 },
    ],
    collectibles: [
      { id: "e1", x: 140, y: 620, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 500, y: 120, w: 30, h: 30, type: "egg", collected: false },
      { id: "e3", x: 820, y: 200, w: 30, h: 30, type: "egg", collected: false },
    ],
    // Mehrere Portale, die zyklisch miteinander verbunden sind!
    teleporters: [
      { id: "cosmic-tp-1", x: 140, y: 820, w: 40, h: 60, targetId: "cosmic-tp-2", pairIndex: 1 },
      { id: "cosmic-tp-2", x: 480, y: 280, w: 40, h: 60, targetId: "cosmic-tp-3", pairIndex: 2 },
      { id: "cosmic-tp-3", x: 820, y: 480, w: 40, h: 60, targetId: "cosmic-tp-1", pairIndex: 3 },
    ],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 140, y: 220 },
      { id: "c2", x: 500, y: 800 },
      { id: "c3", x: 820, y: 120 },
    ],
    enemies: [
      { id: "en-sp-1", x: 220, y: 200, patrol: 45 },
      { id: "en-sp-2", x: 500, y: 520, patrol: 45 },
      { id: "en-sp-3", x: 820, y: 720, patrol: 45 },
    ],
  },
  starterLevelAllColors,
];

export const DEFAULT_WORLDS: World[] = [
  {
    id: "world-adventure-1",
    name: "Welt 1: Dinos Abenteuer-Reise",
    theme: "all",
    description: "Die ultimative Beispielwelt! 8 abwechslungsreiche Level mit Jump 'n' Run & 4-Wege Labyrinth-Rätseln in allen Themen: Stadt-Skyline, Dschungel-Wind, Vulkan-Doppelsprung, Kosmos-Schweben, Portale, Kisten-Schieberätsel & Gegner.",
    icon: "🌍",
    levelIds: [
      "starter_tutorial",
      "starter_spikepath",
      "starter_portals",
      "starter_crates",
      "starter_vines",
      "starter_lifts",
      "starter_insects",
      "starter_allcolors",
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

export const BUILTIN_STARTER_MAP: Record<string, Level> = {
  starter_tutorial: JUNGLE_LEVELS[0],
  starter_spikepath: JUNGLE_LEVELS[1],
  starter_portals: JUNGLE_LEVELS[2],
  starter_crates: JUNGLE_LEVELS[3],
  starter_vines: JUNGLE_LEVELS[4],
  starter_lifts: JUNGLE_LEVELS[5],
  starter_insects: JUNGLE_LEVELS[6],
  starter_allcolors: JUNGLE_LEVELS[7],
};

const WORLDS_STORAGE_KEY = "dino_worlds_v3";
const WORLDS_INIT_KEY = "dino_worlds_initialized_v3";

/** Lädt alle Welten aus dem lokalen Speicher (Beispielwelt ist unlöschbar und immer aktuell vorhanden) */
export async function getAllWorlds(): Promise<World[]> {
  try {
    const custom = await getSetting<World[]>(WORLDS_STORAGE_KEY, []);
    let list: World[] = Array.isArray(custom) ? [...custom] : [];

    // Die Standard-Beispielwelt (world-adventure-1) ist unlöschbar und wird sofort synchronisiert
    const defaultWorldIdx = list.findIndex((w) => w.id === "world-adventure-1");
    if (defaultWorldIdx === -1) {
      list.unshift(DEFAULT_WORLDS[0]);
      await setSetting(WORLDS_STORAGE_KEY, list);
    } else {
      // Immer mit den neuesten Level-Definitionen synchronisieren (Beispielwelt bleibt stets auf dem neuesten Stand!)
      const current = list[defaultWorldIdx];
      list[defaultWorldIdx] = {
        ...DEFAULT_WORLDS[0],
        bestTime: current.bestTime,
      };
      await setSetting(WORLDS_STORAGE_KEY, list);
    }

    return list;
  } catch (err) {
    console.warn("Fehler beim Laden der Welten:", err);
  }
  return DEFAULT_WORLDS;
}

/** Speichert alle Welten dauerhaft (schützt world-adventure-1 davor, verloren zu gehen) */
export async function saveAllWorlds(worlds: World[]): Promise<void> {
  const hasDefault = worlds.some((w) => w.id === "world-adventure-1");
  const listToSave = hasDefault ? worlds : [DEFAULT_WORLDS[0], ...worlds];
  await setSetting(WORLDS_STORAGE_KEY, listToSave);
  await setSetting(WORLDS_INIT_KEY, true);
}

/** Erstellt eine neue Welt mit 8 freien Slots */
export async function createNewWorld(name: string, theme: WorldTheme = "all"): Promise<World> {
  const worlds = await getAllWorlds();
  const newWorld: World = {
    id: `world-custom-${Date.now()}`,
    name: name.trim() || `Eigene Welt ${worlds.length + 1}`,
    theme,
    description: "8 zusammenhängende Level für dein persönliches Dino-Abenteuer.",
    icon: "🌍",
    levelIds: [
      "starter_tutorial",
      "starter_spikepath",
      "starter_portals",
      "starter_crates",
      null,
      null,
      null,
      null,
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updated = [...worlds, newWorld];
  await saveAllWorlds(updated);
  return newWorld;
}

/** Weist einem der 8 Slots in einer Welt ein bestimmtes Level zu */
export async function setWorldLevelSlot(
  worldId: string,
  slotIndex: number,
  levelId: string | null
): Promise<World | null> {
  if (slotIndex < 0 || slotIndex >= 8) return null;
  const worlds = await getAllWorlds();
  const w = worlds.find((item) => item.id === worldId);
  if (!w) return null;

  const nextSlots = [...w.levelIds];
  while (nextSlots.length < 8) nextSlots.push(null);
  nextSlots[slotIndex] = levelId;

  w.levelIds = nextSlots;
  w.updatedAt = Date.now();

  await saveAllWorlds(worlds);
  return w;
}

/** Löscht eine Welt (Beispielwelt ist geschützt und unlöschbar) */
export async function deleteWorld(worldId: string): Promise<void> {
  if (worldId === "world-adventure-1") {
    console.warn("Die Beispielwelt 'world-adventure-1' ist geschützt und kann nicht gelöscht werden.");
    return;
  }
  const worlds = await getAllWorlds();
  const filtered = worlds.filter((w) => w.id !== worldId);
  await saveAllWorlds(filtered);
}

/** Speichert die Bestzeit (Speedrun-Rekord) einer Welt und gibt zurück, ob es ein neuer Rekord ist */
export async function saveWorldBestTime(
  worldId: string,
  timeMs: number
): Promise<{ isNewRecord: boolean; previousBest?: number }> {
  const worlds = await getAllWorlds();
  const w = worlds.find((item) => item.id === worldId);
  if (!w) return { isNewRecord: false };

  const previousBest = w.bestTime;
  const isNewRecord = previousBest === undefined || timeMs < previousBest;
  if (isNewRecord) {
    w.bestTime = timeMs;
    w.updatedAt = Date.now();
    await saveAllWorlds(worlds);
  }
  return { isNewRecord, previousBest };
}

/** Formatiert Millisekunden in ein schönes Zeitformat (MM:SS.s) */
export function formatWorldTime(ms: number): string {
  if (!ms || ms <= 0) return "--:--";
  const totalSecs = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}

/** Findet ein Level anhand seiner ID aus Built-in Map oder IndexedDB */
export async function resolveLevelById(levelId: string): Promise<Level | null> {
  if (BUILTIN_STARTER_MAP[levelId]) {
    return BUILTIN_STARTER_MAP[levelId];
  }
  const all = await getAllLevels();
  const found = all.find((item) => item.id === levelId);
  return found ? found.level : null;
}
