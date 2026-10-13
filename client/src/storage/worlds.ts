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
const JUNGLE_LEVELS: Level[] = [
  starterLevelTutorial,
  {
    version: 2,
    name: "Der Stachel-Pfad",
    intro: "Vulkan-Pfad mit glühenden Felsen und roten Stacheln! Nutze geschickte Sprünge und den Doppelsprung.",
    quips: ["Guter Sprung!", "Nicht in die Stacheln treten!", "Perfekt gelandet!"],
    theme: "volcano",
    start: { x: 70, y: 870 },
    goal: { id: "goal", x: 910, y: 640, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 0, y: 920, w: 260, h: 80 },
      { id: "p2", x: 340, y: 850, w: 160, h: 30 },
      { id: "p-mid-ground", x: 300, y: 920, w: 400, h: 80 },
      { id: "p3", x: 570, y: 780, w: 160, h: 30 },
      { id: "p4", x: 770, y: 720, w: 230, h: 80 },
    ],
    hazards: [
      { id: "spikes-1", type: "spike", x: 260, y: 955, w: 50, h: 25 },
      { id: "spikes-2", type: "spike", x: 700, y: 955, w: 70, h: 25 },
    ],
    bouncers: [],
    movers: [],
    collectibles: [
      { id: "e1", x: 420, y: 790, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 650, y: 720, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 180, y: 860 },
      { id: "c2", x: 840, y: 660 },
    ],
    enemies: [],
  },
  starterLevelPortals,
  {
    version: 2,
    name: "Schubkisten-Garten",
    intro: "Papier-Skizzenwelt: Schiebe den blauen Block an die Wand, um höher gelegene Eier zu erreichen!",
    quips: ["Schwere Kiste!", "Jetzt kommst du hoch!", "Dino hat Bärenkräfte!"],
    theme: "paper",
    start: { x: 70, y: 870 },
    goal: { id: "goal", x: 910, y: 560, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 0, y: 920, w: 440, h: 80 },
      { id: "p-ledge", x: 440, y: 800, w: 190, h: 120 },
      { id: "p-mid", x: 660, y: 720, w: 160, h: 30 },
      { id: "p-goal", x: 840, y: 640, w: 160, h: 80 },
      { id: "p-bottom-safety", x: 630, y: 920, w: 370, h: 80 },
    ],
    hazards: [],
    bouncers: [
      { id: "b-safety", x: 700, y: 890, w: 70, h: 26 },
    ],
    movers: [
      { id: "box-1", x: 260, y: 865, w: 48, h: 48 },
    ],
    collectibles: [
      { id: "e1", x: 330, y: 730, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 730, y: 660, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 160, y: 860 },
      { id: "c2", x: 530, y: 740 },
    ],
    enemies: [],
  },
  {
    version: 2,
    name: "Lianen-Brücken",
    intro: "Dschungel-Wipfel mit tropischem Wind: Nutze die grünen Trampoline für luftige Sprünge!",
    quips: ["Huiiiii!", "Wie ein Flugsaurier!", "Ziel in Sicht!"],
    theme: "jungle",
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
      { id: "h1", type: "spike", x: 255, y: 955, w: 50, h: 25 },
      { id: "h2", type: "spike", x: 650, y: 955, w: 60, h: 25 },
    ],
    bouncers: [
      { id: "b1", x: 180, y: 890, w: 75, h: 26 },
      { id: "b-safe", x: 420, y: 890, w: 75, h: 26 },
      { id: "b2", x: 570, y: 780, w: 75, h: 26 },
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
    enemies: [],
  },
  {
    version: 2,
    name: "Schwebelifte über der Schlucht",
    intro: "Vulkan-Krater: Steige auf den Schwebelift und fahre sicher über den feurigen Abgrund!",
    quips: ["Aufzug fährt ab!", "Gleichmäßige Fahrt!", "Sauber rübergekommen!"],
    theme: "volcano",
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
      { id: "b-recovery", x: 460, y: 890, w: 75, h: 26 },
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
    enemies: [],
  },
  {
    version: 2,
    name: "Flug-Insekten Reviere",
    intro: "Kosmos-Dimension mit reduzierter Schwerkraft: Weiche den außerirdischen Flug-Insekten aus oder bezwinge sie mit einem Sprung!",
    quips: ["Patsch!", "Flugbahn gut abgepasst!", "Super Timing!"],
    theme: "space",
    start: { x: 70, y: 870 },
    goal: { id: "goal", x: 910, y: 600, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 0, y: 920, w: 260, h: 80 },
      { id: "p2", x: 280, y: 840, w: 180, h: 30 },
      { id: "p-low", x: 240, y: 920, w: 520, h: 80 },
      { id: "p3", x: 500, y: 760, w: 190, h: 30 },
      { id: "p4", x: 730, y: 680, w: 270, h: 80 },
    ],
    hazards: [],
    bouncers: [
      { id: "b-space", x: 460, y: 890, w: 80, h: 26 },
    ],
    movers: [],
    collectibles: [
      { id: "e1", x: 360, y: 760, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 600, y: 680, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [
      { id: "c1", x: 120, y: 860 },
      { id: "c2", x: 780, y: 620 },
    ],
    enemies: [
      { id: "en-1", x: 360, y: 810, patrol: 45 },
      { id: "en-2", x: 580, y: 730, patrol: 45 },
    ],
  },
  starterLevelAllColors,
];

export const DEFAULT_WORLDS: World[] = [
  {
    id: "world-adventure-1",
    name: "Welt 1: Dinos Abenteuer-Reise",
    theme: "all",
    description: "Die ultimative Beispielwelt! 8 abwechslungsreiche Level mit allen 4 Themen des Spiels: Dschungel-Wind, Vulkan-Doppelsprung, Kosmos-Schweben, Papier-Skizzen, Stachelpfade, Portale, Kisten-Rätsel & Gegner.",
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

const WORLDS_STORAGE_KEY = "dino_worlds_v2";
const WORLDS_INIT_KEY = "dino_worlds_initialized_v2";

/** Lädt alle Welten aus dem lokalen Speicher (Beispielwelt ist unlöschbar und immer vorhanden) */
export async function getAllWorlds(): Promise<World[]> {
  try {
    const custom = await getSetting<World[]>(WORLDS_STORAGE_KEY, []);
    let list: World[] = Array.isArray(custom) ? [...custom] : [];

    // Die Standard-Beispielwelt (world-adventure-1) ist unlöschbar und wird sofort wiederhergestellt, falls sie fehlt
    const hasDefaultWorld = list.some((w) => w.id === "world-adventure-1");
    if (!hasDefaultWorld) {
      list.unshift(DEFAULT_WORLDS[0]);
      await setSetting(WORLDS_STORAGE_KEY, list);
    } else {
      // Stelle sicher, dass die Beispielwelt alle 8 Level-Slots und das All-Themes-Setting besitzt
      let modified = false;
      list = list.map((w) => {
        if (w.id === "world-adventure-1") {
          const filledSlots = w.levelIds.filter(Boolean).length;
          if (filledSlots < 8 || w.theme !== "all" || !w.description) {
            modified = true;
            return {
              ...DEFAULT_WORLDS[0],
              bestTime: w.bestTime,
            };
          }
        }
        return w;
      });
      if (modified) {
        await setSetting(WORLDS_STORAGE_KEY, list);
      }
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
