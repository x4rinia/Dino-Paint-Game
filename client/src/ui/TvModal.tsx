import React from "react";

interface TvModalProps {
  onClose: () => void;
  tvMode: boolean;
  onToggleTvMode: () => void;
}

export function TvModal({ onClose, tvMode, onToggleTvMode }: TvModalProps) {
  const handleToggleFullscreen = async () => {
    onToggleTvMode();
    if (!tvMode) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box tv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>📺 Fernseher-Modus & Bildübertragung</h3>
          <button className="button-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <h4>🛋️ Was ist der TV-Modus?</h4>
          <p className="tv-intro-text">
            Der TV-Modus maximiert das Spielfeld auf die volle Bildschirmgröße, vergrößert die HUD-Anzeigen
            (Münzen, Dino-Eier, Zähler) für bequemes Ablesen aus mehreren Metern Entfernung und blendet
            störende Touch-Overlays aus, sobald ein Controller verwendet wird.
          </p>

          <div className="setting-row" style={{ marginTop: "16px" }}>
            <span>TV-Optimierung:</span>
            <button
              className={`button ${tvMode ? "button-primary" : "button-secondary"}`}
              type="button"
              onClick={handleToggleFullscreen}
            >
              {tvMode ? "✓ TV-Modus AKTIV (Großes HUD)" : "TV-Modus aktivieren"}
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h4>📡 Bildschirm auf den TV übertragen</h4>
          <div className="tv-guide-cards">
            <div className="tv-guide-item">
              <span className="tv-guide-icon">🍎</span>
              <div>
                <strong>Apple AirPlay (iPad & iPhone)</strong>
                <p>
                  Auf dem iPad/iPhone von oben rechts nach unten wischen, um das Kontrollzentrum zu öffnen.
                  Tippe auf <em>„Bildschirmsynchronisierung“</em> und wähle deinen Apple TV oder AirPlay-fähigen Fernseher.
                </p>
              </div>
            </div>

            <div className="tv-guide-item">
              <span className="tv-guide-icon">🤖</span>
              <div>
                <strong>Android Screen Mirroring (Smart View / Cast)</strong>
                <p>
                  Ziehe die Schnelleinstellungen von oben herunter. Tippe auf <em>„Smart View“</em> (Samsung)
                  oder <em>„Bildschirm übertragen“</em> (Google Pixel / Xiaomi) und wähle deinen Smart TV.
                </p>
              </div>
            </div>

            <div className="tv-guide-item">
              <span className="tv-guide-icon">🔌</span>
              <div>
                <strong>HDMI / USB-C Kabel (Verzögerungsfrei)</strong>
                <p>
                  Verbinde Laptop, PC oder Tablet mit einem USB-C-auf-HDMI-Kabel direkt mit dem Fernseher.
                  Bietet die absolut geringste Latenz für präzise Sprünge!
                </p>
              </div>
            </div>

            <div className="tv-guide-item">
              <span className="tv-guide-icon">🎮</span>
              <div>
                <strong>Kabelloser Controller</strong>
                <p>
                  Kopple einen Xbox-, PlayStation- oder Nintendo Switch Pro Controller per Bluetooth direkt mit deinem Tablet, Smartphone oder PC.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="info-callout">
          <strong>Tipp fürs Querformat:</strong> Fixiere die automatische Bildschirmdrehung deines Tablets oder Handys
          im <em>Querformat (Landscape)</em>, damit das Spiel das gesamte Fernsehbild optimal ausfüllt.
        </div>

        <div className="modal-actions">
          <button className="button button-primary" type="button" onClick={onClose}>
            Verstanden & Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
