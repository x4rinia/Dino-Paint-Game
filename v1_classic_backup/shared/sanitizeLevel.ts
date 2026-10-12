import {
  sampleLevel,
  type Bouncer,
  type Coin,
  type Collectible,
  type Enemy,
  type Hazard,
  type Level,
  type Mover,
  type MovingPlatform,
  type Platform,
  type Teleporter,
} from "./level";

/**
 * Coerces untrusted, possibly-malformed level data (e.g. an imported file)
 * into something that satisfies LevelSchema: numeric fields are clamped
 * into the 0-1000 range instead of rejected, and individual entities that
 * are missing required fields are dropped (and duplicate ids renamed)
 * instead of throwing. Call this
 * before LevelSchema.parse so a broken level degrades instead of crashing.
 */
export function sanitizeLevel(input: unknown): Level {
  const raw = isRecord(input) ? input : {};

  const level: Level = {
    version: 2,
    name: str(raw.name, "Mein Level"),
    intro: str(raw.intro, ""),
    quips: Array.isArray(raw.quips) ? raw.quips.filter((q): q is string => typeof q === "string") : [],
    start: sanitizePoint(raw.start, sampleLevel.start),
    goal: sanitizeRect<Level["goal"]>(raw.goal) ?? sampleLevel.goal,
    platforms: sanitizeList(raw.platforms, sanitizeRect<Platform>),
    hazards: sanitizeList(raw.hazards, sanitizeHazard),
    bouncers: sanitizeList(raw.bouncers, sanitizeRect<Bouncer>),
    movers: sanitizeList(raw.movers, sanitizeMover),
    collectibles: sanitizeList(raw.collectibles, sanitizeCollectible),
    teleporters: sanitizeList(raw.teleporters, sanitizeTeleporter),
    movingPlatforms: sanitizeList((raw as any).movingPlatforms, sanitizeMovingPlatform),
    coins: sanitizeList(raw.coins, sanitizeCoin),
    enemies: sanitizeList(raw.enemies, sanitizeEnemy),
  };

  return dedupeIds(level);
}

/**
 * Makes every id unique across the level by suffixing repeats ("p1" ->
 * "p1-2") rather than dropping the entity, so a model that reuses an id
 * doesn't silently lose platforms.
 */
function dedupeIds(level: Level): Level {
  const used = new Set<string>([level.goal.id]);
  const unique = <T extends { id: string }>(items: T[]): T[] =>
    items.map((item) => {
      let id = item.id;
      for (let n = 2; used.has(id); n++) id = `${item.id}-${n}`;
      used.add(id);
      return id === item.id ? item : { ...item, id };
    });

  return {
    ...level,
    platforms: unique(level.platforms),
    hazards: unique(level.hazards),
    bouncers: unique(level.bouncers),
    movers: unique(level.movers),
    collectibles: unique(level.collectibles),
    teleporters: unique(level.teleporters),
    movingPlatforms: unique(level.movingPlatforms || []),
    coins: unique(level.coins),
    enemies: unique(level.enemies),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

/** Clamps to a finite number in [0, 1000], defaulting to 0 for anything else. */
function clampCoord(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1000, Math.max(0, n));
}

function sanitizeList<T>(list: unknown, sanitize: (raw: unknown) => T | null): T[] {
  if (!Array.isArray(list)) return [];
  return list.map(sanitize).filter((v): v is T => v !== null);
}

function sanitizePoint(raw: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  if (!isRecord(raw)) return fallback;
  return {
    x: typeof raw.x === "number" ? clampCoord(raw.x) : fallback.x,
    y: typeof raw.y === "number" ? clampCoord(raw.y) : fallback.y,
  };
}

/** id + x/y/w/h rectangle shape shared by platforms, hazards and the goal. */
function sanitizeRect<T extends { id: string; x: number; y: number; w: number; h: number }>(
  raw: unknown
): T | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  return {
    ...raw,
    id: raw.id,
    x: clampCoord(raw.x),
    y: clampCoord(raw.y),
    w: clampCoord(raw.w) || 1,
    h: clampCoord(raw.h) || 1,
  } as T;
}

function sanitizeHazard(raw: unknown): Hazard | null {
  const rect = sanitizeRect<Hazard>(raw);
  if (!rect) return null;
  const type = isRecord(raw) ? raw.type : undefined;
  return { ...rect, type: type === "lava" ? "lava" : "spike" };
}

function sanitizeMover(raw: unknown): Mover | null {
  const rect = sanitizeRect<Platform>(raw);
  if (!rect || !isRecord(raw)) return null;
  const { id, x, y, w, h } = rect;
  const m = raw.mask;
  if (
    isRecord(m) &&
    Number.isInteger(m.cols) &&
    Number.isInteger(m.rows) &&
    (m.cols as number) > 0 &&
    (m.rows as number) > 0 &&
    (m.cols as number) <= 4000 &&
    (m.rows as number) <= 4000 &&
    typeof m.bits === "string" &&
    /^[A-Za-z0-9+/=]*$/.test(m.bits)
  ) {
    return { id, x, y, w, h, mask: { cols: m.cols as number, rows: m.rows as number, bits: m.bits } };
  }
  return { id, x, y, w, h };
}

function sanitizeCoin(raw: unknown): Coin | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  return { id: raw.id, x: clampCoord(raw.x), y: clampCoord(raw.y) };
}

function sanitizeEnemy(raw: unknown): Enemy | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  return { id: raw.id, x: clampCoord(raw.x), y: clampCoord(raw.y), patrol: clampCoord(raw.patrol) };
}

function sanitizeCollectible(raw: unknown): Collectible | null {
  const rect = sanitizeRect<Collectible>(raw);
  if (!rect || !isRecord(raw)) return null;
  const type = raw.type === "star" || raw.type === "coin" ? raw.type : "egg";
  return {
    ...rect,
    w: rect.w || 30,
    h: rect.h || 30,
    type,
    collected: Boolean(raw.collected),
  };
}

function sanitizeTeleporter(raw: unknown): Teleporter | null {
  const rect = sanitizeRect<Teleporter>(raw);
  if (!rect || !isRecord(raw)) return null;
  return {
    ...rect,
    w: rect.w || 35,
    h: rect.h || 55,
    targetId: typeof raw.targetId === "string" ? raw.targetId : undefined,
    pairIndex: typeof raw.pairIndex === "number" ? Math.floor(raw.pairIndex) : undefined,
  };
}

function sanitizeMovingPlatform(raw: unknown): MovingPlatform | null {
  const rect = sanitizeRect<MovingPlatform>(raw);
  if (!rect || !isRecord(raw)) return null;
  const axis = raw.axis === "vertical" ? "vertical" : "horizontal";
  const distance = typeof raw.distance === "number" ? Math.max(30, clampCoord(raw.distance)) : 180;
  const speed = typeof raw.speed === "number" ? Math.max(20, Math.min(300, raw.speed)) : 80;
  return {
    ...rect,
    w: rect.w || 80,
    h: rect.h || 24,
    axis,
    distance,
    speed,
  };
}
