/**
 * Tiny synthesized sound effects (no asset files). The AudioContext is
 * created lazily on the first user input to satisfy browser autoplay
 * policy; until then every play*() call is a silent no-op.
 */

const MASTER_VOLUME = 0.12;
const UNLOCK_EVENTS = [
  "pointerdown",
  "pointerup",
  "mousedown",
  "mouseup",
  "touchstart",
  "touchend",
  "keydown",
  "click",
] as const;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let listening = false;
let musicEnabled = true;

/**
 * Call once at startup. Versucht sofortige Wiedergabe und schaltet Audio
 * bei der allerersten Nutzerinteraktion (Klick/Touch/Taste) sofort frei.
 */
export function installAudioUnlock() {
  if (typeof window === "undefined") return;

  // Versuche direkten Sofortstart (falls Browser Autoplay bereits erlaubt)
  unlock();

  if (listening) return;
  listening = true;
  for (const type of UNLOCK_EVENTS) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
    document.addEventListener(type, unlock, { capture: true, passive: true });
  }
}

function unlock() {
  const context = ensureContext();
  const music = getBgMusic();
  if (music && !muted && musicEnabled && music.paused) {
    music.play().catch(() => {});
  }
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume().then(() => {
      if (context.state === "running" && music && !music.paused) {
        removeUnlockListeners();
      }
    });
  } else if (context.state === "running" && music && !music.paused) {
    removeUnlockListeners();
  }
}

function removeUnlockListeners() {
  for (const type of UNLOCK_EVENTS) {
    window.removeEventListener(type, unlock, true);
    document.removeEventListener(type, unlock, true);
  }
  listening = false;
}

function ensureContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
    master = null;
  }
  return ctx;
}

type Tone = {
  freq: number;
  /** Frequency at the end of the tone, for sweeps. */
  endFreq?: number;
  type?: OscillatorType;
  /** Seconds from now. */
  delay?: number;
  duration: number;
  volume?: number;
};

let bgAudio: HTMLAudioElement | null = null;
let musicStarted = true;

export function getBgMusic(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!bgAudio) {
    const audio = new Audio();
    audio.id = "dino-bg-music";
    audio.loop = true;
    audio.preload = "auto";

    const base = import.meta.env.BASE_URL || "/";
    const cleanBase = base.endsWith("/") ? base : `${base}/`;
    audio.src = `${cleanBase}dino1.mp3`;
    audio.volume = muted ? 0 : 0.45;

    bgAudio = audio;
  }
  return bgAudio;
}

export function isMusicPlaying(): boolean {
  return bgAudio ? !bgAudio.paused : false;
}

export function isMusicEnabled() {
  return musicEnabled;
}

export function setMusicEnabled(enabled: boolean) {
  musicEnabled = enabled;
  const music = getBgMusic();
  if (!enabled) {
    if (music) music.pause();
  } else if (!muted) {
    musicStarted = true;
    if (music) music.play().catch(() => {});
  }
}

export function isMuted() {
  return muted;
}

/** Toggles mute and returns the new state. Works before the context exists. */
export function toggleMute(): boolean {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
  const music = getBgMusic();
  if (music) {
    music.volume = muted ? 0 : 0.45;
    if (muted || !musicEnabled) {
      music.pause();
    } else {
      musicStarted = true;
      music.play().catch(() => {});
    }
  }
  return muted;
}

export function startBgMusic() {
  if (typeof window === "undefined") return;
  musicStarted = true;
  const music = getBgMusic();
  if (music && !muted && musicEnabled && music.paused) {
    const p = music.play();
    if (p !== undefined) {
      p.catch(() => {
        // Autoplay Policy: Wenn der Browser den Sofortstart blockiert,
        // startet das Lied beim ersten Antippen/Klick des Nutzers.
      });
    }
  }
}

export function pauseBgMusic() {
  const music = getBgMusic();
  if (music) {
    music.pause();
  }
}

export function resumeBgMusic() {
  const music = getBgMusic();
  if (music && musicStarted && !muted && musicEnabled && music.paused) {
    music.play().catch(() => {});
  }
}

export function stopBgMusic() {
  musicStarted = false;
  const music = getBgMusic();
  if (music) {
    music.pause();
    music.currentTime = 0;
  }
}

function tone({ freq, endFreq, type = "square", delay = 0, duration, volume = 0.6 }: Tone) {
  if (!ctx || !master || muted || ctx.state !== "running") return;
  const start = ctx.currentTime + delay;
  const end = start + duration;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, end);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain).connect(master);
  osc.start(start);
  osc.stop(end + 0.02);
}

export function playJump() {
  tone({ freq: 280, endFreq: 620, type: "square", duration: 0.13, volume: 0.35 });
}

export function playCoin() {
  tone({ freq: 988, type: "square", duration: 0.07, volume: 0.35 });
  tone({ freq: 1319, type: "square", delay: 0.07, duration: 0.14, volume: 0.35 });
}

export function playDeath() {
  tone({ freq: 420, endFreq: 70, type: "sawtooth", duration: 0.4, volume: 0.5 });
  tone({ freq: 210, endFreq: 40, type: "square", delay: 0.05, duration: 0.35, volume: 0.3 });
}

export function playWin() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    tone({ freq, type: "triangle", delay: i * 0.11, duration: i === 3 ? 0.35 : 0.14, volume: 0.6 });
  });
}

export function playStomp() {
  tone({ freq: 240, endFreq: 90, type: "square", duration: 0.1, volume: 0.5 });
  tone({ freq: 520, endFreq: 760, type: "triangle", delay: 0.08, duration: 0.09, volume: 0.35 });
}

/** Soft two-note rise for a helper platform appearing. */
export function playHelper() {
  tone({ freq: 660, endFreq: 880, type: "triangle", duration: 0.09, volume: 0.22 });
  tone({ freq: 990, type: "triangle", delay: 0.08, duration: 0.16, volume: 0.2 });
}

/** Sci-fi / magic chime for teleporters and vortex. */
export function playTeleport() {
  tone({ freq: 440, endFreq: 880, type: "sine", duration: 0.15, volume: 0.35 });
  tone({ freq: 880, endFreq: 1320, type: "triangle", delay: 0.08, duration: 0.18, volume: 0.3 });
}

/** Feuriger Zisch- und Schuss-Sound beim Spucken eines Feuerballs */
export function playFireball() {
  tone({ freq: 480, endFreq: 180, type: "sawtooth", duration: 0.12, volume: 0.35 });
  tone({ freq: 220, endFreq: 80, type: "triangle", delay: 0.04, duration: 0.14, volume: 0.25 });
}

