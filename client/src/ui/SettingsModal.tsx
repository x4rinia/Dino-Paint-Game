import React, { useEffect, useState } from "react";
import { isMuted, toggleMute, isMusicEnabled, setMusicEnabled } from "../game/audio";
import { narrator } from "../game/narrator";
import { getStorageQuota, requestPersistentStorage, getSetting, setSetting } from "../storage/db";
import { BACKGROUND_THEMES, type BackgroundTheme } from "../game/paper";

interface SettingsModalProps {
  onClose: () => void;
  currentBackground?: BackgroundTheme;
  onBackgroundChange?: (bg: BackgroundTheme) => void;
}

export function SettingsModal({ onClose, currentBackground, onBackgroundChange }: SettingsModalProps) {
  const [muted, setMuted] = useState(isMuted());
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  const [narratorOn, setNarratorOn] = useState(narrator.isEnabled());
  const [spawnMode, setSpawnMode] = useState<"manual" | "auto">("manual");
  const [selectedBg, setSelectedBg] = useState<BackgroundTheme>(currentBackground || "paper");
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

        {/* AUDIO & MUSIK */}
        <div className="settings-section">
          <h4>🎵 Audio, Musik & Sprache</h4>
          <div className="setting-row">
            <div>
              <strong>Dino-Hintergrundmusik</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>Fröhliche Hintergrundmusik im Spiel</small>
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

        {/* 🎨 HINTERGRUND & SPIELWELT */}
        <div className="settings-section">
          <h4>🎨 Hintergrund & Spielwelt</h4>
          <p style={{ margin: "4px 0 12px", fontSize: "0.9rem", color: "#b0b5c5" }}>
            Wähle das Design der Spielwelt für alle Level aus (3 verschiedene Welten verfügbar):
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
          <h4>🕹️ Steuerung & Doppelsprung</h4>
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
                <td>Laufen (Links / Rechts)</td>
                <td><kbd>A</kbd> / <kbd>D</kbd> oder <kbd>◀</kbd> <kbd>▶</kbd></td>
                <td>Linker Stick / Steuerkreuz</td>
                <td>Touch-Pfeile</td>
              </tr>
              <tr>
                <td>Springen & <strong>Doppelsprung</strong></td>
                <td><kbd>Leertaste</kbd> / <kbd>W</kbd> (2x drücken)</td>
                <td><kbd>A</kbd>-Taste (2x drücken)</td>
                <td>Sprungtaste (2x)</td>
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
          <h4>🎮 Controller-Status</h4>
          {gamepads.length === 0 ? (
            <div className="gamepad-status-empty">
              <span>Kein Controller erkannt.</span>
              <small>
                Verbinde einen Xbox-, PlayStation- oder Bluetooth-Controller und drücke eine beliebige Taste.
              </small>
            </div>
          ) : (
            <div className="gamepad-status-list">
              {gamepads.map((name, idx) => (
                <div key={idx} className="gamepad-item active">
                  <span className="gamepad-icon">🎮</span>
                  <div>
                    <strong>Controller verbunden</strong>
                    <div className="gamepad-name">{name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SPIELSTÄNDE & SPEICHER */}
        <div className="settings-section">
          <h4>💾 Spielstände & Speicher</h4>
          <div className="storage-status-card">
            <div className="setting-row">
              <span>Speicher-Status:</span>
              <span className={`status-pill ${storageInfo.persisted ? "pill-success" : "pill-warning"}`}>
                {storageInfo.persisted ? "✓ Dauerhaft gesichert" : "Standard"}
              </span>
            </div>
            {storageInfo.quotaBytes > 0 && (
              <div className="storage-meter">
                <div className="meter-label">
                  <span>Belegter Speicher: {formatMB(storageInfo.usedBytes)}</span>
                  <span>Verfügbar: {formatMB(storageInfo.quotaBytes)}</span>
                </div>
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{ width: `${Math.max(2, Math.min(100, storageInfo.percentage))}%` }}
                  />
                </div>
              </div>
            )}
            {!storageInfo.persisted && (
              <button
                className="button button-secondary-small"
                style={{ marginTop: "10px" }}
                type="button"
                onClick={handleRequestPersistence}
                disabled={persisting}
              >
                {persisting ? "Wird gesichert…" : "🛡️ Dauerhaften Speicher anfordern"}
              </button>
            )}
          </div>
        </div>

        {/* ℹ️ INFO & CREDITS */}
        <div className="settings-section" style={{ background: "rgba(255, 255, 255, 0.04)", padding: "16px", borderRadius: "10px", textAlign: "center", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#3cb371", fontSize: "1.2rem" }}>🦖 Dino Paint Game</h4>
          <p style={{ margin: "4px 0", fontSize: "1.05rem", color: "#ffffff", fontWeight: 600 }}>
            by <strong>X4rinia</strong> und <strong>Dino</strong>
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#9ca3af" }}>
            Version 2.2
          </p>
        </div>

        <div className="modal-actions" style={{ marginTop: "20px" }}>
          <button className="button button-primary" type="button" onClick={onClose} style={{ padding: "10px 28px", fontSize: "1.05rem" }}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
