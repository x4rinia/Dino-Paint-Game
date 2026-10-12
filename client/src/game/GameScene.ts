import Phaser from "phaser";
import {
  BOUNCE_VELOCITY,
  JUMP_VELOCITY,
  PLAYER_H,
  WORLD_H,
  WORLD_W,
  gameEvents,
  sampleLevel,
  type DeathCause,
  type DeathEvent,
  type Level,
  type Platform,
  type WinEvent,
} from "@sketchquest/shared";
import { Player, type MoveInput, type GameMode } from "./Player";
import { Enemy } from "./Enemy";
import { AttemptState } from "./AttemptState";
import { playDeathEffect } from "./deathEffects";
import { burstParticles, coinBurst, resetParticleBudget } from "./particles";
import { Hud } from "./Hud";
import { WinOverlay } from "./WinOverlay";
import { RunRecorder } from "./RunRecorder";
import { ReplayController } from "./Replay";
import { LevelIntro } from "./LevelIntro";
import { TouchControls, touchControlsEnabled } from "./TouchControls";
import { RotateBanner } from "./RotateBanner";
import { isMuted, playCoin, playDeath, playHelper, playJump, playStomp, playTeleport, playWin, toggleMute, startBgMusic, pauseBgMusic, resumeBgMusic, stopBgMusic } from "./audio";
import { DebugOverlay } from "./DebugOverlay";
import { DEBUG } from "./debug";
import { prepareLevel } from "./prepareLevel";
import { COIN_SIZE, sx, sy } from "./units";
import { addBackground, type BackgroundTheme } from "./paper";
import { renderStaticLevel } from "./staticArt";
import { LevelDoodles, boilTick } from "./animatedArt";
import { DEPTH, INK, INK_CSS } from "./palette";
import { countAssists, drawAssistPlatform, isAssist, showAssistTag } from "./assistArt";
import { findHelperRect } from "./helperPlatform";
import { StuckHelper, STUCK_DEATHS, STUCK_RADIUS } from "./StuckHelper";
import { floatText } from "./floatingText";
import { HAND_FONT } from "./fonts";
import { fillPoly, hatchPoly, jitterPoints, rectCorners, seededFor, sketchCircle, sketchLine, sketchPoly } from "./sketch";

export const GAME_SCENE_KEY = "GameScene";

const COLORS = {
  platform: 0x4a4a4a,
  spike: 0xd6453d,
  lava: 0xff8a1f,
  coin: 0xf2c200,
  goal: 0x2fb457,
  bouncer: 0x2fb457,
  mover: 0x2a6df4,
};

const DEATH_EFFECT_MS = 600;
const FALL_MARGIN = 100;
/** Stomping an enemy bounces the player at a fraction of a full jump. */
const STOMP_BOUNCE_VELOCITY = JUMP_VELOCITY * 0.8;

type MoverEntity = {
  rect: Phaser.GameObjects.Rectangle;
  body: Phaser.Physics.Arcade.Body;
  art: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  w: number;
  h: number;
  id: string;
};

type BouncerEntity = {
  rect: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
};

type CollectibleEntity = {
  rect: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  id: string;
  collected: boolean;
};

type MovingPlatformEntity = {
  rect: Phaser.GameObjects.Rectangle;
  body: Phaser.Physics.Arcade.Body;
  art: Phaser.GameObjects.Graphics;
  startX: number;
  startY: number;
  w: number;
  h: number;
  axis: "horizontal" | "vertical";
  distance: number;
  speed: number;
  id: string;
};

type TeleporterEntity = {
  rect: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Graphics;
  id: string;
  targetId?: string;
  pairIndex?: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export class GameScene extends Phaser.Scene {
  level: Level = sampleLevel;

  player!: Player;
  platforms!: Phaser.Physics.Arcade.StaticGroup;
  bouncers!: Phaser.Physics.Arcade.StaticGroup;
  bouncersList: BouncerEntity[] = [];

  moversGroup!: Phaser.Physics.Arcade.Group;
  moversList: MoverEntity[] = [];

  collectiblesGroup!: Phaser.Physics.Arcade.StaticGroup;
  collectiblesList: CollectibleEntity[] = [];
  totalCollectibles = 0;
  collectedCount = 0;

  movingPlatformsGroup!: Phaser.Physics.Arcade.Group;
  movingPlatformsList: MovingPlatformEntity[] = [];

  teleportersGroup!: Phaser.Physics.Arcade.StaticGroup;
  teleportersList: TeleporterEntity[] = [];
  lastTeleportAt = -Infinity;
  lastGoalWarningTime = -Infinity;
  goalLockArt?: Phaser.GameObjects.Graphics;

  hazards: Phaser.GameObjects.Rectangle[] = [];
  coins: Phaser.GameObjects.Rectangle[] = [];
  enemies: Enemy[] = [];
  goal!: Phaser.GameObjects.Rectangle;

  private attemptState = new AttemptState();
  private doodles!: LevelDoodles;
  private hud!: Hud;
  private winOverlay?: WinOverlay;
  private recorder = new RunRecorder(0);
  private replayCtl?: ReplayController;
  private pendingReplay?: WinEvent;
  private debugOverlay?: DebugOverlay;
  private isExitedFromTeleporter = true;
  private goalDoorArt?: Phaser.GameObjects.Graphics;
  private stuck!: StuckHelper;
  private lastGrounded = { x: 0, feetY: 0 };
  private touchControls?: TouchControls;
  private rotateBanner?: RotateBanner;
  private dead = false;
  private won = false;
  private intro = false;
  private isPaused = false;
  private pauseContainer?: Phaser.GameObjects.Container;
  private fallThreshold = WORLD_H + FALL_MARGIN;
  private bgTheme: BackgroundTheme = "paper";
  private gameMode: GameMode = "jump_n_run";

  // Dschungel-Wind-System (Dynamische tropische Windböen)
  private windSpeed = 0;
  private targetWindSpeed = 0;
  private nextWindChangeAt = 0;
  private windLeavesGraphics?: Phaser.GameObjects.Graphics;
  private windLeaves: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    spin: number;
    size: number;
    color: number;
    alpha: number;
  }> = [];

  // Kosmischer Stardust (Weltraum-Schwerelosigkeit)
  private spaceDustGraphics?: Phaser.GameObjects.Graphics;
  private spaceDust: Array<{
    x: number;
    y: number;
    vy: number;
    size: number;
    color: number;
    alpha: number;
    twinkleSpeed: number;
  }> = [];

  // Magma-Glut & Funken (Vulkanlandschaft)
  private volcanoEmbersGraphics?: Phaser.GameObjects.Graphics;
  private volcanoEmbers: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: number;
    alpha: number;
  }> = [];

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private muteKey!: Phaser.Input.Keyboard.Key;
  private helperKey!: Phaser.Input.Keyboard.Key;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private editKey!: Phaser.Input.Keyboard.Key;

  // Gamepad State
  private lastGamepadRestart = false;
  private lastGamepadPause = false;

  constructor() {
    super(GAME_SCENE_KEY);
  }

  init(data: { level?: Level }) {
    this.level = data.level ?? sampleLevel;
  }

  private get locked() {
    return this.dead || this.won || this.intro || this.isPaused;
  }

  preload() {
    this.load.image("dino_idle", "./sprites/dino_idle.png");
    this.load.image("dino_walk", "./sprites/dino_walk.png");
    this.load.image("dino_jump", "./sprites/dino_jump.png");
    this.load.image("dino_run", "./sprites/dino_run.png");
    this.load.image("block_crate", "./sprites/block_crate.png");
    this.load.image("trampoline_mushroom", "./sprites/trampoline_mushroom.png");
    this.load.image("coin_dino", "./sprites/coin_dino.png");
    this.load.image("coin_egg", "./sprites/coin_egg.png");
    this.load.image("coin_footprint", "./sprites/coin_footprint.png");
    this.load.image("enemy_snail", "./sprites/enemy_snail.png");
    this.load.image("enemy_plant", "./sprites/enemy_plant.png");
    this.load.image("enemy_bug", "./sprites/enemy_bug.png");
    this.load.image("hazard_spikes", "./sprites/hazard_spikes.png");
    this.load.image("goal_flag", "./sprites/goal_flag.png");
    this.load.image("platform_moss", "./sprites/platform_moss.png");
  }

  create() {
    const { level } = this;

    // Reset scene state
    this.hazards = [];
    this.coins = [];
    this.enemies = [];
    this.moversList = [];
    this.movingPlatformsList = [];
    this.dead = false;
    this.won = false;
    this.intro = false;
    this.isPaused = false;
    this.winOverlay = undefined;
    this.replayCtl = undefined;
    this.pendingReplay = undefined;
    if (this.pauseContainer) {
      this.pauseContainer.destroy();
      this.pauseContainer = undefined;
    }

    if (this.windLeavesGraphics) {
      this.windLeavesGraphics.destroy();
      this.windLeavesGraphics = undefined;
    }
    this.windLeaves = [];

    if (this.spaceDustGraphics) {
      this.spaceDustGraphics.destroy();
      this.spaceDustGraphics = undefined;
    }
    this.spaceDust = [];

    if (this.volcanoEmbersGraphics) {
      this.volcanoEmbersGraphics.destroy();
      this.volcanoEmbersGraphics = undefined;
    }
    this.volcanoEmbers = [];

    this.physics.world.resume();
    this.attemptState.reset(this);
    this.recorder = new RunRecorder(level.enemies.length);
    this.recorder.clear(this.time.now);
    resetParticleBudget(this);
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H + FALL_MARGIN + 50);

    // Visuelle Ebenen: Gewählter Hintergrund (Notizheft, Dschungel, Kosmos, Vulkan)
    const bgTheme = (this.game.registry.get("backgroundTheme") as BackgroundTheme) || "paper";
    const gameMode = (this.game.registry.get("gameMode") as GameMode) || "jump_n_run";
    this.bgTheme = bgTheme;
    this.gameMode = gameMode;
    addBackground(this, bgTheme);

    // Welt-Gravitation basierend auf Spielmodus & Hintergrund:
    // - RPG Maker Modus: Keine Abwärts-Gravitation (0) – 4-Wege Labyrinth-Bewegung!
    // - Jump 'n' Run: Kosmos ("space") = 520, Dschungel/Notizheft/Vulkan = 1200
    if (gameMode === "rpg_labyrinth") {
      this.physics.world.gravity.y = 0;
    } else if (bgTheme === "space") {
      this.physics.world.gravity.y = 520;
    } else {
      this.physics.world.gravity.y = 1200;
    }

    // Atmosphärische Effekte je nach Spielwelt:
    if (bgTheme === "jungle") {
      this.initJungleWind();
    } else if (bgTheme === "space") {
      this.initSpaceStardust();
    } else if (bgTheme === "volcano") {
      this.initVolcanoEmbers();
    }

    // Falls eine Originalzeichnung existiert, zeichne sie als Hintergrund
    const origImage = (level as any).originalImage;
    if (origImage && typeof origImage === "string") {
      this.loadOriginalBackdrop(origImage);
    }

    renderStaticLevel(this, level);
    this.physics.world.debugGraphic?.setDepth(DEPTH.debugHitboxes);

    // 1. SCHWARZ: Feste Plattformen
    this.platforms = this.physics.add.staticGroup();
    for (const p of level.platforms) {
      this.platforms.add(this.rectTopLeft(p, COLORS.platform));
    }

    // 2. GRÜN: Sprungflächen / Trampoline
    this.bouncers = this.physics.add.staticGroup();
    this.bouncersList = [];
    // 2. GRÜN: Sprungfedern & Trampoline (Pilz-Feder)
    for (const b of (level.bouncers ?? [])) {
      const bw = sx(b.w);
      const bh = sy(b.h);
      const bx = sx(b.x) + bw / 2;
      const by = sy(b.y) + bh / 2;
      const rect = this.add.rectangle(bx, by, bw, bh, COLORS.bouncer).setAlpha(0);
      rect.setData("id", b.id);
      this.physics.add.existing(rect, true);
      this.bouncers.add(rect);

      let art: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
      if (this.textures.exists("trampoline_mushroom")) {
        // Natürliche, wohlproportionierte Maße für den neuen symmetrischen Pilz
        const mH = Math.max(46, Math.min(56, bw * 0.85));
        const mW = mH * (174 / 256);
        art = this.add.image(bx, by - (mH - bh) / 2, "trampoline_mushroom").setDisplaySize(mW, mH).setDepth(DEPTH.staticLevel + 2);
      } else {
        const g = this.add.graphics().setDepth(DEPTH.staticLevel + 2);
        this.drawBouncerArt(g, bw, bh, b.id);
        g.setPosition(bx, by);
        art = g;
      }

      this.bouncersList.push({ rect, art, x: bx, y: by, w: bw, h: bh, id: b.id });
    }

    // 3. BLAU: Bewegliche Physikobjekte (Holz-Kisten)
    this.moversGroup = this.physics.add.group();
    for (const m of (level.movers ?? [])) {
      const mw = sx(m.w);
      const mh = sy(m.h);
      const mx = sx(m.x) + mw / 2;
      const my = sy(m.y) + mh / 2;
      const rect = this.add.rectangle(mx, my, mw, mh, COLORS.mover).setAlpha(0);
      this.physics.add.existing(rect, false);
      const body = rect.body as Phaser.Physics.Arcade.Body;
      body.setCollideWorldBounds(true);
      body.setBounce(0.0);
      // Hoher Reibungswiderstand: Block stoppt sofort bei Wänden oder wenn Dino aufhört zu schieben!
      body.setDrag(1200, this.gameMode === "rpg_labyrinth" ? 1200 : 0);
      body.setFriction(1, 1);
      body.setMass(2.0);

      let art: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
      if (this.textures.exists("block_crate")) {
        art = this.add.image(mx, my, "block_crate").setDisplaySize(mw, mh).setDepth(DEPTH.staticLevel + 3);
      } else {
        const g = this.add.graphics().setDepth(DEPTH.staticLevel + 3);
        this.drawMoverArt(g, mw, mh, m.id);
        g.setPosition(mx, my);
        art = g;
      }

      this.moversGroup.add(rect);
      this.moversList.push({ rect, body, art, w: mw, h: mh, id: m.id });
    }

    // 4. ROT: Gefahren
    for (const h of level.hazards) {
      const r = this.rectTopLeft(h, h.type === "lava" ? COLORS.lava : COLORS.spike);
      r.setData("hazardType", h.type);
      this.physics.add.existing(r, true);
      this.hazards.push(r);
    }

    // 5. GELB: Sammelobjekte (Ausschließlich Dino-Eier – keine separaten Münzen!)
    const allEggs = [
      ...(level.collectibles ?? []),
      ...(level.coins ?? []).map((coin) => ({
        id: coin.id,
        x: coin.x,
        y: coin.y,
        w: 30,
        h: 30,
        type: "egg" as const,
        collected: false,
      })),
    ];
    this.collectiblesGroup = this.physics.add.staticGroup();
    this.collectiblesList = [];
    this.totalCollectibles = allEggs.length;
    this.collectedCount = 0;

    for (const c of allEggs) {
      // Schlanke, wohlproportionierte Dino-Münzen (ca. 26px, blockieren keine Korridore)
      const COIN_SIZE = 26;
      const cx = sx(c.x) + sx(c.w ?? 24) / 2;
      const cy = sy(c.y) + sy(c.h ?? 24) / 2;

      const rect = this.add.rectangle(cx, cy, COIN_SIZE, COIN_SIZE, COLORS.coin).setAlpha(0);
      rect.setData("id", c.id);
      this.physics.add.existing(rect, true);
      this.collectiblesGroup.add(rect);

      let art: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
      if (this.textures.exists("coin_dino")) {
        art = this.add.image(cx, cy, "coin_dino").setDisplaySize(COIN_SIZE, COIN_SIZE).setDepth(DEPTH.collectible);
      } else if (this.textures.exists("coin_egg")) {
        art = this.add.image(cx, cy, "coin_egg").setDisplaySize(COIN_SIZE, COIN_SIZE).setDepth(DEPTH.collectible);
      } else {
        const g = this.add.graphics().setDepth(DEPTH.collectible);
        this.drawEggArt(g, COIN_SIZE, COIN_SIZE, c.id);
        g.setPosition(cx, cy);
        art = g;
      }

      // Sanftes Schweben (Bobbing)
      this.tweens.add({
        targets: art,
        y: cy - 5,
        duration: 650 + (c.x % 300),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.collectiblesList.push({ rect, art, id: c.id, collected: false });
    }

    // 6. LILA: Bewegliche Plattformen (Lifte / Schwebende Plattformen)
    this.movingPlatformsGroup = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    });
    this.movingPlatformsList = [];

    for (const mp of (level.movingPlatforms ?? [])) {
      const mw = sx(mp.w);
      const mh = sy(mp.h);
      const mx = sx(mp.x) + mw / 2;
      const my = sy(mp.y) + mh / 2;

      const rect = this.add.rectangle(mx, my, mw, mh, INK.purple).setAlpha(0);
      rect.setData("id", mp.id);
      this.physics.add.existing(rect, false);
      const body = rect.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setImmovable(true);
      body.friction.x = 1;
      body.friction.y = 0;

      // Einweg-Kollision: Verhindert seitliches Hängenbleiben und Ruckeln
      body.checkCollision.up = true;
      body.checkCollision.down = false;
      body.checkCollision.left = false;
      body.checkCollision.right = false;

      const art = this.add.graphics().setDepth(DEPTH.staticLevel + 2);
      this.drawMovingPlatformArt(art, mw, mh, mp.id, mp.axis);
      art.setPosition(mx, my);

      this.movingPlatformsGroup.add(rect);

      const distPx = mp.axis === "horizontal" ? sx(mp.distance ?? 140) : sy(mp.distance ?? 140);

      this.movingPlatformsList.push({
        rect,
        body,
        art,
        startX: mx,
        startY: my,
        w: mw,
        h: mh,
        axis: mp.axis ?? (mw >= mh ? "horizontal" : "vertical"),
        distance: Math.max(50, distPx),
        speed: mp.speed ? mp.speed / 50 : 1.4,
        id: mp.id,
      });
    }

    // 7. LILA (Legacy): Teleporter-Portale
    this.teleportersGroup = this.physics.add.staticGroup();
    this.teleportersList = [];
    for (const t of (level.teleporters ?? [])) {
      const tw = sx(t.w ?? 35);
      const th = sy(t.h ?? 55);
      const tx = sx(t.x) + tw / 2;
      const ty = sy(t.y) + th / 2;

      const rect = this.add.rectangle(tx, ty, tw, th, INK.purple).setAlpha(0);
      rect.setData("id", t.id);
      rect.setData("targetId", t.targetId);
      this.physics.add.existing(rect, true);
      this.teleportersGroup.add(rect);

      const art = this.add.graphics().setDepth(DEPTH.portal);
      this.drawTeleporterArt(art, tw, th, t.id, t.pairIndex);
      art.setPosition(tx, ty);

      // Pulsieren
      this.tweens.add({
        targets: art,
        scaleX: 1.05,
        scaleY: 0.95,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      if (t.pairIndex) {
        this.add
          .text(tx, ty + th / 2 + 10, `P${t.pairIndex}`, {
            fontFamily: HAND_FONT,
            fontSize: "16px",
            color: INK_CSS.purple,
            stroke: INK_CSS.paper,
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(DEPTH.portal + 1);
      }

      this.teleportersList.push({
        rect,
        art,
        id: t.id,
        targetId: t.targetId,
        pairIndex: t.pairIndex,
        x: tx,
        y: ty,
        w: tw,
        h: th,
      });
    }

    // Ziel & Tor: Unsichtbare Hitbox & detailreiches Stein- und Holztor mit Portal-Magie
    this.goal = this.rectTopLeft(level.goal, COLORS.goal);
    this.goal.setAlpha(0); // Niemals als flacher grüner Kasten darstellen!
    this.physics.add.existing(this.goal, true);

    this.coins = [];
    this.doodles = new LevelDoodles(this, level, this.coins);

    const isGoalLocked = this.totalCollectibles > 0;
    this.doodles.setGoalLocked(isGoalLocked);
    this.redrawGoalDoor(isGoalLocked);

    for (const e of level.enemies) {
      const enemy = new Enemy(this, e.id, sx(e.x), sy(e.y), e.patrol);
      this.physics.add.collider(enemy.rect, this.platforms);
      this.enemies.push(enemy);
    }

    // Spieler (Dino)
    const startX = sx(level.start.x);
    const startY = sy(level.start.y);
    this.player = new Player(this, startX, startY);
    this.player.setGravityMode(bgTheme === "space" ? "low" : "normal");
    this.player.setGameMode(gameMode);
    this.player.setAllowDoubleJump(bgTheme === "volcano");
    this.player.onJump = () => this.recorder.addJump(this.time.now);

    // Kollisionen: Spieler mit Plattformen (Dino steht fest auf Plattformen; im Jump 'n' Run Durchspringen von unten beim Sprung)
    this.physics.add.collider(
      this.player.rect,
      this.platforms,
      undefined,
      (playerObj, platformObj) => {
        // 1. Im 4-Wege Labyrinth (RPG) immer feste, solide Kollision in alle Richtungen (kein Durchgehen von unten):
        if (this.gameMode !== "jump_n_run") return true;

        const pBody = (playerObj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
        const platRect = platformObj as Phaser.GameObjects.Rectangle;
        // Da Origin (0, 0) ist, ist platRect.y exakt die Oberkante der Plattform
        const platTop = platRect.y;

        // 2. Nur beim aktiven Aufwärtssprung kann Dino von unten durch Plattformen hindurchspringen:
        if (pBody.velocity.y < 0) {
          return false;
        }

        // 3. Beim Fallen oder Stehen: Dino landet fest auf der Plattform und bleibt sicher stehen:
        if (pBody.bottom <= platTop + 14) {
          return true;
        }

        // Wenn er im vorherigen Frame bereits auf der Plattformoberkante stand, niemals durchfallen lassen:
        if (pBody.prev && pBody.prev.y + pBody.height <= platTop + 8) {
          return true;
        }

        return false;
      }
    );

    // Kollisionen: Spieler mit grünen Trampolinen (im Labyrinth als Bumper-Rückstoß)
    this.physics.add.collider(this.player.rect, this.bouncers, (_p, bouncerRect) => {
      if (this.gameMode === "rpg_labyrinth") {
        this.handleTrampolineBounce(bouncerRect as Phaser.GameObjects.Rectangle);
      } else {
        const isBounceHit = this.player.body.touching.down || this.player.isFalling;
        if (isBounceHit) {
          this.handleTrampolineBounce(bouncerRect as Phaser.GameObjects.Rectangle);
        }
      }
    });

    // Overlap: Spieler mit Sammelobjekten (Gelbe Dino-Eier)
    this.physics.add.overlap(this.player.rect, this.collectiblesGroup, (_p, colRect) => {
      this.collectEgg(colRect as Phaser.GameObjects.Rectangle);
    });

    // Kollisionen: Spieler mit beweglichen Plattformen (Liften)
    this.physics.add.collider(this.player.rect, this.movingPlatformsGroup);

    // Overlap: Spieler mit Teleportern (Lila Portale)
    this.physics.add.overlap(this.player.rect, this.teleportersGroup, (_p, tpRect) => {
      this.handleTeleporter(tpRect as Phaser.GameObjects.Rectangle);
    });

    // Kollisionen: Blaue Objekte untereinander (Stapeln & Schieben) und mit Plattformen/Liften
    this.physics.add.collider(this.moversGroup, this.platforms);
    this.physics.add.collider(this.moversGroup, this.bouncers);
    this.physics.add.collider(this.moversGroup, this.movingPlatformsGroup);
    this.physics.add.collider(this.moversGroup, this.moversGroup, (m1Obj, m2Obj) => {
      if (this.gameMode === "rpg_labyrinth") {
        const b1 = (m1Obj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
        const b2 = (m2Obj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
        if (Math.abs(b1.velocity.x) > 30 && Math.abs(b2.velocity.x) < 30) b2.setVelocityX(b1.velocity.x * 0.9);
        else if (Math.abs(b2.velocity.x) > 30 && Math.abs(b1.velocity.x) < 30) b1.setVelocityX(b2.velocity.x * 0.9);
        if (Math.abs(b1.velocity.y) > 30 && Math.abs(b2.velocity.y) < 30) b2.setVelocityY(b1.velocity.y * 0.9);
        else if (Math.abs(b2.velocity.y) > 30 && Math.abs(b1.velocity.y) < 30) b1.setVelocityY(b2.velocity.y * 0.9);
      }
    });

    // 🧱 Kisten auf Gefahren: Stachel-Brücke & Lava-Floß
    for (const h of this.hazards) {
      this.physics.add.collider(this.moversGroup, h, (mObj) => {
        const hazardType = (h as Phaser.GameObjects.Rectangle).getData("hazardType");
        const mRect = mObj as Phaser.GameObjects.Rectangle;
        const mBody = mRect.body as Phaser.Physics.Arcade.Body;
        if (hazardType === "lava") {
          // Holz-Kiste schwimmt auf Lava wie ein Floß!
          const hTop = h.y;
          if (mRect.y + mRect.height / 2 >= hTop) {
            mBody.setVelocityY(Math.min(mBody.velocity.y * 0.15, -20));
          }
          if (Math.random() < 0.05) {
            burstParticles(this, mRect.x + (Math.random() - 0.5) * 16, hTop, {
              color: 0xf97316,
              count: 2,
              speed: [15, 45],
              size: 3,
              duration: 260,
            });
          }
        }
      });
    }

    // Kollision: Spieler mit blauen Objekten (schieben & draufstehen)
    this.physics.add.collider(this.player.rect, this.moversGroup, (pObj, mObj) => {
      const pBody = (pObj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
      const mBody = (mObj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;

      if (this.gameMode === "rpg_labyrinth") {
        // Sokoban-Schieben in alle 4 Richtungen:
        const pushForce = 210;
        if (pBody.velocity.x > 15 && this.player.x < mBody.x) {
          mBody.setVelocityX(pushForce);
        } else if (pBody.velocity.x < -15 && this.player.x > mBody.x) {
          mBody.setVelocityX(-pushForce);
        }
        if (pBody.velocity.y > 15 && this.player.y < mBody.y) {
          mBody.setVelocityY(pushForce);
        } else if (pBody.velocity.y < -15 && this.player.y > mBody.y) {
          mBody.setVelocityY(-pushForce);
        }
      } else {
        if (pBody.touching.right && mBody.touching.left) {
          mBody.setVelocityX(Math.max(140, pBody.velocity.x * 0.95));
        } else if (pBody.touching.left && mBody.touching.right) {
          mBody.setVelocityX(Math.min(-140, pBody.velocity.x * 0.95));
        }
        if (pBody.touching.down) {
          this.lastGrounded = { x: this.player.x, feetY: this.player.bottom };
        }
      }
    });

    // Overlap: Blaue Kisten mit Teleportern (Beamen & Vortex-Flug!)
    this.physics.add.overlap(this.moversGroup, this.teleportersGroup, (mObj, tpRect) => {
      this.handleMoverTeleporter(mObj as Phaser.GameObjects.Rectangle, tpRect as Phaser.GameObjects.Rectangle);
    });

    // Kollisionen: Gefahren, Münzen, Ziel, Gegner
    this.physics.add.overlap(this.player.rect, this.hazards, (_p, hazard) => {
      // Wenn Dino sicher auf einer Kiste steht (Lava-Floß oder Stachel-Brücke), stirbt er nicht!
      if (this.isPlayerStandingOnCrate()) {
        return;
      }
      const type = (hazard as Phaser.GameObjects.Rectangle).getData("hazardType") as DeathCause;
      this.triggerDeath(type, this.player.x, this.player.y);
    });
    this.physics.add.overlap(this.player.rect, this.coins, (_p, coin) => {
      this.collectCoin(coin as Phaser.GameObjects.Rectangle);
    });

    // Zielerreichung (prüft ob alle gelben Objekte gesammelt wurden)
    this.physics.add.overlap(this.player.rect, this.goal, () => {
      if (this.totalCollectibles > 0 && this.collectedCount < this.totalCollectibles) {
        if (this.time.now - this.lastGoalWarningTime > 1500) {
          this.lastGoalWarningTime = this.time.now;
          floatText(
            this,
            `Sammle zuerst alle Dino-Münzen! (${this.collectedCount}/${this.totalCollectibles}) 🪙`,
            this.goal.x + this.goal.width / 2,
            this.goal.y - 30,
            INK_CSS.orange
          );
        }
        return;
      }
      this.triggerWin();
    });

    // Gegner-Interaktionen: Spieler-Kollision und Kisten-Plätten
    for (const enemy of this.enemies) {
      this.physics.add.overlap(this.player.rect, enemy.rect, () => this.handleEnemyOverlap(enemy));

      // 💥 Kisten plätten Gegner (beim Drauffallen oder Schieben in Jump 'n' Run & Labyrinth)
      this.physics.add.collider(this.moversGroup, enemy.rect, (mObj) => {
        if (!enemy.alive) return;
        const mRect = mObj as Phaser.GameObjects.Rectangle;
        const mBody = mRect.body as Phaser.Physics.Arcade.Body;

        const isCrush =
          this.gameMode === "rpg_labyrinth"
            ? Math.abs(mBody.velocity.x) > 20 || Math.abs(mBody.velocity.y) > 20
            : mBody.velocity.y > 15 || mRect.y < enemy.midY - 8 || Math.abs(mBody.velocity.x) > 35;

        if (isCrush) {
          enemy.kill();
          playStomp();
          burstParticles(this, enemy.midX, enemy.midY, {
            color: 0xe8590c,
            count: 24,
            speed: [80, 260],
            size: 9,
            duration: 400,
          });
          floatText(this, "💥 Kiste plättet Gegner!", enemy.midX, enemy.midY - 30, INK_CSS.orange);
        }
      });
    }

    this.hud = new Hud(this);
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);

    const isTv = this.registry.get("tvMode") || false;
    if (isTv) {
      this.hud.setTvMode(true);
    }

    const touch = touchControlsEnabled(this);
    this.touchControls = touch ? new TouchControls(this, gameMode) : undefined;
    if (isTv && this.touchControls) {
      // Im TV-Modus standardmäßig Touch ausblenden
      this.touchControls.setVisible(false);
    }

    this.rotateBanner = touch ? new RotateBanner(this) : undefined;
    this.stuck = new StuckHelper(this, touch, () => this.useHelper());
    this.lastGrounded = { x: sx(level.start.x), feetY: sy(level.start.y) + PLAYER_H / 2 };

    // Gamepad-Verbindungsereignisse & Touch-Wiedereinblendung
    const onGpConnected = (e: GamepadEvent) => {
      floatText(this, `🎮 Controller: ${e.gamepad.id.slice(0, 24)}`, 500, 160, INK_CSS.green);
      this.touchControls?.setVisible(false);
    };
    const onGpDisconnected = () => {
      floatText(this, "🎮 Controller getrennt", 500, 160, INK_CSS.red);
    };
    window.addEventListener("gamepadconnected", onGpConnected);
    window.addEventListener("gamepaddisconnected", onGpDisconnected);

    this.input.on("pointerdown", () => {
      if (this.touchControls && !this.touchControls.isVisible()) {
        this.touchControls.setVisible(true);
      }
    });

    this.events.once("shutdown", () => {
      window.removeEventListener("gamepadconnected", onGpConnected);
      window.removeEventListener("gamepaddisconnected", onGpDisconnected);
    });

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys("W,A,S,D") as typeof this.keys;
    this.restartKey = kb.addKey("R");
    this.muteKey = kb.addKey("M");
    this.helperKey = kb.addKey("H");
    this.pauseKey = kb.addKey("ESC");
    this.editKey = kb.addKey("E");

    this.hud.setMuted(isMuted());

    if (DEBUG) {
      this.debugOverlay = new DebugOverlay(this);
      kb.on("keydown-D", (e: KeyboardEvent) => {
        if (e.shiftKey) this.copyLevelJson();
      });
    }

    startBgMusic();

    this.startIntro();
  }

  update(time: number, delta: number) {
    // Pause umschalten per ESC, Gamepad oder Touch
    const gp = this.readGamepad();
    const touchInput = this.touchControls?.read();

    // Auto-Hide Touch-Steuerung wenn Controller aktiv bedient wird
    if (gp.left || gp.right || gp.jump || gp.restart || gp.pause) {
      if (this.touchControls?.isVisible()) {
        this.touchControls.setVisible(false);
      }
    }

    const pauseRequested =
      Phaser.Input.Keyboard.JustDown(this.pauseKey) ||
      (gp.pause && !this.lastGamepadPause) ||
      touchInput?.pause;

    this.lastGamepadPause = gp.pause;

    if (pauseRequested && !this.dead && !this.won && !this.intro) {
      this.togglePause();
      return;
    }

    if (this.isPaused) return;

    if (Phaser.Input.Keyboard.JustDown(this.muteKey)) {
      this.hud.setMuted(toggleMute());
    }
    this.stuck.suppress(this.won || this.intro);

    // Neustart per R oder Gamepad Y
    const restartRequested =
      Phaser.Input.Keyboard.JustDown(this.restartKey) ||
      (gp.restart && !this.lastGamepadRestart);
    this.lastGamepadRestart = gp.restart;

    if (restartRequested && !this.dead && !this.intro) {
      this.restartLevel();
      return;
    }

    // Level bearbeiten per E-Taste
    if (Phaser.Input.Keyboard.JustDown(this.editKey) && !this.intro) {
      gameEvents.emit("editLevel");
      return;
    }

    if (this.pendingReplay) this.beginReplay(this.pendingReplay);
    if (this.replayCtl) {
      this.replayCtl.update(delta);
      this.rotateBanner?.update();
      this.doodles.update(this);
      this.hud.setCoins(this.replayCtl.coinsCollected);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.helperKey)) this.useHelper();

    // Braun: bewegliche Plattformen (Lifte) animieren & Spieler sauber mitführen
    const dt = Math.max(0.001, Math.min(delta / 1000, 0.05));

    for (const mp of this.movingPlatformsList) {
      const moveSpeed = mp.speed > 5 ? mp.speed : 80;
      const travelDist = mp.distance ?? 160;
      const cycleDuration = Math.max(2.5, (travelDist * 2) / moveSpeed);
      const phase = ((time / 1000) % cycleDuration) / cycleDuration;
      const offset = Math.sin(phase * Math.PI * 2) * (travelDist * 0.5);

      const targetX = mp.axis === "horizontal" ? mp.startX + offset : mp.startX;
      const targetY = mp.axis === "vertical" ? mp.startY + offset : mp.startY;

      const prevX = mp.rect.x;
      const prevY = mp.rect.y;
      const dx = targetX - prevX;
      const dy = targetY - prevY;

      mp.rect.setPosition(targetX, targetY);
      mp.art.setPosition(targetX, targetY);

      // Durch Zuweisen der echten Physik-Geschwindigkeit nutzt Phaser Arcade Physics
      // automatisch native Plattformreibung (friction.x = 1). Dadurch bleibt der Dino
      // stabil darauf stehen UND kann frei darauf laufen (kein "Förderband-Effekt" mehr!).
      mp.body.setVelocity(dx / dt, dy / dt);

      if (this.player && !this.locked) {
        const platTop = targetY - mp.h / 2;
        const platLeft = targetX - mp.w / 2;
        const platRight = targetX + mp.w / 2;
        const playerX = this.player.x;
        const playerBottom = this.player.bottom;

        const isOnPlat =
          Math.abs(playerBottom - platTop) <= 12 &&
          playerX >= platLeft - 8 &&
          playerX <= platRight + 8;

        if (isOnPlat) {
          this.lastGrounded = { x: playerX, feetY: playerBottom };
          if (dy > 0) {
            // Vertikaler Abstieg: sanft auf der Plattform halten
            this.player.rect.y += dy;
            this.player.body.y += dy;
          }
        }
      }
    }

    const input = this.readCombinedInput(gp, touchInput);
    this.player.handleInput(input, this.locked);

    // Teleporter Exit-Prüfung: Erst wenn Dino den Teleporter komplett verlassen hat,
    // darf wieder teleportiert werden (verhindert den Hin- und Her-Teleport-Loop)
    if (!this.isExitedFromTeleporter) {
      const isOverlapping = this.physics.overlap(this.player.rect, this.teleportersGroup);
      if (!isOverlapping) {
        this.isExitedFromTeleporter = true;
      }
    }

    // Atmosphärische Partikel & Effekte je nach Spielwelt
    if (this.bgTheme === "jungle") {
      this.updateJungleWind(time, delta);
    } else if (this.bgTheme === "space") {
      this.updateSpaceStardust(time, delta);
    } else if (this.bgTheme === "volcano") {
      this.updateVolcanoEmbers(time, delta);
    }

    if (!this.locked && this.player.body.blocked.down) {
      this.lastGrounded = { x: this.player.x, feetY: this.player.bottom };
    }
    this.rotateBanner?.update();
    if (!this.locked) this.recorder.update(this.time.now, this.player, this.enemies);

    if (!this.locked) {
      if (this.player.y > this.fallThreshold) {
        this.triggerDeath("fall", this.player.x, this.player.y);
      }
    }

    const tick = boilTick(this);
    this.player.draw(tick);
    for (const enemy of this.enemies) {
      enemy.update(this, this.platforms);
      enemy.draw(tick);
    }

    // Blaue bewegliche Objekte synchronisieren
    for (const m of this.moversList) {
      m.art.setPosition(m.rect.x, m.rect.y);
    }

    this.doodles.update(this);
    this.hud.setCoins(this.attemptState.coins);
    this.debugOverlay?.update(
      this.attemptState.attempt,
      this.attemptState.lastDeathsAtSpot,
      this.attemptState.timeAlive(this),
      countAssists(this.level.platforms) + this.stuck.used
    );
  }

  private togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      pauseBgMusic();
      this.physics.world.pause();
      this.showPauseOverlay();
    } else {
      resumeBgMusic();
      if (this.pauseContainer) {
        this.pauseContainer.destroy();
        this.pauseContainer = undefined;
      }
      this.physics.world.resume();
    }
  }

  private showPauseOverlay() {
    const cx = WORLD_W / 2;
    const cy = WORLD_H / 2;
    const rng = seededFor("pause-card");

    const bg = this.add.rectangle(cx, cy, WORLD_W, WORLD_H, 0x000000, 0.45).setScrollFactor(0).setDepth(2400);
    const card = this.add.graphics().setScrollFactor(0).setDepth(2401);
    const corners = jitterPoints(rectCorners(cx - 240, cy - 130, 480, 260), 3, rng);
    fillPoly(card, corners, INK.paper, 0.98);
    sketchPoly(card, corners, { color: INK.black, width: 5, wobble: 2 }, rng);

    const title = this.add
      .text(cx, cy - 65, "SPIEL PAUSIERT", {
        fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
        fontSize: "52px",
        color: INK_CSS.black,
        stroke: INK_CSS.paper,
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2402);

    const hint = this.add
      .text(cx, cy - 8, "Tippen oder Start / ESC zum Fortsetzen\nR oder Y zum Neustarten • E zum Bearbeiten", {
        fontFamily: '"Comic Sans MS", "Marker Felt", cursive',
        fontSize: "22px",
        color: INK_CSS.blue,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2402);

    const editBtn = this.add
      .text(cx, cy + 62, "✏️ Level im Studio bearbeiten (E)", {
        fontFamily: HAND_FONT,
        fontSize: "26px",
        color: "#ffffff",
        backgroundColor: "#9b51e0",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2403)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        gameEvents.emit("editLevel");
      });

    bg.setInteractive().on("pointerdown", () => this.togglePause());

    this.pauseContainer = this.add.container(0, 0, [bg, card, title, hint, editBtn]);
  }

  /** Liest Tastatur, Touch und Gamepad gemeinsam aus */
  private readCombinedInput(
    gp: { left: boolean; right: boolean; up?: boolean; down?: boolean; jump: boolean },
    touch?: { left: boolean; right: boolean; up?: boolean; down?: boolean; jump: boolean }
  ): MoveInput {
    const { cursors, keys } = this;
    const isRpg = this.gameMode === "rpg_labyrinth";
    return {
      left: cursors.left.isDown || keys.A.isDown || !!touch?.left || gp.left,
      right: cursors.right.isDown || keys.D.isDown || !!touch?.right || gp.right,
      up: cursors.up.isDown || keys.W.isDown || !!touch?.up || !!gp.up,
      down: cursors.down.isDown || keys.S.isDown || !!touch?.down || !!gp.down,
      jump: isRpg
        ? cursors.space.isDown || !!touch?.jump || gp.jump
        : cursors.up.isDown || cursors.space.isDown || keys.W.isDown || !!touch?.jump || gp.jump,
    };
  }

  /** Pollt die Browser Gamepad API für Xbox / Bluetooth Controller */
  private readGamepad(): {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    jump: boolean;
    restart: boolean;
    pause: boolean;
  } {
    const res = { left: false, right: false, up: false, down: false, jump: false, restart: false, pause: false };
    if (typeof navigator.getGamepads !== "function") return res;

    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const g = gamepads[i];
      if (!g || !g.connected) continue;

      const stickX = g.axes[0] ?? 0;
      const stickY = g.axes[1] ?? 0;
      const dpadLeft = g.buttons[14]?.pressed ?? false;
      const dpadRight = g.buttons[15]?.pressed ?? false;
      const dpadUp = g.buttons[12]?.pressed ?? false;
      const dpadDown = g.buttons[13]?.pressed ?? false;

      if (stickX < -0.28 || dpadLeft) res.left = true;
      if (stickX > 0.28 || dpadRight) res.right = true;
      if (stickY < -0.28 || dpadUp) res.up = true;
      if (stickY > 0.28 || dpadDown) res.down = true;

      // Button 0 (A) bzw. Button 1 (B wenn swapAB aktiv) -> Springen / Dash
      const swapAB = (this.game.registry.get("gamepadSwapAB") as boolean) || false;
      const jumpPressed = swapAB ? (g.buttons[1]?.pressed ?? false) : (g.buttons[0]?.pressed ?? false);
      if (jumpPressed || (this.gameMode !== "rpg_labyrinth" && dpadUp)) res.jump = true;
      // Button 3 (Y) -> Neustart
      if (g.buttons[3]?.pressed) res.restart = true;
      // Button 9 (Start) -> Pause
      if (g.buttons[9]?.pressed) res.pause = true;
    }
    return res;
  }

  private drawMoverArt(g: Phaser.GameObjects.Graphics, w: number, h: number, id: string) {
    const rng = seededFor(id || "mover");
    const halfW = w / 2;
    const halfH = h / 2;
    const corners = jitterPoints(rectCorners(-halfW, -halfH, w, h), Math.min(2, Math.min(w, h) * 0.2), rng);
    fillPoly(g, corners, 0xbfd7ff, 0.9);
    hatchPoly(g, corners, { color: INK.blue, width: 2, alpha: 0.5 }, rng, 8, Math.PI / 4, 3);
    sketchPoly(g, corners, { color: INK.blueDark, width: 3.6, wobble: 1.8 }, rng);
  }

  private drawBouncerArt(g: Phaser.GameObjects.Graphics, w: number, h: number, id: string) {
    const rng = seededFor(id || "bouncer");
    const halfW = w / 2;
    const halfH = h / 2;
    const corners = jitterPoints(rectCorners(-halfW, -halfH, w, h), Math.min(2, Math.min(w, h) * 0.2), rng);
    fillPoly(g, corners, 0xc8f7c5, 0.95);
    hatchPoly(g, corners, { color: INK.green, width: 2.2, alpha: 0.65 }, rng, 10, -Math.PI / 4, 3);
    sketchPoly(g, corners, { color: INK.green, width: 4.2, wobble: 2 }, rng);
    if (w > 20 && h > 10) {
      sketchLine(g, { x: -halfW * 0.7, y: 0 }, { x: halfW * 0.7, y: 0 }, { color: INK.greenDark, width: 3, wobble: 1.2 }, rng);
    }
  }

  private drawEggArt(g: Phaser.GameObjects.Graphics, w: number, h: number, id: string) {
    const rng = seededFor(id || "egg");
    const rx = Math.max(10, w / 2);
    const ry = Math.max(13, h / 2);

    g.fillStyle(0xffe066, 0.95);
    g.fillEllipse(0, 0, rx * 2, ry * 2);

    g.fillStyle(0xffa726, 0.75);
    g.fillCircle(-rx * 0.35, -ry * 0.2, Math.max(2, rx * 0.25));
    g.fillCircle(rx * 0.3, ry * 0.15, Math.max(2, rx * 0.28));
    g.fillCircle(0, -ry * 0.45, Math.max(1.8, rx * 0.2));

    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(-rx * 0.35, -ry * 0.45, rx * 0.4, ry * 0.3);

    sketchCircle(g, 0, 0, Math.min(rx, ry), { color: INK.yellowDark, width: 3.2, wobble: 1.3 }, rng);
  }

  private drawTeleporterArt(g: Phaser.GameObjects.Graphics, w: number, h: number, id: string, pairIndex?: number) {
    const rng = seededFor(id || "portal");
    const rx = Math.max(12, w / 2);
    const ry = Math.max(18, h / 2);

    g.fillStyle(0x351259, 0.92);
    g.fillEllipse(0, 0, rx * 2, ry * 2);

    g.fillStyle(0x9b51e0, 0.6);
    g.fillEllipse(0, 0, rx * 1.5, ry * 1.5);

    g.fillStyle(0xe0b3ff, 0.85);
    g.fillEllipse(0, 0, rx * 0.8, ry * 0.8);

    sketchCircle(g, 0, 0, Math.min(rx, ry) * 1.1, { color: INK.purpleDark, width: 3.8, wobble: 1.8 }, rng);

    if (pairIndex) {
      g.fillStyle(0x1d1d24, 0.9);
      g.fillCircle(0, ry * 0.75, 10);
      g.lineStyle(2, 0xffffff, 1);
      g.strokeCircle(0, ry * 0.75, 10);
    }
  }

  private drawMovingPlatformArt(
    g: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    id: string,
    axis: "horizontal" | "vertical"
  ) {
    const rng = seededFor(id || "lift");
    const halfW = w / 2;
    const halfH = h / 2;
    const corners = jitterPoints(rectCorners(-halfW, -halfH, w, h), Math.min(2, Math.min(w, h) * 0.15), rng);

    // Warme braune Holz-Füllung
    fillPoly(g, corners, 0xdfcbb5, 0.95);
    // Braune Schraffur für Holzmaserung
    hatchPoly(g, corners, { color: INK.brown, width: 2.2, alpha: 0.7 }, rng, 9, Math.PI / 4, 2.5);
    // Skizzierte Außenkante
    sketchPoly(g, corners, { color: INK.brownDark, width: 3.8, wobble: 1.5 }, rng);

    // Richtungspfeile in der Mitte
    const arrowColor = INK.brownDark;
    const arrowSize = Math.min(10, Math.min(w, h) * 0.35);

    if (axis === "horizontal") {
      // Pfeile nach links und rechts (◄ ►)
      const span = Math.min(halfW * 0.6, 24);
      // Pfeil links
      g.fillStyle(arrowColor, 0.9);
      g.beginPath();
      g.moveTo(-span, 0);
      g.lineTo(-span + arrowSize, -arrowSize * 0.7);
      g.lineTo(-span + arrowSize, arrowSize * 0.7);
      g.closePath();
      g.fillPath();

      // Pfeil rechts
      g.beginPath();
      g.moveTo(span, 0);
      g.lineTo(span - arrowSize, -arrowSize * 0.7);
      g.lineTo(span - arrowSize, arrowSize * 0.7);
      g.closePath();
      g.fillPath();

      // Verbindungslinie
      g.lineStyle(2.5, arrowColor, 0.85);
      g.beginPath();
      g.moveTo(-span + arrowSize, 0);
      g.lineTo(span - arrowSize, 0);
      g.strokePath();
    } else {
      // Pfeile nach oben und unten (▲ ▼)
      const span = Math.min(halfH * 0.6, 24);
      // Pfeil oben
      g.fillStyle(arrowColor, 0.9);
      g.beginPath();
      g.moveTo(0, -span);
      g.lineTo(-arrowSize * 0.7, -span + arrowSize);
      g.lineTo(arrowSize * 0.7, -span + arrowSize);
      g.closePath();
      g.fillPath();

      // Pfeil unten
      g.beginPath();
      g.moveTo(0, span);
      g.lineTo(-arrowSize * 0.7, span - arrowSize);
      g.lineTo(arrowSize * 0.7, span - arrowSize);
      g.closePath();
      g.fillPath();

      // Verbindungslinie
      g.lineStyle(2.5, arrowColor, 0.85);
      g.beginPath();
      g.moveTo(0, -span + arrowSize);
      g.lineTo(0, span - arrowSize);
      g.strokePath();
    }

    // Kleine mechanische Rollen an den Ecken für Hand-Drawn-Maschinen-Charme
    const rollerR = Math.min(3.5, Math.min(w, h) * 0.15);
    g.fillStyle(0x351259, 0.8);
    g.fillCircle(-halfW + rollerR + 2, -halfH + rollerR + 2, rollerR);
    g.fillCircle(halfW - rollerR - 2, -halfH + rollerR + 2, rollerR);
    g.fillCircle(-halfW + rollerR + 2, halfH - rollerR - 2, rollerR);
    g.fillCircle(halfW - rollerR - 2, halfH - rollerR - 2, rollerR);
  }

  private drawGoalLockDoodle() {
    if (this.goalLockArt) {
      this.goalLockArt.destroy();
    }
    const g = this.add.graphics().setDepth(DEPTH.goal + 5);
    const cx = this.goal.x + this.goal.width / 2;
    const cy = this.goal.y + this.goal.height / 2;

    g.fillStyle(0xffca28, 0.95);
    g.fillRoundedRect(cx - 16, cy - 8, 32, 28, 6);
    g.lineStyle(3, INK.black, 1);
    g.strokeRoundedRect(cx - 16, cy - 8, 32, 28, 6);

    g.lineStyle(4, INK.black, 1);
    g.beginPath();
    g.arc(cx, cy - 8, 12, Math.PI, 0, false);
    g.strokePath();

    g.fillStyle(0x1d1d24, 1);
    g.fillCircle(cx, cy + 3, 3.5);
    g.fillRect(cx - 1.5, cy + 3, 3, 8);

    this.goalLockArt = g;
  }

  private handleTrampolineBounce(bouncerRect: Phaser.GameObjects.Rectangle) {
    const bId = bouncerRect.getData("id");
    const bEntity = this.bouncersList.find((b) => b.id === bId);
    if (bEntity) {
      // Trampolin drückt sich sichtbar ein und federt elastisch zurück
      this.tweens.killTweensOf(bEntity.art);
      this.tweens.add({
        targets: bEntity.art,
        scaleX: this.gameMode === "rpg_labyrinth" ? 0.75 : 1,
        scaleY: 0.45,
        duration: 55,
        yoyo: true,
        ease: "Back.easeOut",
      });
    }

    if (this.gameMode === "rpg_labyrinth") {
      // 🛡️ BUMPER-RÜCKSTOSS IM LABYRINTH:
      // Kickt Dino kraftvoll in Gegenrichtung weg vom Trampolin!
      let dirX = this.player.x - bouncerRect.x;
      let dirY = this.player.y - bouncerRect.y;
      if (Math.abs(dirX) < 2 && Math.abs(dirY) < 2) {
        dirX = this.player.facing * -1;
      }
      const len = Math.hypot(dirX, dirY) || 1;
      const kickX = (dirX / len) * 620;
      const kickY = (dirY / len) * 620;

      this.player.knockback(kickX, kickY, 320);
      playJump();
      burstParticles(this, this.player.x, this.player.y, {
        color: INK.green,
        count: 22,
        speed: [120, 360],
        size: 9,
        duration: 420,
      });
      return;
    }

    const prevVy = this.player.body.velocity.y;
    const isHardImpact = prevVy > 200 || this.cursors?.up.isDown || this.keys?.W.isDown;
    const bounceVelocity = isHardImpact ? BOUNCE_VELOCITY * 1.18 : BOUNCE_VELOCITY * 0.95;

    // Federnde Sprunganimation auf dem Trampolin-Pilz
    const bouncerId = (bouncerRect as any)?.getData?.("id");
    const bouncerItem = this.bouncersList.find((b) => b.id === bouncerId);
    if (bouncerItem?.art) {
      this.tweens.killTweensOf(bouncerItem.art);
      this.tweens.add({
        targets: bouncerItem.art,
        scaleY: 0.65,
        scaleX: 1.25,
        duration: 90,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    }

    const burstY = this.player.bottom;
    this.player.trampolineBounce(bounceVelocity, () => {
      playJump();
      burstParticles(this, this.player.x, burstY, {
        color: INK.green,
        count: 18,
        speed: [80, 240],
        size: 7,
        duration: 380,
      });
    });
  }

  private collectEgg(colRect: Phaser.GameObjects.Rectangle) {
    const id = colRect.getData("id");
    const item = this.collectiblesList.find((c) => c.id === id);
    if (!item || item.collected) return;

    item.collected = true;
    (item.rect.body as Phaser.Physics.Arcade.Body).enable = false;

    this.tweens.add({
      targets: item.art,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 180,
      onComplete: () => {
        item.art.setVisible(false);
      },
    });

    playCoin();
    burstParticles(this, colRect.x, colRect.y, {
      color: INK.yellow,
      count: 16,
      speed: [70, 240],
      size: 8,
      duration: 400,
    });

    this.collectedCount++;
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);

    if (this.collectedCount >= this.totalCollectibles) {
      this.unlockGoal();
    }
  }

  private unlockGoal() {
    this.doodles.setGoalLocked(false);
    this.goal.setAlpha(0); // Hitbox unsichtbar halten – kein grüner Kasten!
    this.redrawGoalDoor(false); // Strahlend offenes Portal-Tor zeichnen

    if (this.goalLockArt) {
      this.tweens.add({
        targets: this.goalLockArt,
        scaleX: 1.6,
        scaleY: 1.6,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          this.goalLockArt?.destroy();
          this.goalLockArt = undefined;
        },
      });
    }

    const gx = this.goal.x + this.goal.width / 2;
    const gy = this.goal.y + this.goal.height / 2;
    burstParticles(this, gx, gy, {
      color: INK.green,
      count: 32,
      speed: [80, 280],
      size: 10,
      duration: 650,
    });

    floatText(this, "Ziel freigeschaltet! 🏆", gx, this.goal.y - 35, INK_CSS.green);
    playWin();
  }

  private handleTeleporter(tpRect: Phaser.GameObjects.Rectangle) {
    // Ping-Pong Schutz: Erst wieder aktivierbar, wenn Dino den Teleporter verlassen hat!
    if (!this.isExitedFromTeleporter) return;
    if (this.time.now - this.lastTeleportAt < 420) return;

    const srcId = tpRect.getData("id");
    const src = this.teleportersList.find((t) => t.id === srcId);
    if (!src) return;

    const dest = this.teleportersList.find((t) => t.id === src.targetId);
    if (!dest) {
      this.isExitedFromTeleporter = false;
      this.lastTeleportAt = this.time.now;
      if (this.gameMode === "rpg_labyrinth") {
        // Magischer 4-Wege Vortex-Warp: Teleportiert Dino 240px vorwärts in Laufrichtung
        playTeleport();
        burstParticles(this, src.x, src.y, {
          color: INK.purple,
          count: 32,
          speed: [120, 320],
          size: 10,
          duration: 500,
        });
        const facing = this.player.facing;
        const targetX = Phaser.Math.Clamp(this.player.x + facing * 240, 60, WORLD_W - 60);
        const targetY = this.player.y;
        this.player.teleport(targetX, targetY);
        burstParticles(this, targetX, targetY, {
          color: INK.purple,
          count: 24,
          speed: [80, 240],
          size: 9,
          duration: 450,
        });
        floatText(this, "Dimensionstor! 🌀", targetX, targetY - 35, INK_CSS.purple);
        return;
      }

      // Jump 'n' Run: Magischer Gravitations-Katapult
      this.player.trampolineBounce(BOUNCE_VELOCITY * 1.35, () => {
        playJump();
        burstParticles(this, src.x, src.y, {
          color: INK.purple,
          count: 28,
          speed: [90, 290],
          size: 9,
          duration: 450,
        });
      });
      floatText(this, "Magischer Vortex! 🌀", src.x, src.y - 35, INK_CSS.purple);
      return;
    }

    this.isExitedFromTeleporter = false;
    this.lastTeleportAt = this.time.now;

    // Ursprung: Partikel & Audio
    burstParticles(this, src.x, src.y, {
      color: INK.purple,
      count: 22,
      speed: [80, 260],
      size: 9,
      duration: 450,
    });
    playTeleport();

    // Spieler versetzen
    this.player.teleport(dest.x, dest.y - PLAYER_H / 2 + 5);

    // Ziel: Partikel & Pop
    burstParticles(this, dest.x, dest.y, {
      color: INK.purple,
      count: 22,
      speed: [80, 260],
      size: 9,
      duration: 450,
    });

    this.player.rect.setScale(0.7, 1.4);
    this.tweens.add({
      targets: this.player.rect,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      ease: "Back.easeOut",
    });
  }

  private isPlayerStandingOnCrate(): boolean {
    if (!this.player || !this.moversGroup) return false;
    const pBody = this.player.body;
    for (const mObj of this.moversGroup.getChildren()) {
      const mRect = mObj as Phaser.GameObjects.Rectangle;
      const mBody = mRect.body as Phaser.Physics.Arcade.Body;
      if (!mBody) continue;

      const playerBottom = pBody.bottom;
      const crateTop = mBody.top;
      const verticallyOnTop =
        Math.abs(playerBottom - crateTop) <= 8 || (playerBottom >= crateTop && playerBottom <= crateTop + 14);
      const horizontallyOverlapping = pBody.right > mBody.left + 4 && pBody.left < mBody.right - 4;

      if (verticallyOnTop && horizontallyOverlapping) {
        return true;
      }
    }
    return false;
  }

  private handleMoverTeleporter(mRect: Phaser.GameObjects.Rectangle, tpRect: Phaser.GameObjects.Rectangle) {
    const now = this.time.now;
    const lastTp = (mRect.getData("lastTeleportAt") as number) || 0;
    if (now - lastTp < 800) return;

    const tpId = tpRect.getData("id");
    const currentTp = this.teleportersList.find((t) => t.id === tpId);
    if (!currentTp) return;

    mRect.setData("lastTeleportAt", now);
    const mBody = mRect.body as Phaser.Physics.Arcade.Body;

    // Falls genau 1 Portal existiert -> Magischer Vortex-Katapult!
    if (this.teleportersList.length === 1) {
      playTeleport();
      burstParticles(this, mRect.x, mRect.y, {
        color: INK.purple,
        count: 24,
        speed: [150, 420],
        size: 10,
        duration: 480,
      });
      if (this.gameMode === "rpg_labyrinth") {
        const nextX = Phaser.Math.Clamp(mRect.x + (mBody.velocity.x >= 0 ? 220 : -220), 80, WORLD_W - 80);
        mRect.setPosition(nextX, mRect.y);
        mBody.reset(nextX, mRect.y);
      } else {
        mBody.setVelocity(520, -800);
      }
      return;
    }

    // Andernfalls: Teleportiere zum Partner-Portal
    const targetTp = this.teleportersList.find((t) => t.id !== tpId);
    if (targetTp) {
      playTeleport();
      burstParticles(this, mRect.x, mRect.y, { color: INK.purple, count: 16 });
      mRect.setPosition(targetTp.x, targetTp.y);
      mBody.reset(targetTp.x, targetTp.y);
      burstParticles(this, targetTp.x, targetTp.y, { color: INK.purple, count: 18 });
    }
  }

  private loadOriginalBackdrop(dataUrl: string) {
    const key = `backdrop-${Date.now()}`;
    if (!this.textures.exists(key)) {
      this.textures.addBase64(key, dataUrl);
      this.textures.once(`onload-${key}`, () => {
        if (this.sys.isActive()) {
          this.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(WORLD_W, WORLD_H).setDepth(DEPTH.paper + 5).setAlpha(0.85);
        }
      });
    }
  }

  private startIntro() {
    this.intro = true;
    this.physics.world.pause();
    new LevelIntro(this, this.level.name, () => {
      this.intro = false;
      this.physics.world.resume();
      this.attemptState.restartAttempt(this);
      this.recorder.clear(this.time.now);
      for (const p of this.level.platforms) if (isAssist(p.id)) showAssistTag(this, p);
    });
  }

  private handleEnemyOverlap(enemy: Enemy) {
    if (this.locked || !enemy.alive) return;

    const isStomp = this.player.isFalling && this.player.bottom <= enemy.midY;
    if (isStomp) {
      enemy.kill();
      this.recorder.addStomp(this.time.now, this.enemies.indexOf(enemy));
      this.player.bounce(STOMP_BOUNCE_VELOCITY);
      playStomp();
    } else {
      this.triggerDeath("enemy", this.player.x, this.player.y);
    }
  }

  private collectCoin(coin: Phaser.GameObjects.Rectangle) {
    if (!coin.visible) return;
    coin.setVisible(false);
    (coin.body as Phaser.Physics.Arcade.Body).enable = false;
    this.attemptState.collectCoin();
    this.recorder.addCoin(this.time.now, this.coins.indexOf(coin));
    playCoin();
    coinBurst(this, coin.x, coin.y);
  }

  private resetCoinVisibility() {
    for (const c of this.coins) {
      c.setVisible(true);
      (c.body as Phaser.Physics.Arcade.Body).enable = true;
    }
  }

  private triggerDeath(cause: DeathCause, x: number, y: number) {
    if (this.locked) return;
    this.dead = true;

    const deathsAtSpot = this.attemptState.recordDeath(x, y);
    if (this.attemptState.deathsWithin(x, y, STUCK_RADIUS) >= STUCK_DEATHS) {
      this.stuck.arm({ x, feetY: cause === "fall" ? this.lastGrounded.feetY : y + PLAYER_H / 2 });
    }
    const payload: DeathEvent = {
      cause,
      x,
      y,
      attempt: this.attemptState.attempt,
      deathsAtSpot,
      coins: this.attemptState.coins,
      timeAlive: this.attemptState.timeAlive(this),
    };
    gameEvents.emit("death", payload);

    this.player.setActive(false);
    playDeathEffect(this, x, y, cause);
    playDeath();

    this.time.delayedCall(DEATH_EFFECT_MS, () => this.respawn());
  }

  private useHelper() {
    const spot = this.stuck.currentSpot;
    if (this.locked || !spot) return;

    const { level, player } = this;
    const goal = level.goal;
    const box = { x: player.body.x, y: player.body.y, w: player.body.width, h: player.body.height };
    const rect = findHelperRect({
      platforms: [...level.platforms, ...this.stuck.live],
      hazards: level.hazards,
      goal,
      deathX: spot.x,
      feetY: spot.feetY,
      player: box,
    });
    if (!rect) {
      floatText(this, "KEIN PLATZ", WORLD_W / 2, 400, INK_CSS.red);
      return;
    }

    const platform: Platform = { id: `assist-live-${this.stuck.used + 1}`, ...rect };
    this.platforms.add(this.rectTopLeft(platform, COLORS.platform));
    const art = this.add.graphics().setDepth(DEPTH.staticLevel + 1).setAlpha(0);
    drawAssistPlatform(art, platform);
    this.tweens.add({ targets: art, alpha: 1, duration: 200 });
    showAssistTag(this, platform);

    const cx = sx(platform.x + platform.w / 2);
    const cy = sy(platform.y + platform.h / 2);
    burstParticles(this, cx, cy, { color: INK.grey, count: 10, speed: [40, 110], size: 7, duration: 450 });
    burstParticles(this, cx, cy, { color: INK.paper, count: 8, speed: [30, 90], size: 6, duration: 400 });
    playHelper();
    this.stuck.commit(platform);
  }

  private copyLevelJson() {
    const json = JSON.stringify(this.level, null, 2);
    console.log(`[debug] level JSON (${this.level.name}):\n${json}`);
    const done = (ok: boolean) => {
      if (this.sys.isActive()) floatText(this, ok ? "KOPIERT" : "SIEHE KONSOLE", WORLD_W / 2, 320, ok ? INK_CSS.green : INK_CSS.red);
    };
    const copy = navigator.clipboard?.writeText(json);
    if (copy) copy.then(() => done(true), () => done(false));
    else done(false);
  }

  private respawn() {
    this.attemptState.nextAttempt(this);
    this.recorder.clear(this.time.now);
    this.resetCoinVisibility();

    // Sammelobjekte präzise auf 30x30 Bildgröße zurücksetzen
    this.collectedCount = 0;
    for (const c of this.collectiblesList) {
      c.collected = false;
      if (c.rect.body) (c.rect.body as Phaser.Physics.Arcade.Body).enable = true;
      this.tweens.killTweensOf(c.art);
      if (c.art instanceof Phaser.GameObjects.Image) {
        c.art.setDisplaySize(30, 30);
      } else {
        c.art.setScale(1);
      }
      c.art.setPosition(c.rect.x, c.rect.y).setVisible(true).setAlpha(1);
      this.tweens.add({
        targets: c.art,
        y: c.rect.y - 5,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    const isGoalLocked = this.totalCollectibles > 0;
    this.doodles.setGoalLocked(isGoalLocked);
    this.goal.setAlpha(0); // Hitbox unsichtbar halten – kein grüner Kasten!
    this.redrawGoalDoor(isGoalLocked);
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);
    this.isExitedFromTeleporter = true;

    this.player.setActive(true);
    this.player.teleport(sx(this.level.start.x), sy(this.level.start.y));
    this.dead = false;
  }

  private triggerWin() {
    if (this.locked) return;
    this.won = true;
    this.recorder.finish(this.time.now, this.player, this.enemies);

    const payload: WinEvent = {
      coins: this.attemptState.coins,
      timeAlive: this.attemptState.timeAlive(this),
      deaths: this.attemptState.attempt - 1,
    };
    gameEvents.emit("win", payload);
    playWin();
    if (this.recorder.usable) this.pendingReplay = payload;
    else this.winOverlay = new WinOverlay(this, payload, () => this.restartLevel());
  }

  private beginReplay(payload: WinEvent) {
    this.pendingReplay = undefined;
    this.physics.world.pause();
    this.winOverlay = new WinOverlay(this, payload, () => this.restartLevel(), {
      deaths: this.attemptState.attempt - 1,
      attempt: this.attemptState.attempt,
    });
    this.replayCtl = new ReplayController(this, this.recorder, this.player, this.enemies, this.coins);
  }

  private restartLevel() {
    if (this.winOverlay) {
      this.winOverlay.destroy();
      this.winOverlay = undefined;
    }
    this.pendingReplay = undefined;
    if (this.replayCtl) {
      this.replayCtl.destroy();
      this.replayCtl = undefined;
      this.physics.world.resume();
    }
    if (this.pauseContainer) {
      this.pauseContainer.destroy();
      this.pauseContainer = undefined;
    }
    this.isPaused = false;
    this.won = false;
    this.attemptState.restartAttempt(this);
    this.recorder.clear(this.time.now);
    this.resetCoinVisibility();

    // Sammelobjekte präzise auf 30x30 Bildgröße zurücksetzen
    this.collectedCount = 0;
    for (const c of this.collectiblesList) {
      c.collected = false;
      if (c.rect.body) (c.rect.body as Phaser.Physics.Arcade.Body).enable = true;
      this.tweens.killTweensOf(c.art);
      if (c.art instanceof Phaser.GameObjects.Image) {
        c.art.setDisplaySize(30, 30);
      } else {
        c.art.setScale(1);
      }
      c.art.setPosition(c.rect.x, c.rect.y).setVisible(true).setAlpha(1);
      this.tweens.add({
        targets: c.art,
        y: c.rect.y - 5,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    const isGoalLocked = this.totalCollectibles > 0;
    this.doodles.setGoalLocked(isGoalLocked);
    this.goal.setAlpha(0); // Hitbox unsichtbar halten – kein grüner Kasten!
    this.redrawGoalDoor(isGoalLocked);
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);
    this.isExitedFromTeleporter = true;

    this.player.teleport(sx(this.level.start.x), sy(this.level.start.y));

    // Wind im Dschungel zurücksetzen
    this.windSpeed = 0;
    this.targetWindSpeed = 0;
    this.nextWindChangeAt = this.time.now + 2000;
  }

  private initJungleWind() {
    this.windSpeed = 0;
    this.targetWindSpeed = 0;
    this.nextWindChangeAt = this.time.now + 2500;
    this.windLeaves = [];

    this.windLeavesGraphics = this.add.graphics().setDepth(DEPTH.player + 4);

    const leafColors = [
      0x2e7d32, // Dunkles Tropengrün
      0x43a047, // Frisches Blattgrün
      0x81c784, // Helles Farnblatt
      0xaed581, // Limetten-Blatt
      0xfbc02d, // Tropisches Sonnenblatt
    ];

    // Erzeuge 36 fliegende Blätter gleichmäßig über den Spielbereich
    for (let i = 0; i < 36; i++) {
      this.windLeaves.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        vx: -15 + Math.random() * 30,
        vy: 25 + Math.random() * 45,
        angle: Math.random() * 360,
        spin: -2.5 + Math.random() * 5,
        size: 5 + Math.random() * 6,
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
        alpha: 0.45 + Math.random() * 0.45,
      });
    }
  }

  private updateJungleWind(time: number, delta: number) {
    const dt = Math.max(0.001, Math.min(delta / 1000, 0.05));

    // Windwechsel in zufälligen Intervallen (alle 4 bis 7.5 Sekunden)
    if (time >= this.nextWindChangeAt) {
      const roll = Math.random();
      if (roll < 0.25) {
        // Windstille / Leichte Brise
        this.targetWindSpeed = 0;
        this.nextWindChangeAt = time + 2500 + Math.random() * 2500;
      } else if (roll < 0.62) {
        // Böe von links nach rechts (schiebt Dino nach vorne)
        this.targetWindSpeed = 70 + Math.random() * 30; // +70 bis +100 px/s
        this.nextWindChangeAt = time + 4000 + Math.random() * 3500;
      } else {
        // Böe von rechts nach links (drückt Dino nach hinten)
        this.targetWindSpeed = -(70 + Math.random() * 30); // -70 bis -100 px/s
        this.nextWindChangeAt = time + 4000 + Math.random() * 3500;
      }
    }

    // Sanfte Übergangs-Interpolation der Windgeschwindigkeit
    const lerp = Math.min(1, dt * 2.2);
    this.windSpeed += (this.targetWindSpeed - this.windSpeed) * lerp;

    // Dschungelwind wirkt als rein visuelles, stimmungsvolles Blätter-Wirbeln (kein Zappeln/Verschieben des Spielers)

    // Partikel-Darstellung: Dschungelblätter wirbeln dynamisch mit dem Wind
    if (this.windLeavesGraphics && this.windLeaves.length > 0) {
      const g = this.windLeavesGraphics;
      g.clear();

      for (const leaf of this.windLeaves) {
        // Horizontale Bewegung: Eigengeschwindigkeit + Winddrift
        leaf.x += (leaf.vx + this.windSpeed * 1.5) * dt;
        // Vertikales Absinken mit flatternder Wellenbewegung
        leaf.y += leaf.vy * dt + Math.sin(time / 240 + leaf.x * 0.05) * 0.45;
        // Drehung durch den Wind
        leaf.angle += (leaf.spin + this.windSpeed * 0.035) * dt * 60;

        // Rand-Umbruch (Wrapping)
        if (leaf.x < -25) {
          leaf.x = WORLD_W + 20;
          leaf.y = Math.random() * WORLD_H;
        } else if (leaf.x > WORLD_W + 25) {
          leaf.x = -20;
          leaf.y = Math.random() * WORLD_H;
        }

        if (leaf.y > WORLD_H + 20) {
          leaf.y = -20;
          leaf.x = Math.random() * WORLD_W;
        } else if (leaf.y < -25) {
          leaf.y = WORLD_H + 20;
        }

        // Zeichne stilisiertes Dschungelblatt
        const rad = Phaser.Math.DegToRad(leaf.angle);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const hw = leaf.size * 1.6;
        const hh = leaf.size * 0.8;

        g.fillStyle(leaf.color, leaf.alpha);
        // Angespitzte Blattform (Raute)
        g.beginPath();
        g.moveTo(leaf.x + cos * hw, leaf.y + sin * hw);
        g.lineTo(leaf.x - sin * hh, leaf.y + cos * hh);
        g.lineTo(leaf.x - cos * hw, leaf.y - sin * hw);
        g.lineTo(leaf.x + sin * hh, leaf.y - cos * hh);
        g.closePath();
        g.fillPath();

        // Feine Blattrippe in der Mitte
        g.lineStyle(1.2, 0x1b5e20, leaf.alpha * 0.7);
        g.beginPath();
        g.moveTo(leaf.x - cos * hw, leaf.y - sin * hw);
        g.lineTo(leaf.x + cos * hw, leaf.y + sin * hw);
        g.strokePath();
      }
    }
  }

  private redrawGoalDoor(locked: boolean) {
    if (!this.goalDoorArt) {
      this.goalDoorArt = this.add.graphics().setDepth(DEPTH.staticLevel + 4);
    }
    const g = this.goalDoorArt;
    g.clear();

    const gx = sx(this.level.goal.x) + sx(this.level.goal.w) / 2;
    const gy = sy(this.level.goal.y) + sy(this.level.goal.h) / 2;
    const dw = Math.max(52, sx(this.level.goal.w));
    const dh = Math.max(76, sy(this.level.goal.h));
    const left = gx - dw / 2;
    const top = gy - dh / 2;

    // 1. Schattierung / Sockel-Fundament am Boden
    g.fillStyle(0x18181b, 0.45);
    g.fillEllipse(gx, top + dh + 2, dw * 1.15, 12);

    // 2. Äußerer Steinbogen (Portal-Rahmen aus massiven Steinquadern)
    g.fillStyle(0x3f3f46, 1);
    g.fillRoundedRect(left - 6, top + 16, 12, dh - 16, 3);
    g.fillRoundedRect(left + dw - 6, top + 16, 12, dh - 16, 3);
    g.fillRoundedRect(left - 8, top - 2, dw + 16, 26, 8);

    // Steinfugen & Gravuren
    g.lineStyle(2, 0x18181b, 0.7);
    g.strokeRoundedRect(left - 6, top + 16, 12, dh - 16, 3);
    g.strokeRoundedRect(left + dw - 6, top + 16, 12, dh - 16, 3);
    g.strokeRoundedRect(left - 8, top - 2, dw + 16, 26, 8);

    for (let py = top + 26; py < top + dh - 10; py += 16) {
      g.lineBetween(left - 6, py, left + 6, py);
      g.lineBetween(left + dw - 6, py, left + dw + 6, py);
    }

    // 3. Innere Toröffnung & Holztür
    if (locked) {
      // Verschlossenes massives Holztor
      g.fillStyle(0x3b2314, 1);
      g.fillRoundedRect(left + 5, top + 8, dw - 10, dh - 8, { tl: 18, tr: 18, bl: 2, br: 2 });

      // Einzelne vertikale Holzbohlen
      const plankCount = 4;
      const pw = (dw - 10) / plankCount;
      g.lineStyle(1.8, 0x1f120a, 0.85);
      for (let i = 1; i < plankCount; i++) {
        g.lineBetween(left + 5 + i * pw, top + 16, left + 5 + i * pw, top + dh);
      }

      // Schwere eiserne Querbänder
      g.fillStyle(0x27272a, 1);
      g.fillRoundedRect(left + 6, top + dh * 0.3, dw - 12, 6, 2);
      g.fillRoundedRect(left + 6, top + dh * 0.72, dw - 12, 6, 2);

      // Silberne Nieten auf den Eisenbändern
      g.fillStyle(0xd4d4d8, 1);
      g.fillCircle(left + 12, top + dh * 0.3 + 3, 2);
      g.fillCircle(left + dw - 12, top + dh * 0.3 + 3, 2);
      g.fillCircle(left + 12, top + dh * 0.72 + 3, 2);
      g.fillCircle(left + dw - 12, top + dh * 0.72 + 3, 2);

      // Eisernes Vorhängeschloss & Riegel
      g.fillStyle(0xd97706, 1);
      g.fillRoundedRect(gx - 10, top + dh * 0.5 - 4, 20, 16, 3);
      g.lineStyle(2, 0x78350f, 1);
      g.strokeRoundedRect(gx - 10, top + dh * 0.5 - 4, 20, 16, 3);
      g.lineStyle(3, 0x52525b, 1);
      g.beginPath();
      g.arc(gx, top + dh * 0.5 - 4, 7, Math.PI, 0, false);
      g.strokePath();
      g.fillStyle(0x18181b, 1);
      g.fillCircle(gx, top + dh * 0.5 + 2, 2.5);
      g.fillRect(gx - 1, top + dh * 0.5 + 2, 2, 5);
    } else {
      // Offenes magisch leuchtendes Dimensionstor
      g.fillStyle(0x064e3b, 1);
      g.fillRoundedRect(left + 5, top + 8, dw - 10, dh - 8, { tl: 18, tr: 18, bl: 2, br: 2 });

      g.fillStyle(0x10b981, 0.45);
      g.fillRoundedRect(left + 8, top + 12, dw - 16, dh - 12, { tl: 16, tr: 16, bl: 2, br: 2 });

      g.fillStyle(0x34d399, 0.6);
      g.fillRoundedRect(left + 12, top + 18, dw - 24, dh - 20, { tl: 14, tr: 14, bl: 2, br: 2 });

      g.fillStyle(0xfef08a, 0.85);
      g.fillEllipse(gx, gy + 4, dw * 0.45, dh * 0.45);

      g.fillStyle(0xf59e0b, 1);
      g.fillCircle(left + dw - 12, gy + 6, 4);
    }

    // 4. Schlussstein im Bogen mit leuchtendem Edelstein
    g.fillStyle(0x52525b, 1);
    g.fillRoundedRect(gx - 12, top - 6, 24, 18, 4);
    g.lineStyle(2, 0x27272a, 1);
    g.strokeRoundedRect(gx - 12, top - 6, 24, 18, 4);

    g.fillStyle(locked ? 0xef4444 : 0x10b981, 1);
    g.fillCircle(gx, top + 2, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(gx - 1.5, top + 0.5, 1.8);
  }

  private initSpaceStardust() {
    this.spaceDustGraphics = this.add.graphics().setDepth(DEPTH.player + 4);
    this.spaceDust = [];
    const colors = [0x93c5fd, 0xc4b5fd, 0xa5f3fc, 0xfde047, 0xffffff];
    for (let i = 0; i < 40; i++) {
      this.spaceDust.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        vy: -(15 + Math.random() * 25),
        size: 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.35 + Math.random() * 0.55,
        twinkleSpeed: 1.5 + Math.random() * 3,
      });
    }
  }

  private updateSpaceStardust(time: number, delta: number) {
    if (!this.spaceDustGraphics || this.spaceDust.length === 0) return;
    const dt = Math.max(0.001, Math.min(delta / 1000, 0.05));
    const g = this.spaceDustGraphics;
    g.clear();

    for (const p of this.spaceDust) {
      p.y += p.vy * dt;
      p.x += Math.sin(time * 0.002 * p.twinkleSpeed + p.y * 0.01) * 0.4;
      if (p.y < -10) {
        p.y = WORLD_H + 10;
        p.x = Math.random() * WORLD_W;
      }
      const twinkle = 0.5 + Math.sin(time * 0.003 * p.twinkleSpeed) * 0.35;
      g.fillStyle(p.color, p.alpha * twinkle);
      g.fillCircle(p.x, p.y, p.size);
    }
  }

  private initVolcanoEmbers() {
    this.volcanoEmbersGraphics = this.add.graphics().setDepth(DEPTH.player + 4);
    this.volcanoEmbers = [];
    const colors = [0xf97316, 0xef4444, 0xfacc15, 0xffedd5];
    for (let i = 0; i < 42; i++) {
      this.volcanoEmbers.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        vx: -20 + Math.random() * 40,
        vy: -(35 + Math.random() * 55),
        size: 2 + Math.random() * 3.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.4 + Math.random() * 0.5,
      });
    }
  }

  private updateVolcanoEmbers(time: number, delta: number) {
    if (!this.volcanoEmbersGraphics || this.volcanoEmbers.length === 0) return;
    const dt = Math.max(0.001, Math.min(delta / 1000, 0.05));
    const g = this.volcanoEmbersGraphics;
    g.clear();

    for (const p of this.volcanoEmbers) {
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(time * 0.004 + p.y * 0.02) * 15) * dt;
      if (p.y < -15) {
        p.y = WORLD_H + 15;
        p.x = Math.random() * WORLD_W;
      }
      g.fillStyle(p.color, p.alpha);
      g.fillCircle(p.x, p.y, p.size);
    }
  }

  private rectTopLeft(r: { id: string; x: number; y: number; w: number; h: number }, color: number) {
    const rect = this.add.rectangle(sx(r.x), sy(r.y), sx(r.w), sy(r.h), color).setOrigin(0, 0).setAlpha(0);
    rect.setData("id", r.id);
    return rect;
  }
}
