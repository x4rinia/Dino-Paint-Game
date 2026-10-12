import type { Level } from "@sketchquest/shared";
import type { BackgroundTheme } from "../game/paper";
import { starterLevelTutorial, starterLevelPortals, starterLevelAllColors } from "./starterLevels";
import { getSetting, setSetting, getAllLevels } from "./db";

export interface World {
  id: string;
  name: string;
  theme: BackgroundTheme;
  description: string;
  icon: string;
  levelIds: (string | null)[]; // Genau 8 Level-Slots (Index 0 bis 7)
  createdAt: number;
  updatedAt: number;
}

// 8 ausgefeilte Standard-Level für Welt 1 (Urzeit-Dschungel)
const JUNGLE_LEVELS: Level[] = [
  starterLevelTutorial,
  {
    version: 2,
    name: "Der Stachel-Pfad",
    intro: "Achtung vor den roten Stacheln! Nutze die Steinplattformen mit geschickten Sprüngen.",
    quips: ["Guter Sprung!", "Nicht in die Stacheln treten!", "Perfekt gelandet!"],
    start: { x: 80, y: 880 },
    goal: { id: "goal", x: 920, y: 640, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 20, y: 920, w: 240, h: 80 },
      { id: "p2", x: 340, y: 860, w: 160, h: 30 },
      { id: "p3", x: 580, y: 800, w: 160, h: 30 },
      { id: "p4", x: 800, y: 720, w: 200, h: 80 },
    ],
    hazards: [
      { id: "spikes-1", type: "spike", x: 270, y: 950, w: 60, h: 25 },
      { id: "spikes-2", type: "spike", x: 510, y: 950, w: 60, h: 25 },
    ],
    bouncers: [],
    movers: [],
    collectibles: [
      { id: "e1", x: 410, y: 790, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 650, y: 730, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [],
    enemies: [],
  },
  starterLevelPortals,
  {
    version: 2,
    name: "Schubkisten-Garten",
    intro: "Schiebe den blauen Block an die Wand, um höher gelegene Eier zu erreichen!",
    quips: ["Schwere Kiste!", "Jetzt kommst du hoch!", "Dino hat Bärenkräfte!"],
    start: { x: 80, y: 880 },
    goal: { id: "goal", x: 910, y: 580, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 20, y: 920, w: 450, h: 80 },
      { id: "p2", x: 480, y: 780, w: 180, h: 30 },
      { id: "p3", x: 740, y: 660, w: 240, h: 40 },
    ],
    hazards: [],
    bouncers: [],
    movers: [
      { id: "box-1", x: 260, y: 860, w: 48, h: 48 },
    ],
    collectibles: [
      { id: "e1", x: 300, y: 720, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 560, y: 710, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [],
    enemies: [],
  },
  {
    version: 2,
    name: "Lianen-Brücken",
    intro: "Kombiniere Trampoline und schmale Plattformen in luftiger Höhe!",
    quips: ["Huiiiii!", "Wie ein Flugsaurier!", "Ziel in Sicht!"],
    start: { x: 80, y: 880 },
    goal: { id: "goal", x: 910, y: 520, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 20, y: 920, w: 220, h: 80 },
      { id: "p2", x: 400, y: 760, w: 140, h: 26 },
      { id: "p3", x: 700, y: 620, w: 140, h: 26 },
      { id: "p4", x: 850, y: 600, w: 140, h: 80 },
    ],
    hazards: [
      { id: "h1", type: "spike", x: 260, y: 960, w: 120, h: 25 },
      { id: "h2", type: "spike", x: 560, y: 960, w: 120, h: 25 },
    ],
    bouncers: [
      { id: "b1", x: 170, y: 890, w: 80, h: 24 },
      { id: "b2", x: 490, y: 730, w: 80, h: 24 },
    ],
    movers: [],
    collectibles: [
      { id: "e1", x: 300, y: 640, w: 30, h: 30, type: "egg", collected: false },
      { id: "e2", x: 620, y: 530, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [],
    enemies: [],
  },
  {
    version: 2,
    name: "Schwebelifte über der Schlucht",
    intro: "Steige auf den braunen Holz-Lift und fahre sicher über den Abgrund!",
    quips: ["Aufzug fährt ab!", "Gleichmäßige Fahrt!", "Sauber rübergekommen!"],
    start: { x: 80, y: 880 },
    goal: { id: "goal", x: 920, y: 640, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 20, y: 920, w: 260, h: 80 },
      { id: "p2", x: 740, y: 720, w: 240, h: 80 },
    ],
    hazards: [
      { id: "h1", type: "spike", x: 320, y: 960, w: 380, h: 25 },
    ],
    bouncers: [],
    movers: [],
    collectibles: [
      { id: "e1", x: 500, y: 720, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [
      { id: "lift-1", x: 320, y: 820, w: 120, h: 24, axis: "horizontal", distance: 260, speed: 70 },
    ],
    coins: [],
    enemies: [],
  },
  {
    version: 2,
    name: "Flug-Insekten Reviere",
    intro: "Vorsicht vor den pinken Flugviechern! Warte ihren Flug ab oder hüpfe auf sie drauf!",
    quips: ["Patsch!", "Flugbahn gut abgepasst!", "Super Timing!"],
    start: { x: 80, y: 880 },
    goal: { id: "goal", x: 920, y: 620, w: 48, h: 74 },
    platforms: [
      { id: "p1", x: 20, y: 920, w: 320, h: 80 },
      { id: "p2", x: 440, y: 820, w: 220, h: 30 },
      { id: "p3", x: 760, y: 700, w: 220, h: 80 },
    ],
    hazards: [],
    bouncers: [],
    movers: [],
    collectibles: [
      { id: "e1", x: 540, y: 750, w: 30, h: 30, type: "egg", collected: false },
    ],
    teleporters: [],
    movingPlatforms: [],
    coins: [],
    enemies: [
      { id: "en-1", x: 550, y: 790, patrol: 90 },
      { id: "en-2", x: 830, y: 660, patrol: 80 },
    ],
  },
  starterLevelAllColors,
];

export const DEFAULT_WORLDS: World[] = [
  {
    id: "world-jungle-1",
    name: "Welt 1: Urzeit-Dschungel",
    theme: "jungle",
    description: "8 abenteuerliche Dschungel-Level mit Palmen, Lianen, Trampolinen und Schwebeliften.",
    icon: "🌴",
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
  {
    id: "world-volcano-2",
    name: "Welt 2: Vulkan-Tal",
    theme: "volcano",
    description: "8 feurige Herausforderungen zwischen Magmaströmen, scharfen Stacheln und Flammen.",
    icon: "🌋",
    levelIds: [
      "starter_tutorial",
      "starter_spikepath",
      "starter_crates",
      "starter_portals",
      "starter_lifts",
      "starter_vines",
      "starter_insects",
      "starter_allcolors",
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "world-space-3",
    name: "Welt 3: Sternen-Kosmos",
    theme: "space",
    description: "8 kosmische Level mit sanfter Schwerkraft, weiten Sprüngen und Vortex-Katapulten.",
    icon: "🚀",
    levelIds: [
      "starter_portals",
      "starter_tutorial",
      "starter_vines",
      "starter_lifts",
      "starter_crates",
      "starter_insects",
      "starter_spikepath",
      "starter_allcolors",
    ],
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "world-paper-4",
    name: "Welt 4: Klassischer Zeichenblock",
    theme: "paper",
    description: "8 liebevoll gezeichnete Doodle-Level mit allen 9 Spielfarben, Rätseln und Action.",
    icon: "📝",
    levelIds: [
      "starter_tutorial",
      "starter_crates",
      "starter_spikepath",
      "starter_vines",
      "starter_portals",
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

const WORLDS_STORAGE_KEY = "dino_worlds_v1";

/** Lädt alle Welten aus dem lokalen Speicher */
export async function getAllWorlds(): Promise<World[]> {
  try {
    const custom = await getSetting<World[]>(WORLDS_STORAGE_KEY, []);
    if (custom && custom.length > 0) {
      return custom;
    }
  } catch (err) {
    console.warn("Fehler beim Laden der Welten:", err);
  }
  return DEFAULT_WORLDS;
}

/** Speichert alle Welten dauerhaft */
export async function saveAllWorlds(worlds: World[]): Promise<void> {
  await setSetting(WORLDS_STORAGE_KEY, worlds);
}

/** Erstellt eine neue Welt mit 8 freien Slots */
export async function createNewWorld(name: string, theme: BackgroundTheme = "paper"): Promise<World> {
  const worlds = await getAllWorlds();
  const newWorld: World = {
    id: `world-custom-${Date.now()}`,
    name: name.trim() || `Eigene Welt ${worlds.length + 1}`,
    theme,
    description: "Deine persönliche 8-Level-Welt mit selbst gezeichneten Leveln.",
    icon: theme === "jungle" ? "🌴" : theme === "volcano" ? "🌋" : theme === "space" ? "🚀" : "🎨",
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

/** Löscht eine Welt */
export async function deleteWorld(worldId: string): Promise<void> {
  const worlds = await getAllWorlds();
  const filtered = worlds.filter((w) => w.id !== worldId);
  await saveAllWorlds(filtered);
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
