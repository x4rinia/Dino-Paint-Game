import React, { useState } from "react";
import { BACKGROUND_THEMES, type BackgroundTheme } from "../game/paper";
import type { GameMode } from "../game/Player";
import { setSetting } from "../storage/db";

interface GameModeModalProps {
  onClose: () => void;
  currentBackground: BackgroundTheme;
  onBackgroundChange: (bg: BackgroundTheme) => void;
  currentGameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
}

export function GameModeModal({
  onClose,
  currentBackground,
  onBackgroundChange,
  currentGameMode,
  onGameModeChange,
}: GameModeModalProps) {
  const [selectedBg, setSelectedBg] = useState<BackgroundTheme>(currentBackground);
  const [gameMode, setGameMode] = useState<GameMode>(currentGameMode);

  const handleSaveAndClose = () => {
    void setSetting("selected_background", selectedBg);
    void setSetting("game_mode", gameMode);
    onBackgroundChange(selectedBg);
    onGameModeChange(gameMode);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>🎮 Spielmodus & Welten</h3>
          <button className="button-close" type="button" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        {/* 🎮 SPIELMODI */}
        <div className="settings-section">
          <h4>🎮 Spielmodus wählen</h4>
          <p style={{ margin: "4px 0 12px", fontSize: "0.9rem", color: "#b0b5c5" }}>
            Wähle dein bevorzugtes Spielerlebnis für alle gezeichneten Welten:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            <button
              className={`button ${gameMode === "jump_n_run" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => setGameMode("jump_n_run")}
              style={{
                textAlign: "left",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                borderColor: gameMode === "jump_n_run" ? "#4ade80" : undefined,
                background: gameMode === "jump_n_run" ? "rgba(46, 180, 87, 0.18)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1.05rem" }}>🏃‍♂️ Jump 'n' Run (Platformer)</strong>
                {gameMode === "jump_n_run" && <span style={{ color: "#4ade80", fontWeight: "bold" }}>✓ Aktiv</span>}
              </div>
              <span style={{ fontSize: "0.84rem", opacity: 0.9, lineHeight: 1.4 }}>
                Klassischer 2D-Platformer mit Schwerkraft nach unten, Sprüngen, Klettern auf Plattformen und hohen Trampolin-Sprüngen.
              </span>
            </button>

            <button
              className={`button ${gameMode === "rpg_labyrinth" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => setGameMode("rpg_labyrinth")}
              style={{
                textAlign: "left",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                borderColor: gameMode === "rpg_labyrinth" ? "#4ade80" : undefined,
                background: gameMode === "rpg_labyrinth" ? "rgba(46, 180, 87, 0.18)" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1.05rem" }}>🧭 Labyrinth (4-Wege / RPG)</strong>
                {gameMode === "rpg_labyrinth" && <span style={{ color: "#4ade80", fontWeight: "bold" }}>✓ Aktiv</span>}
              </div>
              <span style={{ fontSize: "0.84rem", opacity: 0.9, lineHeight: 1.4 }}>
                Freies 4-Wege-Laufen nach Oben, Unten, Links & Rechts. Holzkisten werden wie bei Sokoban verschoben. Wände stoppen den Dino sicher ab.
              </span>
            </button>
          </div>
        </div>

        {/* 🎨 HINTERGRUND & SPIELWELT */}
        <div className="settings-section">
          <h4>🎨 Spielwelt & Hintergrund</h4>
          <p style={{ margin: "4px 0 10px", fontSize: "0.9rem", color: "#b0b5c5" }}>
            Wähle die Atmosphäre und das Design der Spielwelt:
          </p>
          <div className="background-choices-grid">
            {BACKGROUND_THEMES.map((theme) => {
              const isSelected = selectedBg === theme.id;
              return (
                <button
                  key={theme.id}
                  className={`bg-choice-card ${isSelected ? "active" : ""}`}
                  type="button"
                  onClick={() => setSelectedBg(theme.id)}
                >
                  <div className={`bg-choice-preview preview-${theme.id}`}>
                    <span className="bg-preview-icon">{theme.icon}</span>
                  </div>
                  <div className="bg-choice-content">
                    <strong>{theme.name}</strong>
                    <span className="bg-choice-sub">{theme.subtitle}</span>
                  </div>
                  {isSelected && <span className="bg-choice-check">✓ Aktiv</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* FOOTER BUTTONS: OK & ABBRECHEN */}
        <div
          className="settings-footer"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <button className="button button-secondary" type="button" onClick={handleCancel}>
            ✕ Abbrechen
          </button>
          <button className="button button-primary" type="button" onClick={handleSaveAndClose}>
            ✓ OK / Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
