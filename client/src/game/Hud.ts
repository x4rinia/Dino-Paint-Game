import Phaser from "phaser";
import { HAND_FONT } from "./fonts";
import { INK_CSS } from "./palette";

const HUD_DEPTH = 1000;

/** Kompakte, unaufdringliche HUD-Anzeige für Dino-Münzen oben links */
export class Hud {
  private readonly collectibleText: Phaser.GameObjects.Text;
  private readonly bgBadge: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    // Dezentes, transparentes Hintergrund-Badge, das im Level nicht stört
    this.bgBadge = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH - 1);

    // Sammelobjekte-Text (Dino-Münzen, klein & klar)
    this.collectibleText = scene.add
      .text(20, 14, "🪙 0/0 Münzen", {
        fontFamily: HAND_FONT,
        fontSize: "18px",
        color: "#ffffff",
        stroke: "#18181b",
        strokeThickness: 3.5,
      })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.drawBadge(150);
  }

  private drawBadge(width: number) {
    this.bgBadge.clear();
    this.bgBadge.fillStyle(0x0f172a, 0.45);
    this.bgBadge.fillRoundedRect(12, 10, width, 30, 8);
    this.bgBadge.lineStyle(1.5, 0xffffff, 0.25);
    this.bgBadge.strokeRoundedRect(12, 10, width, 30, 8);
  }

  setMuted(_muted: boolean) {
    // Sound/Musik-Status wird nicht mehr dauerhaft im Spielfeld eingeblendet
  }

  setCoins(_coins: number) {
    // Einheitliche Dino-Münzen
  }

  setCollectibles(collected: number, total: number) {
    if (total <= 0) {
      this.collectibleText.setText("✨ Tor offen!");
      this.collectibleText.setColor("#4ade80");
      this.drawBadge(120);
      return;
    }
    if (collected >= total) {
      this.collectibleText.setText(`🪙 ${collected}/${total} Münzen (Tor offen 🏆)`);
      this.collectibleText.setColor("#4ade80");
      this.drawBadge(210);
    } else {
      this.collectibleText.setText(`🪙 ${collected}/${total} Münzen 🔒`);
      this.collectibleText.setColor("#facc15");
      this.drawBadge(160);
    }
  }

  /** Schaltet zwischen normaler und extragroßer TV-HUD-Darstellung um */
  setTvMode(tvMode: boolean) {
    if (tvMode) {
      this.collectibleText.setFontSize("24px");
      this.drawBadge(240);
    } else {
      this.collectibleText.setFontSize("18px");
      this.drawBadge(170);
    }
  }
}
