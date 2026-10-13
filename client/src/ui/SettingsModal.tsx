import React, { useEffect, useState } from "react";
import { isMuted, toggleMute, isMusicEnabled, setMusicEnabled } from "../game/audio";
import { getStorageQuota, requestPersistentStorage, getSetting, setSetting } from "../storage/db";

interface SettingsModalProps {
  onClose: () => void;
  tvMode?: boolean;
  onToggleTvMode?: () => void;
  onOpenStreamModal?: () => void;
  gamepadSwapAB?: boolean;
  onToggleGamepadSwapAB?: (swapped: boolean) => void;
}

export function SettingsModal({
  onClose,
  tvMode = false,
  onToggleTvMode,
  gamepadSwapAB = false,
  onToggleGamepadSwapAB,
}: SettingsModalProps) {
  const [muted, setMuted] = useState(isMuted());
  const [musicOn, setMusicOn] = useState(isMusicEnabled());
  const [swapAB, setSwapAB] = useState(gamepadSwapAB);
  const [gamepads, setGamepads] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [showStreamingHelp, setShowStreamingHelp] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number;
    quotaBytes: number;
    percentage: number;
    persisted: boolean;
  }>({ usedBytes: 0, quotaBytes: 0, percentage: 0, persisted: false });
  const [persisting, setPersisting] = useState(false);

  const [tooltipsOn, setTooltipsOn] = useState(true);

  useEffect(() => {
    // Einstellungen aus Speicher laden
    getSetting<boolean>("music_enabled", true).then((enabled) => {
      setMusicOn(enabled);
      setMusicEnabled(enabled);
    });
    getSetting<boolean>("gamepad_swap_ab", false).then((swapped) => {
      setSwapAB(swapped);
    });
    getSetting<boolean>("tooltips_enabled", true).then(setTooltipsOn);

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

    const checkFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", checkFs);

    // Speicherplatz prüfen
    getStorageQuota().then(setStorageInfo);

    return () => {
      window.removeEventListener("gamepadconnected", updateGamepads);
      window.removeEventListener("gamepaddisconnected", updateGamepads);
      document.removeEventListener("fullscreenchange", checkFs);
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

  const handleToggleSwapAB = () => {
    const next = !swapAB;
    setSwapAB(next);
    void setSetting("gamepad_swap_ab", next);
    onToggleGamepadSwapAB?.(next);
  };

  const handleToggleTooltips = () => {
    const next = !tooltipsOn;
    setTooltipsOn(next);
    void setSetting("tooltips_enabled", next);
  };

  const handleToggleTv = async () => {
    const nextVal = !tvMode;
    if (onToggleTvMode) {
      onToggleTvMode();
    }
    // Vollbild steuern
    if (nextVal) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen nicht verfügbar:", err);
      }
    } else {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch (err) {
        console.warn("Exit fullscreen fehlgeschlagen:", err);
      }
    }
  };

  const handleExitFullscreenOnly = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {}
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
      <div
        className="modal-box settings-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "88vh",
          overflowY: "auto",
          width: "92vw",
          maxWidth: "680px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
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
              <small style={{ display: "block", color: "#a0a5b5" }}>Fröhliche Dschungel-Melodie</small>
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
              <strong>Farb-Tooltips im Zeichenstudio</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>
                Erklärungs-Texte beim Bewegen der Maus über die Spielfarben
              </small>
            </div>
            <button
              className={`button ${tooltipsOn ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleTooltips}
            >
              {tooltipsOn ? "✓ Tooltips: AN" : "✕ Tooltips: AUS"}
            </button>
          </div>
        </div>

        {/* TV-MODUS & STREAMING */}
        <div className="settings-section">
          <h4>📺 Fernseher & Live-Streaming</h4>
          <p style={{ margin: "4px 0 10px", fontSize: "0.9rem", color: "#a0a5b5" }}>
            Maximales Vollbild ohne störende Leisten und vergrößerte Anzeigen für Fernseher & Beamer.
          </p>

          <div className="setting-row">
            <div>
              <strong>TV-Modus (Großbild-Optimierung)</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>
                {tvMode ? "✓ Aktiviert (große Anzeigen & Vollbild)" : "Standard-Ansicht"}
              </small>
            </div>
            <button
              className={`button ${tvMode ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleTv}
            >
              {tvMode ? "✓ TV-Modus: AN (Deaktivieren)" : "📺 TV-Modus aktivieren"}
            </button>
          </div>

          {isFullscreen && (
            <div className="setting-row" style={{ marginTop: "8px" }}>
              <div>
                <strong>Vollbild aktiv</strong>
                <small style={{ display: "block", color: "#a0a5b5" }}>Browserfenster ist im Vollbildmodus</small>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={handleExitFullscreenOnly}
              >
                🖥️ Vollbild beenden (Esc)
              </button>
            </div>
          )}

          <div style={{ marginTop: "12px" }}>
            <button
              className="button button-secondary"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setShowStreamingHelp(!showStreamingHelp)}
            >
              {showStreamingHelp ? "▲ Streaming-Anleitungen verbergen" : "📡 Streaming-Anleitungen anzeigen (OBS, Discord, AirPlay, HDMI)"}
            </button>
          </div>

          {showStreamingHelp && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.4rem" }}>🎙️</span>
                <div>
                  <strong>OBS Studio / Streamlabs:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "#cbd5e1" }}>
                    Füge in OBS eine <em>Fensteraufnahme (Window Capture)</em> hinzu und wähle deinen Browser. Nutze den TV-Modus für ein sauberes, randloses Bild!
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.4rem" }}>🎮</span>
                <div>
                  <strong>Discord Bildschirmübertragung:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "#cbd5e1" }}>
                    Teile direkt das Spielfenster in deinem Voice-Channel, damit Freunde live zuschauen können.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.4rem" }}>🍎</span>
                <div>
                  <strong>Apple AirPlay (iPad & Mac):</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "#cbd5e1" }}>
                    Kontrollzentrum öffnen ➔ <em>Bildschirmsynchronisierung</em> ➔ Smart TV / Apple TV auswählen.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.4rem" }}>🤖</span>
                <div>
                  <strong>Android Smart View / Cast:</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "#cbd5e1" }}>
                    Schnelleinstellungen herunterziehen ➔ <em>Smart View</em> oder <em>Übertragen</em> ➔ TV wählen.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.4rem" }}>🔌</span>
                <div>
                  <strong>HDMI-Kabel (Direkt & Verzögerungsfrei):</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "0.88rem", color: "#cbd5e1" }}>
                    Laptop oder Tablet mit HDMI-Kabel verbinden für 0 ms Latenz.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLLER & GAMEPAD */}
        <div className="settings-section">
          <h4>🎮 Controller- & Gamepad-Hilfe</h4>
          {gamepads.length > 0 ? (
            <div style={{ padding: "8px 12px", background: "rgba(74, 222, 128, 0.15)", borderRadius: "6px", marginBottom: "10px", borderLeft: "4px solid #4ade80" }}>
              <strong style={{ color: "#4ade80" }}>Verbunden:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: "20px", color: "#e2e8f0" }}>
                {gamepads.map((gp, i) => (
                  <li key={i}>{gp}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p style={{ margin: "0 0 10px", color: "#a0a5b5", fontSize: "0.9rem" }}>
              💡 Verbinde einen Bluetooth- oder USB-Controller (Xbox, PlayStation, Switch Pro) und drücke eine beliebige Taste zum automatischen Verbinden!
            </p>
          )}

          {/* A & B Tasten-Tausch Option */}
          <div className="setting-row" style={{ marginBottom: "12px", background: "rgba(255,255,255,0.04)", padding: "10px", borderRadius: "8px" }}>
            <div>
              <strong>A- & B-Tastenbelegung (Layout)</strong>
              <small style={{ display: "block", color: "#a0a5b5" }}>
                {swapAB
                  ? "🔄 Nintendo-Layout: B = Springen/Bestätigen, A = Zurück"
                  : "🎮 Xbox / PlayStation: A = Springen/Bestätigen, B = Zurück"}
              </small>
            </div>
            <button
              className={`button ${swapAB ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleSwapAB}
            >
              {swapAB ? "🔄 A & B getauscht (Nintendo)" : "🎮 Standard (Xbox / PS)"}
            </button>
          </div>

          {/* Tastenbelegungs-Tabelle */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px", fontSize: "0.88rem" }}>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: "6px" }}>
              <strong>🕹️ D-Pad / Linker Stick:</strong>
              <div style={{ color: "#94a3b8" }}>Laufen & Menü-Navigation</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: "6px" }}>
              <strong>{swapAB ? "🅱️ / ⭕ B-Taste / Kreis:" : "🅰️ / ✖️ A-Taste / Kreuz:"}</strong>
              <div style={{ color: "#4ade80", fontWeight: 600 }}>Springen / Bestätigen</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: "6px" }}>
              <strong>{swapAB ? "🅰️ / ✖️ A-Taste / Kreuz:" : "🅱️ / ⭕ B-Taste / Kreis:"}</strong>
              <div style={{ color: "#fca5a5" }}>Zurück / Abbrechen</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: "6px" }}>
              <strong>🔥 X- / Y-Taste (X / F / Taste 2 & 3):</strong>
              <div style={{ color: "#fb923c", fontWeight: 600 }}>Feuerball spucken!</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", padding: "8px 12px", borderRadius: "6px" }}>
              <strong>⏸️ Start / Menü:</strong>
              <div style={{ color: "#94a3b8" }}>Pause & Einstellungen</div>
            </div>
          </div>
        </div>

        {/* SPEICHERPLATZ & OFFLINE-BETRIEB */}
        <div className="settings-section">
          <h4>💾 Lokaler Gerätespeicher & Offline-Betrieb</h4>
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

        {/* APP INFO & CREDITS */}
        <div
          className="settings-section"
          style={{
            textAlign: "center",
            padding: "12px 16px",
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "10px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "0.88rem",
            color: "#94a3b8",
            marginTop: "8px",
          }}
        >
          <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: "1.02rem", marginBottom: "3px" }}>
            🦖 Dino Paint Game
          </div>
          <div>Version 2.7 • by X4rinia & Dino</div>
          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "3px" }}>
            Zeichnen. Welten bauen. Spielen!
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div
          className="settings-footer"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "10px",
            paddingTop: "14px",
            borderTop: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <button className="button button-primary" type="button" onClick={onClose}>
            ✓ Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
