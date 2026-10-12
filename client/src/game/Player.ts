import Phaser from "phaser";
import { JUMP_VELOCITY, PLAYER_H, PLAYER_W, RUN_SPEED } from "@sketchquest/shared";
import { playJump } from "./audio";
import { BOIL_VARIANTS, DEPTH, INK } from "./palette";
import { burstParticles } from "./particles";
import { seededFor } from "./sketch";
import { drawPlayer } from "./characterArt";
import { PF_AIRBORNE, PF_FACING_LEFT, PF_LANDING, PF_RISING, PF_RUNNING, type PlayerFrame } from "./RunRecorder";

/** Invisible physics carrier color; the visible doodle is the `art` Graphics. */
const PLAYER_COLOR = 0x2a6df4;
/** Grace window after leaving a platform where a jump still counts. */
const COYOTE_MS = 100;
/** Grace window before landing where an earlier jump press is remembered. */
const JUMP_BUFFER_MS = 100;
/** Releasing jump early clamps the upward speed to this fraction of a full jump. */
const JUMP_CUTOFF_FACTOR = 0.5;
const SQUASH_STRETCH_MS = 120;

/** Held-state of the three player controls, from keyboard and/or touch. */
export type MoveInput = { left: boolean; right: boolean; up?: boolean; down?: boolean; jump: boolean };

export type GravityMode = "normal" | "low";
export type GameMode = "jump_n_run" | "rpg_labyrinth";

/** The player rectangle plus its arcade body, movement, and jump feel. */
export class Player {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly body: Phaser.Physics.Arcade.Body;

  private readonly scene: Phaser.Scene;
  private gravityMode: GravityMode = "normal";
  private gameMode: GameMode = "jump_n_run";
  private allowDoubleJump = false;
  private lastGroundedAt = -Infinity;
  private lastJumpPressedAt = -Infinity;
  private wasJumpDown = false;
  private wasGrounded = true;
  private canDoubleJump = true;
  readonly art: Phaser.GameObjects.Graphics;
  readonly sprite: Phaser.GameObjects.Image;
  facing: 1 | -1 = 1;
  private artKey = "";
  private knockbackUntil = 0;
  private magmaDashCount = 0;
  /** Called on every real (input-driven) jump, for the run recorder. */
  onJump?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.rect = scene.add.rectangle(x, y, PLAYER_W, PLAYER_H, PLAYER_COLOR).setAlpha(0);
    this.art = scene.add.graphics().setDepth(DEPTH.player);
    const hasTexture = scene.textures.exists("dino_idle");
    this.sprite = scene.add.image(x, y, hasTexture ? "dino_idle" : "__DEFAULT").setDepth(DEPTH.player);
    this.sprite.setDisplaySize(PLAYER_W * 1.35, PLAYER_H * 1.35);
    this.sprite.setVisible(hasTexture);
    this.art.setVisible(!hasTexture);
    scene.physics.add.existing(this.rect);
    this.body = this.rect.body as Phaser.Physics.Arcade.Body;
    this.body.setCollideWorldBounds(true);
  }

  setGameMode(mode: GameMode) {
    this.gameMode = mode;
    if (mode === "rpg_labyrinth") {
      this.body.setAllowGravity(false);
      this.body.setGravity(0, 0);
    } else {
      this.body.setAllowGravity(true);
    }
  }

  setAllowDoubleJump(allow: boolean) {
    this.allowDoubleJump = allow;
  }

  setGravityMode(mode: GravityMode) {
    this.gravityMode = mode;
  }

  /** Bumper-Rückstoß / elastischer Abprall für Trampoline und Fallen */
  knockback(vx: number, vy: number, durationMs = 300) {
    this.body.setVelocity(vx, vy);
    this.knockbackUntil = this.scene.time.now + durationMs;
    this.rect.setScale(0.8, 1.25);
    this.scene.tweens.add({
      targets: this.rect,
      scaleX: 1,
      scaleY: 1,
      duration: durationMs,
      ease: "Quad.easeOut",
    });
  }

  get x() {
    return this.rect.x;
  }

  get y() {
    return this.rect.y;
  }

  /** Bottom edge of the player's hitbox, in world px. */
  get bottom() {
    return this.rect.y + PLAYER_H / 2;
  }

  /** Top edge of the player's hitbox, in world px. */
  get top() {
    return this.rect.y - PLAYER_H / 2;
  }

  /** True while moving downward, used to tell a stomp from a side hit. */
  get isFalling() {
    return this.body.velocity.y > 0;
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  handleInput(input: MoveInput, locked: boolean) {
    const now = this.scene.time.now;

    // 🧭 LABYRINTH / RPG MODUS (4-WEGE-STEUERUNG)
    if (this.gameMode === "rpg_labyrinth") {
      if (locked) {
        this.body.setVelocity(0, 0);
        this.wasJumpDown = false;
        return;
      }

      // Falls Dino gerade von einem Trampolin/Bumper zurückgekickt wird
      if (now < this.knockbackUntil) {
        return;
      }

      const { left, right, up = false, down = false, jump: jumpDown } = input;
      const jumpJustPressed = jumpDown && !this.wasJumpDown;

      const inputX = Number(right) - Number(left);
      const inputY = Number(down) - Number(up);
      // Atmosphären-Einfluss im Labyrinth:
      const bgTheme = this.scene.game.registry.get("backgroundTheme");
      const isSpace = bgTheme === "space";
      const isVolcano = this.allowDoubleJump || bgTheme === "volcano";

      // Vulkan-Turbo: +25% schnellere Bewegung durchs Labyrinth!
      const speedMultiplier = isVolcano ? 1.25 : 1.0;
      const vx = inputX * RUN_SPEED * speedMultiplier;
      const vy = inputY * RUN_SPEED * speedMultiplier;

      if (left && !right) this.facing = -1;
      else if (right && !left) this.facing = 1;

      if (jumpJustPressed) {
        // Sprungtaste = Ausweich-Dash / Hopser!
        // Auf Vulkan: Doppel-Dash (Magma-Turbo) mit Boost!
        const canDash = this.magmaDashCount < (isVolcano ? 2 : 1);
        if (canDash) {
          this.magmaDashCount++;
          const dashDirX = inputX !== 0 ? inputX : this.facing;
          const dashDirY = inputY !== 0 ? inputY : 0;
          const dashSpeed = RUN_SPEED * (isVolcano ? 2.5 : 1.85);
          this.body.setVelocity(dashDirX * dashSpeed, dashDirY * dashSpeed);
          this.knockbackUntil = now + (isVolcano ? 180 : 120);
          this.playJumpSquash();
          playJump();
          this.onJump?.();
          burstParticles(this.scene, this.x, this.y, {
            color: isVolcano ? INK.orange : INK.paper,
            count: 10,
            speed: [50, 150],
            size: 6,
            duration: 250,
          });
        }
      } else {
        if (inputX !== 0 || inputY !== 0) {
          this.magmaDashCount = 0;
          this.body.setVelocity(vx, vy);
          if (isVolcano && Math.random() < 0.28) {
            burstParticles(this.scene, this.x, this.y + 14, {
              color: INK.orange,
              count: 2,
              speed: [15, 50],
              size: 4,
              duration: 220,
            });
          } else if (isSpace && Math.random() < 0.25) {
            burstParticles(this.scene, this.x, this.y + 14, {
              color: INK.purple,
              count: 2,
              speed: [10, 40],
              size: 4,
              duration: 280,
            });
          }
        } else if (isSpace) {
          // Kosmische Schwerelosigkeit: Sanftes Ausgleiten (Zero-G Drift)
          this.body.setVelocity(this.body.velocity.x * 0.94, this.body.velocity.y * 0.94);
        } else {
          this.body.setVelocity(0, 0);
        }
      }

      this.wasJumpDown = jumpDown;
      return;
    }

    // 🏃‍♂️ KLASSISCHER JUMP 'N' RUN MODUS (MIT SCHWERKRAFT)
    const grounded = this.grounded;
    if (grounded) {
      this.lastGroundedAt = now;
      this.canDoubleJump = true;
    }

    if (!this.wasGrounded && grounded) this.playLandSquash();

    if (locked) {
      this.body.setVelocityX(0);
      this.wasJumpDown = false;
      this.wasGrounded = grounded;
      return;
    }

    const { left, right, jump: jumpDown } = input;
    if (left && !right) this.facing = -1;
    else if (right && !left) this.facing = 1;

    const jumpJustPressed = jumpDown && !this.wasJumpDown;

    this.body.setVelocityX((Number(right) - Number(left)) * RUN_SPEED);

    if (jumpJustPressed) this.lastJumpPressedAt = now;

    const withinCoyote = now - this.lastGroundedAt <= COYOTE_MS;
    const withinBuffer = now - this.lastJumpPressedAt <= JUMP_BUFFER_MS;

    const jumpVel = this.gravityMode === "low" ? 430 : JUMP_VELOCITY;

    if (withinBuffer && withinCoyote) {
      // Normaler Sprung vom Boden oder Kante (Coyote-Time)
      this.lastJumpPressedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
      this.canDoubleJump = true;
      this.body.setVelocityY(-jumpVel);
      this.playJumpSquash();
      playJump();
      this.onJump?.();
      if (this.gravityMode === "low") {
        burstParticles(this.scene, this.x, this.y + 12, {
          color: INK.purple,
          count: 12,
          speed: [40, 140],
          size: 6,
          duration: 350,
        });
      }
    } else if (jumpJustPressed && !withinCoyote && this.canDoubleJump && this.allowDoubleJump) {
      // 🌋 DINO DOPPELSPRUNG: Nur auf der Vulkanlandschaft freigeschaltet!
      this.canDoubleJump = false;
      this.lastJumpPressedAt = -Infinity;
      this.body.setVelocityY(-jumpVel);
      this.playDoubleJumpSquash();
      playJump();
      this.onJump?.();
      burstParticles(this.scene, this.x, this.y + 12, {
        color: INK.orange,
        count: 16,
        speed: [60, 220],
        size: 7,
        duration: 350,
      });
    } else if (!jumpDown && this.body.velocity.y < -jumpVel * JUMP_CUTOFF_FACTOR) {
      // Vorzeitiges Loslassen für kontrollierte Mini-Hüpfer
      this.body.setVelocityY(-jumpVel * JUMP_CUTOFF_FACTOR);
    }

    this.wasJumpDown = jumpDown;
    this.wasGrounded = grounded;
  }

  /** Bounce upward after stomping an enemy or hitting a green trampoline. */
  bounce(velocity: number) {
    this.body.setVelocityY(-velocity);
    this.lastGroundedAt = -Infinity;
    this.canDoubleJump = true;
    this.playJumpSquash();
  }

  /**
   * Weicheres, lebendigeres Trampolin-Verhalten:
   * 1. Kompression / Squash bei Kontakt
   * 2. Kurze Mini-Verzögerung für das "Boing"-Gefühl
   * 3. Federnder Hochsprung mit vertikalem Stretch
   */
  trampolineBounce(velocity: number, onSpring?: () => void) {
    this.scene.tweens.killTweensOf(this.rect);
    this.body.setVelocityY(-velocity);
    this.lastGroundedAt = -Infinity;
    this.canDoubleJump = true;
    this.rect.setScale(0.8, 1.35);
    this.scene.tweens.add({
      targets: this.rect,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: "Back.easeOut",
    });
    onSpring?.();
  }

  teleport(x: number, y: number) {
    this.body.reset(x, y);
    this.rect.setScale(1, 1);
  }

  setActive(active: boolean) {
    this.body.enable = active;
    this.rect.setVisible(active);
    const hasTexture = this.scene.textures.exists("dino_idle");
    this.sprite.setVisible(active && hasTexture);
    this.art.setVisible(active && !hasTexture);
  }

  /** Fills `out` with everything a replay needs to redraw this exact frame. */
  snapshot(out: PlayerFrame): PlayerFrame {
    const { body, rect } = this;
    const pose = this.pose();
    let flags = 0;
    if (pose.running) flags |= PF_RUNNING;
    if (pose.airborne) flags |= PF_AIRBORNE;
    if (pose.rising) flags |= PF_RISING;
    if (!pose.airborne && rect.scaleY < 0.97) flags |= PF_LANDING;
    if (this.facingFor(body.velocity.x) < 0) flags |= PF_FACING_LEFT;
    out.x = body.center.x;
    out.y = body.center.y;
    out.scaleX = rect.scaleX;
    out.scaleY = rect.scaleY;
    out.flags = flags;
    return out;
  }

  /** Replay mode: the body is switched off and the doodle is driven from recorded frames (see `drawReplay`). */
  enterReplay() {
    this.body.enable = false;
    this.artKey = "";
  }

  /** Back to live play; the caller teleports the player to the start afterwards. */
  exitReplay() {
    this.scene.tweens.killTweensOf(this.rect);
    this.setActive(true);
    this.artKey = "";
  }

  /**
   * Follows the physics body every frame (so squash/stretch and facing stay
   * smooth) but only redraws the doodle when the boil tick or pose changes.
   */
  draw(tick: number) {
    const { body, rect } = this;
    if (Math.abs(body.velocity.x) > 35) {
      this.facing = body.velocity.x > 0 ? 1 : -1;
    }
    const hasTexture = this.scene.textures.exists("dino_idle");
    if (hasTexture) {
      this.sprite.setVisible(true);
      this.art.setVisible(false);
      this.sprite.setPosition(body.center.x, body.center.y - 2);
      this.sprite.setScale(
        (rect.scaleX * this.facing * 50) / (this.sprite.width || 200),
        (rect.scaleY * 42) / (this.sprite.height || 200)
      );
      const pose = this.pose();
      let tex = "dino_idle";
      if (pose.airborne) {
        tex = "dino_jump";
      } else if (pose.running) {
        tex = Math.floor(tick / 5) % 2 === 0 ? "dino_walk" : "dino_run";
      }
      if (this.sprite.texture.key !== tex && this.scene.textures.exists(tex)) {
        this.sprite.setTexture(tex);
      }
    } else {
      this.sprite.setVisible(false);
      this.art.setVisible(true);
      this.paint(tick, body.center.x, body.center.y, rect.scaleX, rect.scaleY, this.pose());
    }
  }

  /** Same doodle and cache as `draw`, positioned and posed from a recorded (interpolated) frame. */
  drawReplay(tick: number, f: PlayerFrame) {
    this.facing = f.flags & PF_FACING_LEFT ? -1 : 1;
    const hasTexture = this.scene.textures.exists("dino_idle");
    if (hasTexture) {
      this.sprite.setVisible(true);
      this.art.setVisible(false);
      this.sprite.setPosition(f.x, f.y - 2);
      this.sprite.setScale(
        (f.scaleX * this.facing * 50) / (this.sprite.width || 200),
        (f.scaleY * 42) / (this.sprite.height || 200)
      );
      const isAirborne = (f.flags & PF_AIRBORNE) !== 0;
      const isRunning = (f.flags & PF_RUNNING) !== 0;
      let tex = "dino_idle";
      if (isAirborne) tex = "dino_jump";
      else if (isRunning) tex = Math.floor(tick / 5) % 2 === 0 ? "dino_walk" : "dino_run";
      if (this.sprite.texture.key !== tex && this.scene.textures.exists(tex)) {
        this.sprite.setTexture(tex);
      }
    } else {
      this.sprite.setVisible(false);
      this.art.setVisible(true);
      this.paint(tick, f.x, f.y, f.scaleX, f.scaleY, {
        running: (f.flags & PF_RUNNING) !== 0,
        airborne: (f.flags & PF_AIRBORNE) !== 0,
        rising: (f.flags & PF_RISING) !== 0,
      });
    }
  }

  private facingFor(vx: number): 1 | -1 {
    if (vx > 5) return 1;
    if (vx < -5) return -1;
    return this.facing;
  }

  private pose() {
    const { body } = this;
    if (this.gameMode === "rpg_labyrinth") {
      const moving = Math.hypot(body.velocity.x, body.velocity.y) > 10;
      return {
        running: moving,
        airborne: false,
        rising: false,
      };
    }
    const airborne = !this.grounded;
    const rising = airborne && body.velocity.y < 0;
    return {
      running: !airborne && Math.abs(body.velocity.x) > 10,
      airborne,
      rising,
    };
  }

  private paint(
    tick: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    pose: { running: boolean; airborne: boolean; rising: boolean }
  ) {
    const { art } = this;
    art.setPosition(x, y);
    art.setScale(scaleX * this.facing, scaleY);

    const { running, airborne, rising } = pose;
    const key = `${tick}:${running}:${airborne}:${rising}:${this.gravityMode}`;
    if (key === this.artKey) return;
    this.artKey = key;
    drawPlayer(art, { tick, running, airborne, rising }, seededFor("player", tick % BOIL_VARIANTS));
  }

  private playJumpSquash() {
    this.scene.tweens.killTweensOf(this.rect);
    this.rect.setScale(0.8, 1.25);
    this.scene.tweens.add({
      targets: this.rect,
      scaleX: 1,
      scaleY: 1,
      duration: SQUASH_STRETCH_MS,
      ease: "Quad.easeOut",
    });
  }

  private playDoubleJumpSquash() {
    this.scene.tweens.killTweensOf(this.rect);
    this.rect.setScale(0.72, 1.35);
    this.scene.tweens.add({
      targets: this.rect,
      scaleX: 1,
      scaleY: 1,
      duration: SQUASH_STRETCH_MS + 40,
      ease: "Back.easeOut",
    });
  }

  private playLandSquash() {
    this.scene.tweens.killTweensOf(this.rect);
    this.rect.setScale(1.25, 0.75);
    this.scene.tweens.add({
      targets: this.rect,
      scaleX: 1,
      scaleY: 1,
      duration: SQUASH_STRETCH_MS,
      ease: "Quad.easeOut",
    });
  }
}
