import React, { useEffect, useState } from "react";
import { isMuted, toggleMute, isMusicEnabled, setMusicEnabled } from "../game/audio";
import { narrator } from "../game/narrator";
import { getStorageQuota, requestPersistentStorage, getSetting, setSetting } from "../storage/db";
import { BACKGROUND_THEMES, type BackgroundTheme } from "../game/paper";
import type { GameMode } from "../game/Player";

interface SettingsModalProps {
  onClose: () => void;
  currentBackground?: BackgroundTheme;
  onBackgroundChange?: (bg: BackgroundTheme) => void;
  currentGameMode?: GameMode;
  onGameModeChange?: (mode: GameMode) => void;
}

export function SettingsModal({
  onClose,
  currentBackground,
  onBackgroundChange,
  currentGameMode,
  onGameModeChange,
}: SettingsModalProps) {
  const [muted, setMuted] = useState(isMuted());
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  const [narratorOn, setNarratorOn] = useState(narrator.isEnabled());
  const [spawnMode, setSpawnMode] = useState<"manual" | "auto">("manual");
  const [selectedBg, setSelectedBg] = useState<BackgroundTheme>(currentBackground || "paper");
  const [gameMode, setGameMode] = useState<GameMode>(currentGameMode || "jump_n_run");
  const [gamepads, setGamepads] = useState<string[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number;
    quotaBytes: number;
    percentage: number;
    persisted: boolean;
  }>({ usedBytes: 0, quotaBytes: 0, percentage: 0, persisted: false });
  const [persisting, setPersisting] = useState(false);

  useEffect(() => {
    // Einstellungen aus Speicher laden
    getSetting<boolean>("music_enabled", true).then((enabled) => {
      setMusicOn(enabled);
      setMusicEnabled(enabled);
    });
    getSetting<boolean>("narrator_enabled", false).then((enabled) => {
      setNarratorOn(enabled);
      narrator.setEnabled(enabled);
    });
    getSetting<"manual" | "auto">("spawn_mode", "manual").then((mode) => {
      setSpawnMode(mode);
    });
    getSetting<BackgroundTheme>("selected_background", "paper").then((bg) => {
      setSelectedBg(bg);
    });
    getSetting<GameMode>("game_mode", "jump_n_run").then((mode) => {
      setGameMode(mode);
    });

    const updateGamepads = () => {
      if (typeof navigator.getGamepads !== "function") return;
      const list: string[] = [];
      const gps = navigator.getGamepads();
      for (let i = 0; i < gps.length; i++) {
        const gp = gps[i];
        if (gp && gp.connected) {
          list.push(gp.id || `Controller #${i + 1}`);
        }
      }
      setGamepads(list);
    };

    updateGamepads();
    window.addEventListener("gamepadconnected", updateGamepads);
    window.addEventListener("gamepaddisconnected", updateGamepads);
    const interval = setInterval(updateGamepads, 1000);

    // Speicherplatz prüfen
    getStorageQuota().then(setStorageInfo);

    return () => {
      window.removeEventListener("gamepadconnected", updateGamepads);
      window.removeEventListener("gamepaddisconnected", updateGamepads);
      clearInterval(interval);
    };
  }, []);

  const handleToggleSound = () => {
    const newMuted = toggleMute();
    setMuted(newMuted);
  };

  const handleToggleMusic = () => {
    const next = !musicOn;
    setMusicOn(next);
    setMusicEnabled(next);
    void setSetting("music_enabled", next);
  };

  const handleToggleNarrator = () => {
    const next = !narratorOn;
    setNarratorOn(next);
    narrator.setEnabled(next);
    void setSetting("narrator_enabled", next);
  };

  const handleToggleSpawnMode = (mode: "manual" | "auto") => {
    setSpawnMode(mode);
    void setSetting("spawn_mode", mode);
  };

  const handleSelectBackground = (theme: BackgroundTheme) => {
    setSelectedBg(theme);
    void setSetting("selected_background", theme);
    if (onBackgroundChange) onBackgroundChange(theme);
  };

  const handleSelectGameMode = (mode: GameMode) => {
    setGameMode(mode);
    void setSetting("game_mode", mode);
    if (onGameModeChange) onGameModeChange(mode);
  };

  const handleRequestPersistence = async () => {
    setPersisting(true);
    await requestPersistentStorage();
    const updated = await getStorageQuota();
    setStorageInfo(updated);
    setPersisting(false);
  };

  const formatMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>⚙️ Einstellungen & Spieloptionen</h3>
          <button className="button-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 🎮 SPIELMODI */}
        <div className="settings-section">
          <h4>🎮 Spielmodus</h4>
          <p style={{ margin: "4px 0 12px", fontSize: "0.9rem", color: "#b0b5c5" }}>
            Wähle dein bevorzugtes Spielerlebnis für alle gezeichneten Welten:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }}>
            <button
              className={`button ${gameMode === "jump_n_run" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => handleSelectGameMode("jump_n_run")}
              style={{
                textAlign: "left",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                borderColor: gameMode === "jump_n_run" ? "#4ade80" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1.02rem" }}>🏃‍♂️ Jump 'n' Run (Platformer)</strong>
                {gameMode === "jump_n_run" && <span style={{ color: "#4ade80", fontWeight: "bold" }}>✓ Aktiv</span>}
              </div>
              <span style={{ fontSize: "0.82rem", opacity: 0.88, lineHeight: 1.35 }}>
                Klassischer 2D-Platformer mit Schwerkraft nach unten, Klettern auf Plattformen & hohen Trampolinsprüngen.
              </span>
            </button>

            <button
              className={`button ${gameMode === "rpg_labyrinth" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => handleSelectGameMode("rpg_labyrinth")}
              style={{
                textAlign: "left",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                borderColor: gameMode === "rpg_labyrinth" ? "#4ade80" : undefined,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "1.02rem" }}>🧭 Labyrinth-Erkundung (Dungeon / Top-Down)</strong>
                {gameMode === "rpg_labyrinth" && <span style={{ color: "#4ade80", fontWeight: "bold" }}>✓ Aktiv</span>}
              </div>
              <span style={{ fontSize: "0.82rem", opacity: 0.88, lineHeight: 1.35 }}>
                Freies 4-Wege-Laufen nach Oben, Unten, Links & Rechts. Trampoline kicken Dino mit Bumper-Rückstoß ab, Sprungtaste macht einen schnellen Dash-Hopser.
              </span>
            </button>
          </div>
        </div>

        {/* 🎨 HINTERGRUND & SPIELWELT */}
        <div className="settings-section">
          <h4>🎨 Hintergrund & Spielwelt</h4>
          <p style={{ margin: "4px 0 10px", fontSize: "0.9rem", color: "#b0b5c5" }}>
            Wähle das Design der Spielwelt (4 Atmosphären verfügbar):
          </p>
          <div className="background-choices-grid">
            {BACKGROUND_THEMES.map((theme) => {
              const isSelected = selectedBg === theme.id;
              return (
                <button
                  key={theme.id}
                  className={`bg-choice-card ${isSelected ? "active" : ""}`}
                  type="button"
                  onClick={() => handleSelectBackground(theme.id)}
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

        {/* AUDIO & MUSIK */}
        <div className="settings-section">
          <h4>🎵 Audio, Musik & Sprache</h4>
          <div className="setting-row">
            <div>
              <strong>Dino-Hintergrundmusik</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>Startet direkt beim Laden der App</small>
            </div>
            <button
              className={`button ${musicOn ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleMusic}
            >
              {musicOn ? "🎵 Musik: AN" : "🔇 Musik: AUS"}
            </button>
          </div>

          <div className="setting-row" style={{ marginTop: "10px" }}>
            <div>
              <strong>Soundeffekte (Sprünge, Eier, Aktionen)</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>Taste M schaltet den Gesamtton stumm</small>
            </div>
            <button
              className={`button ${muted ? "button-secondary" : "button-primary"}`}
              type="button"
              onClick={handleToggleSound}
            >
              {muted ? "Ton: AUS (Stumm)" : "Ton: AN"}
            </button>
          </div>

          <div className="setting-row" style={{ marginTop: "10px" }}>
            <div>
              <strong>Vorleser (Sprachausgabe / Erzähler)</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>
                Liest Level-Titel und witzige Kommentare vor (Standard: AUS)
              </small>
            </div>
            <button
              className={`button ${narratorOn ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleNarrator}
            >
              {narratorOn ? "🗣️ Vorleser: AN" : "🗣️ Vorleser: AUS"}
            </button>
          </div>
        </div>

        {/* START & ZIEL PLATZIERUNG */}
        <div className="settings-section">
          <h4>🚩🏁 Start & Ziel Modus</h4>
          <p style={{ margin: "4px 0 12px", fontSize: "0.9rem", color: "#b0b5c5" }}>
            Bestimme, wie Startpunkt und Zieltor im Spiel gesetzt werden:
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className={`button ${spawnMode === "manual" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => handleToggleSpawnMode("manual")}
              style={{ flex: 1, minWidth: "180px", textAlign: "left", padding: "10px 14px" }}
            >
              <strong>✍️ Manuell (S & Z)</strong>
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.9, marginTop: "2px" }}>
                Startet bei 🚩 S und endet bei 🏁 Z (im Editor markierbar)
              </span>
            </button>
            <button
              className={`button ${spawnMode === "auto" ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={() => handleToggleSpawnMode("auto")}
              style={{ flex: 1, minWidth: "180px", textAlign: "left", padding: "10px 14px" }}
            >
              <strong>🎲 Zufall / Automatisch</strong>
              <span style={{ display: "block", fontSize: "0.8rem", opacity: 0.9, marginTop: "2px" }}>
                Platziert Dino und Ziel automatisch auf sicheren Plattformen
              </span>
            </button>
          </div>
        </div>

        {/* STEUERUNG */}
        <div className="settings-section">
          <h4>🕹️ Steuerung</h4>
          <table className="controls-table">
            <thead>
              <tr>
                <th>Aktion</th>
                <th>Tastatur</th>
                <th>Xbox / Bluetooth Controller</th>
                <th>Touch</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bewegung ({gameMode === "rpg_labyrinth" ? "4 Richtungen" : "Links/Rechts"})</td>
                <td>
                  {gameMode === "rpg_labyrinth" ? (
                    <>
                      <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>▲</kbd> <kbd>▼</kbd> <kbd>◀</kbd> <kbd>▶</kbd>
                    </>
                  ) : (
                    <>
                      <kbd>A</kbd> / <kbd>D</kbd> oder <kbd>◀</kbd> <kbd>▶</kbd>
                    </>
                  )}
                </td>
                <td>Linker Stick / 4-Wege-Steuerkreuz</td>
                <td>Touch D-Pad Pfeile</td>
              </tr>
              <tr>
                <td>
                  {gameMode === "rpg_labyrinth" ? "Ausweichen / Dash" : "Sprung (Doppelsprung auf 🌋)"}
                </td>
                <td><kbd>Leertaste</kbd> {gameMode !== "rpg_labyrinth" && "/ W"}</td>
                <td><kbd>A</kbd>-Taste</td>
                <td>Aktionstaste rechts</td>
              </tr>
              <tr>
                <td>Pause</td>
                <td><kbd>Escape</kbd></td>
                <td><kbd>Start</kbd>-Taste</td>
                <td>Pause-Taste oben</td>
              </tr>
              <tr>
                <td>Level neustarten</td>
                <td><kbd>R</kbd></td>
                <td><kbd>Y</kbd>-Taste</td>
                <td>Neustart nach Tod</td>
              </tr>
              <tr>
                <td>Ton stummschalten</td>
                <td><kbd>M</kbd></td>
                <td>–</td>
                <td>Im Pausemenü</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CONTROLLER STATUS */}
        <div className="settings-section">
          <h4>🎮 Angeschlossene Controller</h4>
          {gamepads.length === 0 ? (
            <p style={{ margin: "4px 0", fontSize: "0.9rem", color: "#a0a5b5" }}>
              Kein Controller erkannt. Schließe einen Xbox, PlayStation oder Bluetooth Controller an und drücke eine Taste!
            </p>
          ) : (
            <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
              {gamepads.map((name, i) => (
                <li key={i} style={{ color: "#4ade80", fontSize: "0.9rem" }}>
                  ✓ {name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* SPEICHERSTATUS & OFFLINE-DATEN */}
        <div className="settings-section">
          <h4>💾 Offline-Speicher (IndexedDB)</h4>
          <p style={{ margin: "4px 0 8px", fontSize: "0.9rem", color: "#a0a5b5" }}>
            Alle deine gezeichneten Level werden lokal und offline auf deinem Gerät gespeichert.
          </p>
          <div className="storage-meter-box">
            <div className="storage-meter-bar">
              <div
                className="storage-meter-fill"
                style={{ width: `${Math.max(2, Math.min(100, storageInfo.percentage))}%` }}
              />
            </div>
            <div className="storage-meter-labels">
              <span>Belegt: {formatMB(storageInfo.usedBytes)}</span>
              <span>Verfügbar: {formatMB(storageInfo.quotaBytes)}</span>
            </div>
          </div>
          {!storageInfo.persisted && (
            <div style={{ marginTop: "12px" }}>
              <button
                className="button button-secondary"
                type="button"
                onClick={handleRequestPersistence}
                disabled={persisting}
              >
                {persisting ? "Sichere Speicher…" : "🛡️ Dauerhaften Speicher anfordern (Browser-Bereinigung verhindern)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
