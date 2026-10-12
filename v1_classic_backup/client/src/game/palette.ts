/** Marker colors and draw depths for the hand-drawn look. */
export const INK = {
  black: 0x1d1d24,
  blue: 0x2a6df4,
  blueDark: 0x1b4fc4,
  red: 0xd6453d,
  orange: 0xe8590c,
  lavaFill: 0xffb45e,
  green: 0x2fb457,
  greenDark: 0x1f8a40,
  yellow: 0xf2c200,
  yellowDark: 0xcf9d00,
  purple: 0x9b51e0,
  purpleDark: 0x6e2db3,
  brown: 0x8b5a2b,
  brownDark: 0x5c3317,
  grey: 0x4a4a55,
  paper: 0xf7f2e3,
} as const;

/** CSS versions for Phaser text styles. */
export const INK_CSS = {
  black: "#1d1d24",
  blue: "#2a6df4",
  red: "#d6453d",
  green: "#2fb457",
  yellow: "#f2c200",
  purple: "#9b51e0",
  orange: "#e8590c",
  brown: "#8b5a2b",
  paper: "#fffaf0",
} as const;

export const DEPTH = {
  paper: -100,
  staticLevel: -10,
  lava: 2,
  goal: 3,
  portal: 4,
  coin: 5,
  collectible: 6,
  enemy: 10,
  player: 12,
  particles: 100,
  debugHitboxes: 900,
} as const;

/** Animated things are redrawn this often (ms): ~8 fps, like frames of a flip-book. */
export const BOIL_MS = 125;
/** Number of distinct wobble poses each animated entity cycles through. */
export const BOIL_VARIANTS = 3;
