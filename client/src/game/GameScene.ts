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
import { Player, type MoveInput } from "./Player";
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
import { isMuted, playCoin, playDeath, playHelper, playJump, playStomp, playWin, toggleMute, startBgMusic, pauseBgMusic, resumeBgMusic, stopBgMusic } from "./audio";
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
  art: Phaser.GameObjects.Graphics;
  w: number;
  h: number;
  id: string;
};

type BouncerEntity = {
  rect: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
};

type CollectibleEntity = {
  rect: Phaser.GameObjects.Rectangle;
  art: Phaser.GameObjects.Graphics;
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

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<"W" | "A" | "D", Phaser.Input.Keyboard.Key>;
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

    this.physics.world.resume();
    this.attemptState.reset(this);
    this.recorder = new RunRecorder(level.enemies.length);
    this.recorder.clear(this.time.now);
    resetParticleBudget(this);
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H + FALL_MARGIN + 50);

    // Visuelle Ebenen: Gewählter Hintergrund (Notizheft, Dschungel, Kosmos)
    const bgTheme = (this.game.registry.get("backgroundTheme") as BackgroundTheme) || "paper";
    addBackground(this, bgTheme);

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
    for (const b of (level.bouncers ?? [])) {
      const bw = sx(b.w);
      const bh = sy(b.h);
      const bx = sx(b.x) + bw / 2;
      const by = sy(b.y) + bh / 2;
      const rect = this.add.rectangle(bx, by, bw, bh, COLORS.bouncer).setAlpha(0);
      rect.setData("id", b.id);
      this.physics.add.existing(rect, true);
      this.bouncers.add(rect);

      const art = this.add.graphics().setDepth(DEPTH.staticLevel + 2);
      this.drawBouncerArt(art, bw, bh, b.id);
      art.setPosition(bx, by);

      this.bouncersList.push({ rect, art, x: bx, y: by, w: bw, h: bh, id: b.id });
    }

    // 3. BLAU: Bewegliche Physikobjekte
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
      body.setBounce(0.1);
      body.setDrag(80, 0);
      body.setFriction(0.3, 0);
      body.setMass(0.8);

      const art = this.add.graphics().setDepth(DEPTH.staticLevel + 3);
      this.drawMoverArt(art, mw, mh, m.id);
      art.setPosition(mx, my);

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
      const cw = sx(c.w ?? 30);
      const ch = sy(c.h ?? 30);
      const cx = sx(c.x) + cw / 2;
      const cy = sy(c.y) + ch / 2;

      const rect = this.add.rectangle(cx, cy, cw, ch, COLORS.coin).setAlpha(0);
      rect.setData("id", c.id);
      this.physics.add.existing(rect, true);
      this.collectiblesGroup.add(rect);

      const art = this.add.graphics().setDepth(DEPTH.collectible);
      this.drawEggArt(art, cw, ch, c.id);
      art.setPosition(cx, cy);

      // Sanftes Schweben (Bobbing)
      this.tweens.add({
        targets: art,
        y: cy - 6,
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

    // Ziel & Extras
    this.goal = this.rectTopLeft(level.goal, COLORS.goal);
    this.physics.add.existing(this.goal, true);

    this.coins = [];
    this.doodles = new LevelDoodles(this, level, this.coins);

    if (this.totalCollectibles > 0) {
      this.doodles.setGoalLocked(true);
      this.goal.setAlpha(0.45);
      this.drawGoalLockDoodle();
    } else {
      this.doodles.setGoalLocked(false);
      this.goal.setAlpha(1);
    }

    for (const e of level.enemies) {
      const enemy = new Enemy(this, e.id, sx(e.x), sy(e.y), e.patrol);
      this.physics.add.collider(enemy.rect, this.platforms);
      this.enemies.push(enemy);
    }

    // Spieler (Dino)
    this.player = new Player(this, sx(level.start.x), sy(level.start.y));
    this.player.onJump = () => this.recorder.addJump(this.time.now);

    // Kollisionen: Spieler mit Plattformen
    this.physics.add.collider(this.player.rect, this.platforms);

    // Kollisionen: Spieler mit grünen Trampolinen (verbessertes elastisches Verhalten)
    this.physics.add.collider(this.player.rect, this.bouncers, (_p, bouncerRect) => {
      if (this.player.body.touching.down || this.player.isFalling) {
        this.handleTrampolineBounce(bouncerRect as Phaser.GameObjects.Rectangle);
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

    // Kollisionen: Blaue Objekte untereinander und mit Plattformen/Trampolinen/Liften
    this.physics.add.collider(this.moversGroup, this.platforms);
    this.physics.add.collider(this.moversGroup, this.bouncers);
    this.physics.add.collider(this.moversGroup, this.movingPlatformsGroup);
    this.physics.add.collider(this.moversGroup, this.moversGroup);

    // Kollision: Spieler mit blauen Objekten (schieben & draufstehen)
    this.physics.add.collider(this.player.rect, this.moversGroup, (pObj, mObj) => {
      const pBody = (pObj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
      const mBody = (mObj as Phaser.GameObjects.Rectangle).body as Phaser.Physics.Arcade.Body;
      if (pBody.touching.right && mBody.touching.left) {
        mBody.setVelocityX(Math.max(140, pBody.velocity.x * 0.95));
      } else if (pBody.touching.left && mBody.touching.right) {
        mBody.setVelocityX(Math.min(-140, pBody.velocity.x * 0.95));
      }
      if (pBody.touching.down) {
        this.lastGrounded = { x: this.player.x, feetY: this.player.bottom };
      }
    });

    // Kollisionen: Gefahren, Münzen, Ziel, Gegner
    this.physics.add.overlap(this.player.rect, this.hazards, (_p, hazard) => {
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
            `Sammle zuerst alle gelben Objekte! (${this.collectedCount}/${this.totalCollectibles}) 🥚`,
            this.goal.x + this.goal.width / 2,
            this.goal.y - 30,
            INK_CSS.orange
          );
        }
        return;
      }
      this.triggerWin();
    });

    for (const enemy of this.enemies) {
      this.physics.add.overlap(this.player.rect, enemy.rect, () => this.handleEnemyOverlap(enemy));
    }

    this.hud = new Hud(this);
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);

    const isTv = this.registry.get("tvMode") || false;
    if (isTv) {
      this.hud.setTvMode(true);
    }

    const touch = touchControlsEnabled(this);
    this.touchControls = touch ? new TouchControls(this) : undefined;
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
    this.keys = kb.addKeys("W,A,D") as typeof this.keys;
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

    // Braun: bewegliche Plattformen (Lifte) animieren & Spieler sanft mitführen
    let riderDx = 0;
    let riderDy = 0;

    for (const mp of this.movingPlatformsList) {
      const moveSpeed = mp.speed > 5 ? mp.speed : 80;
      const travelDist = mp.distance ?? 160;
      const cycleDuration = Math.max(2.5, (travelDist * 2) / moveSpeed);
      const phase = ((time / 1000) % cycleDuration) / cycleDuration;
      const offset = Math.sin(phase * Math.PI * 2) * (travelDist * 0.5);

      const targetX = mp.axis === "horizontal" ? mp.startX + offset : mp.startX;
      const targetY = mp.axis === "vertical" ? mp.startY + offset : mp.startY;

      const dx = targetX - mp.rect.x;
      const dy = targetY - mp.rect.y;

      mp.rect.setPosition(targetX, targetY);
      mp.body.reset(targetX, targetY);
      mp.art.setPosition(targetX, targetY);

      if (this.player && !this.locked) {
        const platTop = targetY - mp.h / 2;
        const platLeft = targetX - mp.w / 2;
        const platRight = targetX + mp.w / 2;
        const playerBottom = this.player.bottom;
        const playerX = this.player.x;

        const isStandingOn =
          Math.abs(playerBottom - platTop) <= 12 &&
          playerX >= platLeft - 10 &&
          playerX <= platRight + 10 &&
          (this.player.body.touching.down || this.player.body.blocked.down || this.player.body.velocity.y >= 0);

        if (isStandingOn) {
          riderDx = dx;
          riderDy = dy;
          this.lastGrounded = { x: playerX, feetY: playerBottom };
        }
      }
    }

    if ((riderDx !== 0 || riderDy !== 0) && !this.locked) {
      this.player.rect.x += riderDx;
      this.player.rect.y += riderDy;
      this.player.body.x += riderDx;
      this.player.body.y += riderDy;
      // WICHTIG: Kein body.reset()! Dadurch bleiben Sprung- und Lauf-Velocity erhalten,
      // sodass der Spieler jederzeit flüssig abspringen und auf dem Lift laufen kann.
    }

    const input = this.readCombinedInput(gp, touchInput);
    this.player.handleInput(input, this.locked);

    if (!this.locked && this.player.body.blocked.down) {
      this.lastGrounded = { x: this.player.x, feetY: this.player.bottom };
    }
    this.rotateBanner?.update();
    if (!this.locked) this.recorder.update(this.time.now, this.player, this.enemies);

    if (!this.locked && this.player.y > this.fallThreshold) {
      this.triggerDeath("fall", this.player.x, this.player.y);
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
    gp: { left: boolean; right: boolean; jump: boolean },
    touch?: { left: boolean; right: boolean; jump: boolean }
  ): MoveInput {
    const { cursors, keys } = this;
    return {
      left: cursors.left.isDown || keys.A.isDown || !!touch?.left || gp.left,
      right: cursors.right.isDown || keys.D.isDown || !!touch?.right || gp.right,
      jump: cursors.up.isDown || cursors.space.isDown || keys.W.isDown || !!touch?.jump || gp.jump,
    };
  }

  /** Pollt die Browser Gamepad API für Xbox / Bluetooth Controller */
  private readGamepad(): { left: boolean; right: boolean; jump: boolean; restart: boolean; pause: boolean } {
    const res = { left: false, right: false, jump: false, restart: false, pause: false };
    if (typeof navigator.getGamepads !== "function") return res;

    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      const g = gamepads[i];
      if (!g || !g.connected) continue;

      const stickX = g.axes[0] ?? 0;
      const dpadLeft = g.buttons[14]?.pressed ?? false;
      const dpadRight = g.buttons[15]?.pressed ?? false;

      if (stickX < -0.28 || dpadLeft) res.left = true;
      if (stickX > 0.28 || dpadRight) res.right = true;

      // Button 0 (A) oder Button 12 (D-Pad Up) -> Springen
      if (g.buttons[0]?.pressed || g.buttons[12]?.pressed) res.jump = true;
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
      // Trampolin drückt sich sichtbar ein und federt zurück
      this.tweens.killTweensOf(bEntity.art);
      this.tweens.add({
        targets: bEntity.art,
        scaleY: 0.45,
        y: bEntity.y + bEntity.h * 0.28,
        duration: 55,
        yoyo: true,
        ease: "Back.easeOut",
      });
    }

    const prevVy = this.player.body.velocity.y;
    const isHardImpact = prevVy > 220 || this.cursors?.up.isDown || this.keys?.W.isDown;
    const bounceVelocity = isHardImpact ? BOUNCE_VELOCITY * 1.08 : BOUNCE_VELOCITY * 0.76;

    this.player.trampolineBounce(bounceVelocity, () => {
      playJump();
      burstParticles(this, this.player.x, this.player.bottom, {
        color: INK.green,
        count: 18,
        speed: [90, 270],
        size: 9,
        duration: 450,
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
    this.goal.setAlpha(1);

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
    if (this.time.now - this.lastTeleportAt < 420) return;

    const srcId = tpRect.getData("id");
    const src = this.teleportersList.find((t) => t.id === srcId);
    if (!src) return;

    const dest = this.teleportersList.find((t) => t.id === src.targetId);
    if (!dest) {
      // Wenn nur 1 Portal existiert: magischer Gravitations-Katapult / Vortex-Boost!
      this.lastTeleportAt = this.time.now;
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

    this.lastTeleportAt = this.time.now;

    // Ursprung: Partikel & Audio
    burstParticles(this, src.x, src.y, {
      color: INK.purple,
      count: 22,
      speed: [80, 260],
      size: 9,
      duration: 450,
    });
    playHelper();

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

    // Sammelobjekte zurücksetzen
    this.collectedCount = 0;
    for (const c of this.collectiblesList) {
      c.collected = false;
      if (c.rect.body) (c.rect.body as Phaser.Physics.Arcade.Body).enable = true;
      c.art.setVisible(true).setAlpha(1).setScale(1);
    }
    if (this.totalCollectibles > 0) {
      this.doodles.setGoalLocked(true);
      this.goal.setAlpha(0.45);
      this.drawGoalLockDoodle();
    } else {
      this.doodles.setGoalLocked(false);
      this.goal.setAlpha(1);
    }
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);

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

    // Sammelobjekte zurücksetzen
    this.collectedCount = 0;
    for (const c of this.collectiblesList) {
      c.collected = false;
      if (c.rect.body) (c.rect.body as Phaser.Physics.Arcade.Body).enable = true;
      c.art.setVisible(true).setAlpha(1).setScale(1);
    }
    if (this.totalCollectibles > 0) {
      this.doodles.setGoalLocked(true);
      this.goal.setAlpha(0.45);
      this.drawGoalLockDoodle();
    } else {
      this.doodles.setGoalLocked(false);
      this.goal.setAlpha(1);
    }
    this.hud.setCollectibles(this.collectedCount, this.totalCollectibles);

    this.player.teleport(sx(this.level.start.x), sy(this.level.start.y));
  }

  private rectTopLeft(r: { id: string; x: number; y: number; w: number; h: number }, color: number) {
    const rect = this.add.rectangle(sx(r.x), sy(r.y), sx(r.w), sy(r.h), color).setOrigin(0, 0).setAlpha(0);
    rect.setData("id", r.id);
    return rect;
  }
}
