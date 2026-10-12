import { z } from "zod";

/**
 * Dino Draw Your Game – Level-Schema (Version 2).
 *
 * Level coordinates are normalized 0-1000, origin top-left (world: 1600x900 px).
 * Platforms, hazards, bouncers, movers and the goal use `x, y` as the top-left
 * corner; the start, coins and enemies use it as the center.
 *
 * The six basic colors of a drawing map 1:1 onto these lists:
 *   Schwarz -> platforms    (feste Plattformen, Böden, Wände)
 *   Rot     -> hazards      (tödliche Gefahren)
 *   Grün    -> bouncers     (Sprungflächen / Trampoline)
 *   Blau    -> movers       (bewegliche Physikobjekte)
 *   Gelb    -> collectibles (Sammelobjekte: Dino-Eier / Sterne)
 *   Lila    -> teleporters  (Teleporter-Portale)
 * Start and goal are NOT colors: they are placed automatically or set by the
 * player in the preview.
 */
const coord = z.number().min(0).max(1000);

const point = { x: coord, y: coord };
const rect = { id: z.string(), x: coord, y: coord, w: coord, h: coord };

/** Cell mask of a blue object in analysis-grid units (row-major bitset, base64). */
export const MoverMaskSchema = z.object({
  cols: z.number().int().min(1).max(4000),
  rows: z.number().int().min(1).max(4000),
  bits: z.string(),
});

/** Gelb: Einsammelbare Dino-Eier oder Sterne */
export const CollectibleSchema = z.object({
  id: z.string(),
  x: coord,
  y: coord,
  w: coord.optional().default(30),
  h: coord.optional().default(30),
  type: z.enum(["egg", "star", "coin"]).optional().default("egg"),
  collected: z.boolean().optional().default(false),
});

/** Lila: Gepaarte Teleporter-Portale (Option 1) */
export const TeleporterSchema = z.object({
  id: z.string(),
  x: coord,
  y: coord,
  w: coord.optional().default(35),
  h: coord.optional().default(55),
  targetId: z.string().optional(),
  pairIndex: z.number().int().optional(),
});

/** Lila: Bewegliche Plattformen / Schwebende Lifte (Option 2: links/rechts oder hoch/runter) */
export const MovingPlatformSchema = z.object({
  id: z.string(),
  x: coord,
  y: coord,
  w: coord,
  h: coord,
  axis: z.enum(["horizontal", "vertical", "alternating"]).default("horizontal"),
  distance: z.number().optional().default(180),
  speed: z.number().optional().default(80),
});

export const LevelSchema = z.object({
  version: z.literal(2).optional().default(2),
  name: z.string(),
  intro: z.string().optional().default(""),
  quips: z.array(z.string()).optional().default([]),
  start: z.object(point),
  goal: z.object(rect),
  /** Schwarz: static, solid. */
  platforms: z.array(z.object(rect)),
  /** Rot: touching kills. `type` only changes the death effect. */
  hazards: z.array(z.object({ ...rect, type: z.enum(["spike", "lava"]) })),
  /** Grün: solid, landing on top launches the player upward. */
  bouncers: z.array(z.object(rect)).optional().default([]),
  /** Blau: dynamic physics bodies (gravity, collisions, pushable). */
  movers: z.array(z.object({ ...rect, mask: MoverMaskSchema.optional() })).optional().default([]),
  /** Gelb: Sammelobjekte, die vor Zielerreichung gesammelt werden müssen. */
  collectibles: z.array(CollectibleSchema).optional().default([]),
  /** Lila: Portale, die paarweise teleportieren. */
  teleporters: z.array(TeleporterSchema).optional().default([]),
  /** Lila: Bewegliche Plattformen / Lifte. */
  movingPlatforms: z.array(MovingPlatformSchema).optional().default([]),
  /** Optional extras (not produced by the color detection). */
  coins: z.array(z.object({ id: z.string(), ...point })).optional().default([]),
  enemies: z.array(z.object({ id: z.string(), ...point, patrol: coord })).optional().default([]),
});

export type Level = z.infer<typeof LevelSchema>;
export type Platform = Level["platforms"][number];
export type Hazard = Level["hazards"][number];
export type Bouncer = Level["bouncers"][number];
export type Mover = Level["movers"][number];
export type MoverMask = z.infer<typeof MoverMaskSchema>;
export type Collectible = z.infer<typeof CollectibleSchema>;
export type Teleporter = z.infer<typeof TeleporterSchema>;
export type MovingPlatform = z.infer<typeof MovingPlatformSchema>;
export type Coin = Level["coins"][number];
export type Enemy = Level["enemies"][number];

export const DeathCauseSchema = z.enum(["spike", "lava", "enemy", "fall"]);
export type DeathCause = z.infer<typeof DeathCauseSchema>;

export type DeathEvent = {
  cause: DeathCause;
  x: number;
  y: number;
  attempt: number;
  deathsAtSpot: number;
  coins: number;
  timeAlive: number;
};

export type WinEvent = {
  coins: number;
  timeAlive: number;
  deaths: number;
};

/**
 * Hand-built level used ONLY by automated tests and the ?debug=1 test keys.
 * It is never shown in place of a scanned or drawn level.
 */
export const sampleLevel: Level = {
  version: 2,
  name: "Testlevel",
  intro: "",
  quips: [],
  start: { x: 60, y: 880 },
  goal: { id: "goal", x: 930, y: 580, w: 40, h: 70 },
  platforms: [
    { id: "ground-1", x: 0, y: 920, w: 340, h: 80 },
    { id: "ground-2", x: 420, y: 920, w: 580, h: 80 },
    { id: "plat-1", x: 500, y: 830, w: 120, h: 24 },
    { id: "plat-2", x: 660, y: 740, w: 120, h: 24 },
    { id: "plat-3", x: 820, y: 650, w: 160, h: 24 },
  ],
  hazards: [
    { id: "spike-1", type: "spike", x: 230, y: 890, w: 40, h: 30 },
    { id: "lava-1", type: "lava", x: 340, y: 960, w: 80, h: 40 },
  ],
  bouncers: [],
  movers: [],
  collectibles: [],
  teleporters: [],
  movingPlatforms: [],
  coins: [],
  enemies: [],
};
