import React, { useEffect, useState } from "react";
import { isMuted, toggleMute } from "../game/audio";
import { getStorageQuota, requestPersistentStorage } from "../storage/db";

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [muted, setMuted] = useState(isMuted());
  const [gamepads, setGamepads] = useState<string[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number;
    quotaBytes: number;
    percentage: number;
    persisted: boolean;
  }>({ usedBytes: 0, quotaBytes: 0, percentage: 0, persisted: false });
  const [persisting, setPersisting] = useState(false);

  useEffect(() => {
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
          <h3>⚙️ Einstellungen & Steuerung</h3>
          <button className="button-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <h4>🔊 Audio & Sound</h4>
          <div className="setting-row">
            <span>Soundeffekte & Musik</span>
            <button
              className={`button ${muted ? "button-secondary" : "button-primary"}`}
              type="button"
              onClick={handleToggleSound}
            >
              {muted ? "Ton: AUS (Stumm)" : "Ton: AN"}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h4>💾 Offline-Speicher (IndexedDB)</h4>
          <div className="storage-status-card">
            <div className="setting-row">
              <span>Speicher-Status:</span>
              <span className={`status-pill ${storageInfo.persisted ? "pill-success" : "pill-warning"}`}>
                {storageInfo.persisted ? "✓ Dauerhaft gesichert" : "Standard (flüchtig)"}
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
                {persisting ? "Wird angefordert…" : "🛡️ Dauerhaften Speicher anfordern"}
              </button>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h4>🎮 Controller & Gamepad-Status</h4>
          {gamepads.length === 0 ? (
            <div className="gamepad-status-empty">
              <span>Kein Gamepad erkannt.</span>
              <small>
                Verbinde einen Xbox-, PlayStation- oder Bluetooth-Controller und drücke eine beliebige Taste auf dem Controller.
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
          <div className="info-callout" style={{ marginTop: "10px" }}>
            <strong>Browser-Besonderheit bei Controllern:</strong>
            <br />
            Unter iPadOS, iOS Safari und Google Chrome erkennt der Browser ein Bluetooth-Gamepad erst in dem Moment,
            in dem du <strong>mindestens eine Taste</strong> auf dem Controller drückst (Sicherheitsrichtlinie des Browsers).
          </div>
        </div>

        <div className="settings-section">
          <h4>🕹️ Tastenbelegung</h4>
          <table className="controls-table">
            <thead>
              <tr>
                <th>Aktion</th>
                <th>Tastatur</th>
                <th>Xbox / Bluetooth Controller</th>
                <th>Touch (Smartphone/Tablet)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Laufen (Links / Rechts)</td>
                <td><kbd>A</kbd> / <kbd>D</kbd> oder <kbd>◀</kbd> <kbd>▶</kbd></td>
                <td>Linker Stick / Steuerkreuz</td>
                <td>Touch-Pfeile links</td>
              </tr>
              <tr>
                <td>Springen</td>
                <td><kbd>Leertaste</kbd> oder <kbd>W</kbd> / <kbd>▲</kbd></td>
                <td><kbd>A</kbd>-Taste oder <kbd>▲</kbd></td>
                <td>Sprungtaste rechts</td>
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
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button className="button button-primary" type="button" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
