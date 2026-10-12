import React from "react";

interface TvModalProps {
  onClose: () => void;
  tvMode: boolean;
  onToggleTvMode: () => void;
}

export function TvModal({ onClose, tvMode, onToggleTvMode }: TvModalProps) {
  const handleToggleFullscreen = async () => {
    const next = !tvMode;
    onToggleTvMode();
    if (next) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    } else {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {}
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box tv-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "88vh", overflowY: "auto" }}
      >
        <div className="settings-header">
          <h3>📡 Streaming- & Fernseher-Menü</h3>
          <button className="button-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <h4>🛋️ TV-Modus & Großbild-Ansicht</h4>
          <p className="tv-intro-text">
            Maximiert das Spielfeld auf die volle Bildschirmgröße, vergrößert alle HUD-Anzeigen
            und optimiert Steuerung & Schrift für Wohnzimmer-Fernseher und Beamer.
          </p>

          <div className="setting-row" style={{ marginTop: "14px" }}>
            <span>TV-Optimierung:</span>
            <button
              className={`button ${tvMode ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleFullscreen}
            >
              {tvMode ? "✓ TV-Modus AKTIV (Großes HUD)" : "📺 TV-Modus aktivieren"}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h4>🎥 Live-Stream (OBS Studio, Twitch, YouTube & Discord)</h4>
          <div className="tv-guide-cards">
            <div className="tv-guide-item">
              <span className="tv-guide-icon">🎙️</span>
              <div>
                <strong>OBS Studio / Streamlabs</strong>
                <p>
                  Füge in OBS eine neue <em>„Fensteraufnahme“ (Window Capture)</em> hinzu und wähle deinen Browser aus.
                  Nutze den TV-Modus für ein sauberes, randloses Bild ohne störende Menüleisten!
                </p>
              </div>
            </div>

            <div className="tv-guide-item">
              <span className="tv-guide-icon">🎮</span>
              <div>
                <strong>Discord Bildschirmübertragung</strong>
                <p>
                  Teile direkt das Spielfenster in deinem Discord-Voice-Channel, damit Freunde deine gezeichneten Level live miterleben können.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h4>📡 Drahtlos auf den Smart TV übertragen</h4>
          <div className="tv-guide-cards">
            <div className="tv-guide-item">
              <span className="tv-guide-icon">🍎</span>
              <div>
                <strong>Apple AirPlay (iPad & iPhone)</strong>
                <p>
                  Kontrollzentrum öffnen (von oben rechts wischen) ➔ <em>„Bildschirmsynchronisierung“</em> ➔ Apple TV / Smart TV wählen.
                </p>
              </div>
            </div>

            <div className="tv-guide-item">
              <span className="tv-guide-icon">🤖</span>
              <div>
                <strong>Android Screen Mirroring (Smart View / Cast)</strong>
                <p>
                  Schnelleinstellungen herunterziehen ➔ <em>„Smart View“</em> oder <em>„Bildschirm übertragen“</em> ➔ TV auswählen.
                </p>
              </div>
            </div>

            <div className="tv-guide-item">
              <span className="tv-guide-icon">🔌</span>
              <div>
                <strong>HDMI-Kabel (Verzögerungsfrei)</strong>
                <p>
                  Laptop oder iPad mit HDMI-Kabel verbinden für 0 ms Latenz bei anspruchsvollen Sprungpassagen.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="info-callout">
          <strong>Tipp für Controller:</strong> Kopple einfach einen Bluetooth-Controller (PlayStation, Xbox oder Switch Pro) mit deinem Gerät, um wie auf einer Konsole zu spielen!
        </div>

        <div className="modal-actions">
          <button className="button button-primary" type="button" onClick={onClose}>
            ✓ Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
