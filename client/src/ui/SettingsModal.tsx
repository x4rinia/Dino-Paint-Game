import React, { useEffect, useState } from "react";
import { isMuted, toggleMute, isMusicEnabled, setMusicEnabled } from "../game/audio";
import { narrator } from "../game/narrator";
import { getStorageQuota, requestPersistentStorage, getSetting, setSetting } from "../storage/db";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [muted, setMuted] = useState(isMuted());
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  const [narratorOn, setNarratorOn] = useState(narrator.isEnabled());
  const [spawnMode, setSpawnMode] = useState<"manual" | "auto">("manual");
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
          <h3>⚙️ Einstellungen</h3>
          <button className="button-close" type="button" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
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

          <div className="setting-row">
            <div>
              <strong>Soundeffekte (SFX)</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>Sprünge, Münzen, Teleporter & Bumper</small>
            </div>
            <button
              className={`button ${!muted ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleSound}
            >
              {!muted ? "🔊 Ton: AN" : "🔇 Stumm"}
            </button>
          </div>

          <div className="setting-row">
            <div>
              <strong>Audio-Vorleser / Erzähler</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>Liest Spieltipps & Aktionen vor</small>
            </div>
            <button
              className={`button ${narratorOn ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleNarrator}
            >
              {narratorOn ? "🗣️ Sprache: AN" : "🔇 Sprache: AUS"}
            </button>
          </div>
        </div>

        {/* START- & ZIELPUNKT SPAWN */}
        <div className="settings-section">
          <h4>🚩 Start- & Zielpunkt Platzierung</h4>
          <div className="setting-row">
            <div>
              <strong>Modus für Start & Ziel</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>
                {spawnMode === "manual"
                  ? "Manuell: Nutze die Start- (S) und Ziel- (Z) Werkzeuge im Editor"
                  : "Automatisch: Start links, Ziel rechts"}
              </small>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className={`button ${spawnMode === "manual" ? "button-primary" : "button-secondary"}`}
                type="button"
                onClick={() => handleToggleSpawnMode("manual")}
              >
                🚩 Manuell
              </button>
              <button
                className={`button ${spawnMode === "auto" ? "button-primary" : "button-secondary"}`}
                type="button"
                onClick={() => handleToggleSpawnMode("auto")}
              >
                ⚙️ Auto
              </button>
            </div>
          </div>
        </div>

        {/* CONTROLLER & GAMEPAD */}
        <div className="settings-section">
          <h4>🎮 Gamepads & Controller</h4>
          {gamepads.length > 0 ? (
            <ul style={{ margin: "4px 0 0", paddingLeft: "20px", color: "#4ade80" }}>
              {gamepads.map((gp, i) => (
                <li key={i}>
                  ✓ <strong>{gp}</strong> verbunden
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: "4px 0 0", color: "#a0a5b5", fontSize: "0.9rem" }}>
              Kein Gamepad angeschlossen. Schließe einen Xbox-, PlayStation- oder USB-Controller an und drücke eine Taste!
            </p>
          )}
        </div>

        {/* SPEICHERPLATZ & OFFLINE-PWA */}
        <div className="settings-section">
          <h4>💾 Offline-Speicher (PWA)</h4>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span>Belegt: <strong>{formatMB(storageInfo.usedBytes)}</strong> von {formatMB(storageInfo.quotaBytes)}</span>
            <span style={{ color: storageInfo.persisted ? "#4ade80" : "#ffc107" }}>
              {storageInfo.persisted ? "✓ Dauerhafter Speicher aktiv" : "⚠️ Temporärer Speicher"}
            </span>
          </div>

          {!storageInfo.persisted && (
            <button
              className="button button-secondary"
              type="button"
              style={{ width: "100%", marginTop: "6px" }}
              disabled={persisting}
              onClick={handleRequestPersistence}
            >
              {persisting ? "Speicher wird gesichert..." : "🔒 Dauerhaften Speicher anfordern"}
            </button>
          )}
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
          <button className="button button-secondary" type="button" onClick={onClose}>
            ✕ Abbrechen
          </button>
          <button className="button button-primary" type="button" onClick={onClose}>
            ✓ OK / Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
