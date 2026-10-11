import Phaser from "phaser";
import { HAND_FONT } from "./fonts";
import { INK, INK_CSS } from "./palette";
import { seededFor, sketchCircle, sketchLine } from "./sketch";

const STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: HAND_FONT,
  fontSize: "32px",
  color: INK_CSS.black,
  stroke: INK_CSS.paper,
  strokeThickness: 6,
};
const HUD_DEPTH = 1000;

/** Top-left marker-written coin counter (with a doodled coin and underline), fixed to the camera. */
export class Hud {
  private readonly collectibleText: Phaser.GameObjects.Text;
  private readonly musicText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    // Static doodles: drawn once, never redrawn.
    const rng = seededFor("hud");
    const doodle = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
    // Dino-Ei Doodle
    doodle.fillStyle(0xffec80, 0.95).fillEllipse(36, 36, 12, 16);
    sketchCircle(doodle, 36, 36, 13.5, { color: INK.yellowDark, width: 2.8, wobble: 1.2 }, rng);
    sketchLine(doodle, { x: 18, y: 64 }, { x: 300, y: 63 }, { color: INK.blue, width: 2.6, alpha: 0.7, wobble: 1.6 }, rng);

    // Sammelobjekte Text (Dino-Eier)
    this.collectibleText = scene.add
      .text(58, 20, "🥚 Dino-Eier", STYLE)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setRotation(-0.015);

    this.musicText = scene.add
      .text(20, 76, "🎵 Dino-Musik: AN (M)", { ...STYLE, fontSize: "22px", color: INK_CSS.green })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setRotation(-0.02);
  }

  setMuted(muted: boolean) {
    this.musicText.setText(muted ? "🔇 Ton: Stumm (M)" : "🎵 Dino-Musik: AN (M)");
    this.musicText.setColor(muted ? INK_CSS.red : INK_CSS.green);
  }

  setCoins(_coins: number) {
    // Nur Dino-Eier – keine separaten Münzen
  }

  setCollectibles(collected: number, total: number) {
    if (total <= 0) {
      this.collectibleText.setText("🥚 Freie Bahn zum Ziel!");
      this.collectibleText.setColor(INK_CSS.black);
      return;
    }
    if (collected >= total) {
      this.collectibleText.setText(`🥚 ${collected}/${total} Eier (Ziel offen 🏆)`);
      this.collectibleText.setColor(INK_CSS.green);
    } else {
      this.collectibleText.setText(`🥚 ${collected}/${total} Eier gesammelt 🔒`);
      this.collectibleText.setColor(INK_CSS.yellow);
    }
  }

  /** Schaltet zwischen normaler und extragroßer TV-HUD-Darstellung um */
  setTvMode(tvMode: boolean) {
    if (tvMode) {
      this.collectibleText.setFontSize("44px").setStroke(INK_CSS.paper, 8);
      this.musicText.setFontSize("28px").setY(86);
    } else {
      this.collectibleText.setFontSize("32px").setStroke(INK_CSS.paper, 6);
      this.musicText.setFontSize("22px").setY(76);
    }
  }
}
