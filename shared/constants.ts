export const WORLD_W = 1600;
export const WORLD_H = 900;
export const GRAVITY = 1200;
export const JUMP_VELOCITY = 560;
export const RUN_SPEED = 240;
/** Upward speed a green bouncer gives the player (clearly stronger than a normal jump). */
export const BOUNCE_VELOCITY = 1180;
/** Terminal fall speed; together with the 120 Hz physics step this prevents tunnelling through thin lines. */
export const MAX_FALL_SPEED = 1000;
/** Player hitbox (the little ankylosaurus). */
export const PLAYER_W = 28;
export const PLAYER_H = 38;

export type GameMode = "jump_n_run" | "rpg_labyrinth";

