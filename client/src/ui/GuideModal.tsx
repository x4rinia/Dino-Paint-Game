import React from "react";

interface GuideModalProps {
  onClose: () => void;
}

export function GuideModal({ onClose }: GuideModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box guide-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto", textAlign: "left" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, fontSize: "28px", color: "#1d1d24" }}>📖 Zeichen-Anleitung & Tipps</h2>
          <button className="button button-secondary" type="button" onClick={onClose} style={{ padding: "6px 14px", fontSize: "18px" }}>
            ✕
          </button>
        </div>

        <p style={{ color: "#555", fontSize: "16px", marginBottom: "20px" }}>
          In <strong>Dino Paint Game</strong> wird jede der <strong>8 magischen Farben</strong> zu einer echten Spielmechanik!
          Hier siehst du genau, wie du die Farben zeichnen musst:
        </p>

        <div className="guide-rules-list" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          
          {/* ORANGE: GEGNER */}
          <div style={{ background: "#fff4e6", borderLeft: "6px solid #e8590c", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#e8590c", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#e8590c" }}>Orange: Bewegliche Gegner</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Zeichne einfach einen <strong>ausgefüllten Klecks oder Kasten</strong> (mind. Fingergröße / ca. 20 Pixel).
              Im Spiel erwacht er zum Leben, patrouilliert hin und her und kann von oben durch Draufspringen besiegt werden!
            </p>
          </div>

          {/* BRAUN: LIFTE */}
          <div style={{ background: "#fbf3eb", borderLeft: "6px solid #8b5a2b", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#8b5a2b", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#8b5a2b" }}>Braun: Schwebende Lifte & Plattformen</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              • <strong>Waagerechter Balken</strong> (breiter als hoch) → Fährt ruhig <strong>links ◄► rechts</strong>.<br />
              • <strong>Senkrechter Balken</strong> (höher als breit) → Fährt ruhig <strong>hoch ▲▼ runter</strong>.<br />
              Dein Dino kann darauf stehen und mitfahren!
            </p>
          </div>

          {/* BLAU: PHYSIKBLÖCKE */}
          <div style={{ background: "#eef5ff", borderLeft: "6px solid #2a6df4", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#2a6df4", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#2a6df4" }}>Blau: Bewegliche Physik-Blöcke</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Zeichne einen soliden Block oder Kasten. Er fällt durch <strong>Schwerkraft</strong> nach unten
              und dein Dino kann ihn <strong>vor sich her schieben</strong> oder darauf klettern!
            </p>
          </div>

          {/* LILA: PORTALE */}
          <div style={{ background: "#f8f0ff", borderLeft: "6px solid #9b51e0", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#9b51e0", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#9b51e0" }}>Lila: Portale & Vortex-Katapulte</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              • <strong>Zwei Portale:</strong> Beamen dich sofort von einem Portal zum anderen!<br />
              • <strong>Nur ein Portal:</strong> Schießt dich wie ein magischer Gravitations-Vortex weit in die Luft!
            </p>
          </div>

          {/* GELB: DINO-EIER */}
          <div style={{ background: "#fffde6", borderLeft: "6px solid #f5c518", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#f5c518", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#b89000" }}>Gelb: Dino-Eier (Sammelobjekte)</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Zeichne kleine Punkte oder Eier. Sammle alle Eier im Level ein, um das Ziel 🏆 freizuschalten!
            </p>
          </div>

          {/* GRÜN: TRAMPOLIN */}
          <div style={{ background: "#edfcf0", borderLeft: "6px solid #2fb457", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#2fb457", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#2fb457" }}>Grün: Trampoline</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Zeichne waagerechte Sprungflächen. Landet dein Dino darauf, wird er federnd hoch in die Luft katapultiert!
            </p>
          </div>

          {/* SCHWARZ & ROT */}
          <div style={{ background: "#f4f4f6", borderLeft: "6px solid #1d1d24", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#1d1d24", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#1d1d24" }}>Schwarz: Feste Plattformen & Rand-Schutz</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Feste Böden und Wände. <strong>Tipp:</strong> Das Spielfeld hat automatisch einen schwarzen Außenrahmen –
              wenn du Linien bis an die Ecken oder den Rand zeichnest, werden sie automatisch zu geschlossenen, soliden Plattformen!
            </p>
          </div>

          <div style={{ background: "#fff0f0", borderLeft: "6px solid #d6453d", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ width: "20px", height: "20px", background: "#d6453d", borderRadius: "4px", display: "inline-block" }} />
              <strong style={{ fontSize: "18px", color: "#d6453d" }}>Rot: Gefahren (Lava & Stacheln)</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Tödliche Fallen. Berühren startet den Versuch von vorne.
            </p>
          </div>

          {/* START & ZIEL S / Z */}
          <div style={{ background: "#f0fdf4", borderLeft: "6px solid #10b981", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "20px" }}>🚩🏁</span>
              <strong style={{ fontSize: "18px", color: "#065f46" }}>Start (S) & Ziel (Z) Marker</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Wähle im Editor einfach <strong>🚩 Start (S)</strong> oder <strong>🏁 Ziel (Z)</strong> und klicke auf deine Zeichnung,
              um Dino und das Zieltor manuell zu platzieren. Setzt du keine Marker, platziert das Spiel beide automatisch sicher auf Plattformen!
            </p>
          </div>

          {/* ZUFALLS-LEVEL */}
          <div style={{ background: "#f5f3ff", borderLeft: "6px solid #6366f1", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "20px" }}>🎲</span>
              <strong style={{ fontSize: "18px", color: "#4338ca" }}>Zufalls-Level Generator</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              Klicke oben auf <strong>🎲 Zufalls-Level</strong>, um dir mit einem Klick eine komplett fertige, abwechslungsreiche
              und spielbare Doodle-Welt mit Plattformen, Liften, Portalen, Trampolinen und Gegnern generieren zu lassen!
            </p>
          </div>

          {/* DOPPELSPRUNG & MUSIK */}
          <div style={{ background: "#eff6ff", borderLeft: "6px solid #3b82f6", padding: "12px 16px", borderRadius: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <span style={{ fontSize: "20px" }}>🦖🎵</span>
              <strong style={{ fontSize: "18px", color: "#1d4ed8" }}>Dino Doppelsprung & Musik</strong>
            </div>
            <p style={{ margin: "4px 0 0", color: "#333", fontSize: "15px" }}>
              • <strong>Doppelsprung:</strong> Drücke in der Luft einfach noch einmal auf Springen (W / Pfeil nach oben / Space / A-Knopf),
              damit Dino einen zweiten Luftsprung ausführt! Ideal für weite Schluchten.<br />
              • <strong>Musik:</strong> Im Spiel läuft echte Dino-Hintergrundmusik. Mit der Taste <strong>M</strong> kannst du den Ton jederzeit stummschalten.
            </p>
          </div>

        </div>

        <div style={{ marginTop: "24px", textAlign: "center" }}>
          <button className="button button-primary" type="button" onClick={onClose} style={{ padding: "12px 28px", fontSize: "18px" }}>
            Verstanden, los geht's! 🦖
          </button>
        </div>
      </div>
    </div>
  );
}
