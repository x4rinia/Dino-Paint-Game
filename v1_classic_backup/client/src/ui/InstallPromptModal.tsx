import React from "react";

interface InstallPromptModalProps {
  onClose: () => void;
  deferredPrompt: any | null;
  onInstallSuccess: () => void;
}

export function InstallPromptModal({ onClose, deferredPrompt, onInstallSuccess }: InstallPromptModalProps) {
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        onInstallSuccess();
        onClose();
      }
    } catch (err) {
      console.warn("Installation abgebrochen:", err);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box install-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>📲 Dino Paint Game installieren</h3>
          <button className="button-close" type="button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-section">
          <div className="install-hero">
            <span className="install-dino-icon">🦖</span>
            <div>
              <strong>Als vollwertige Offline-App installieren</strong>
              <p>
                Spiele und erstelle Level jederzeit komplett ohne Internetverbindung und ohne Browser-Leisten –
                genau wie eine native App aus dem Store!
              </p>
            </div>
          </div>
        </div>

        {deferredPrompt ? (
          <div className="settings-section">
            <p style={{ marginBottom: "16px" }}>
              Klicke auf den Button unten, um die App direkt auf deinem Startbildschirm (Windows, Android, Chromebook) zu installieren:
            </p>
            <button
              className="button button-primary"
              style={{ width: "100%", fontSize: "1.15rem", padding: "14px" }}
              type="button"
              onClick={handleInstallClick}
            >
              🚀 Jetzt installieren
            </button>
          </div>
        ) : isIOS ? (
          <div className="settings-section">
            <h4>Anleitung für iPad & iPhone (Safari):</h4>
            <ol className="ios-install-steps">
              <li>
                Tippe in der Safari-Symbolleiste auf das <strong>Teilen-Symbol</strong>{" "}
                <span className="inline-badge">⎋ / [↑]</span>.
              </li>
              <li>
                Scrolle im Menü etwas nach unten und wähle <strong>„Zum Home-Bildschirm“</strong>{" "}
                <span className="inline-badge">➕</span>.
              </li>
              <li>
                Tippe oben rechts auf <strong>„Hinzufügen“</strong>.
              </li>
            </ol>
            <p className="mobile-info-text" style={{ marginTop: "12px" }}>
              Fertig! Die Dino-App erscheint nun direkt auf deinem iPad- oder iPhone-Startbildschirm und startet ab sofort im echten Vollbildmodus!
            </p>
          </div>
        ) : (
          <div className="settings-section">
            <h4>Installation über das Browser-Menü:</h4>
            <p>
              Öffne das Dreipunkt-Menü deines Browsers (oben rechts in Chrome / Edge) und wähle:
              <br />
              <strong>„App installieren“</strong> oder <strong>„Zu Startbildschirm hinzufügen“</strong>.
            </p>
          </div>
        )}

        <div className="modal-actions">
          <button className="button button-secondary" type="button" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
