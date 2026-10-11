import React, { useEffect, useRef, useState } from "react";
import { analyzeDrawing, type Level } from "@sketchquest/shared";
import { GuideModal } from "./GuideModal";

interface PhotoCaptureProps {
  onPlayLevel: (level: Level, drawingDataUrl: string) => void;
  onBackToMenu: () => void;
}

export function PhotoCapture({ onPlayLevel, onBackToMenu }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [analyzedLevel, setAnalyzedLevel] = useState<Level | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showHttpsHint, setShowHttpsHint] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Start- und Zielpositionen anpassbar
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 60, y: 880 });
  const [goalPos, setGoalPos] = useState<{ x: number; y: number }>({ x: 920, y: 580 });
  const [dragMode, setDragMode] = useState<"none" | "start" | "goal">("none");

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setErrorMessage(null);
    setShowHttpsHint(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fehlender sicherer Kontext (z.B. HTTP auf Smartphone)
      setShowHttpsHint(true);
      setErrorMessage("Kamera-Zugriff im Browser ist nur über HTTPS oder localhost erlaubt. Bitte Foto über Datei-Upload wählen!");
      fileInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Kamera konnte nicht gestartet werden:", err);
      setShowHttpsHint(true);
      setErrorMessage("Kamera konnte nicht geöffnet werden. Nutze den Foto-Upload!");
      fileInputRef.current?.click();
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    stopCamera();
    processImage(dataUrl, rotation);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      processImage(dataUrl, 0);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const processImage = (imgSrc: string, rotAngle: number) => {
    setCapturedImage(imgSrc);
    setRotation(rotAngle);
    setAnalyzing(true);
    setErrorMessage(null);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      // Bei 90° oder 270° vertauschte Dimensionen
      const isSwapped = rotAngle === 90 || rotAngle === 270;
      canvas.width = isSwapped ? img.height : img.width;
      canvas.height = isSwapped ? img.width : img.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setAnalyzing(false);
        return;
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotAngle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      const rotatedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(rotatedDataUrl);

      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = analyzeDrawing(imgData, {
          name: "Foto-Level",
          gridWidth: 320,
          gridHeight: 180,
        });

        const level = result.level;
        (level as any).originalImage = rotatedDataUrl;

        setAnalyzedLevel(level);
        setStartPos(level.start);
        setGoalPos({ x: level.goal.x, y: level.goal.y });
      } catch (err) {
        setErrorMessage("Bild konnte nicht analysiert werden: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setAnalyzing(false);
      }
    };
    img.src = imgSrc;
  };

  const rotatePhoto = () => {
    if (!capturedImage) return;
    const newRotation = (rotation + 90) % 360;
    processImage(capturedImage, 90);
  };

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode === "none") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const ny = Math.round(((e.clientY - rect.top) / rect.height) * 1000);

    if (dragMode === "start") {
      setStartPos({ x: nx, y: ny });
      setDragMode("none");
    } else if (dragMode === "goal") {
      setGoalPos({ x: nx, y: ny });
      setDragMode("none");
    }
  };

  const startGame = () => {
    if (!analyzedLevel || !capturedImage) return;

    const finalLevel: Level = {
      ...analyzedLevel,
      start: startPos,
      goal: {
        ...analyzedLevel.goal,
        x: goalPos.x,
        y: goalPos.y,
      },
    };
    (finalLevel as any).originalImage = capturedImage;

    onPlayLevel(finalLevel, capturedImage);
  };

  return (
    <div className="photo-capture-page">
      <header className="studio-header">
        <button className="button button-secondary" type="button" onClick={onBackToMenu}>
          ◀ Menü
        </button>
        <div className="studio-title">
          <h2>Foto aufnehmen & importieren</h2>
          <span className="studio-subtitle">Fotografiere deine Zeichnung auf Papier</span>
        </div>
        <div className="studio-header-actions">
          <button className="button button-secondary" type="button" onClick={() => setShowGuide(true)} title="Zeichen-Anleitung anzeigen">
            📖 Anleitung
          </button>
          {analyzedLevel && (
            <button className="button button-play-big" type="button" onClick={startGame}>
              ▶ Spiel starten!
            </button>
          )}
        </div>
      </header>

      {errorMessage && (
        <div className="error-banner">
          <strong>Hinweis:</strong> {errorMessage}
          {showHttpsHint && (
            <p className="https-help">
              💡 <strong>Tipp für Smartphones:</strong> Mobile Browser (iOS Safari / Android Chrome)
              blockieren die Live-Kamera über ungesichertes HTTP im lokalen WLAN.
              Nutze den Knopf <em>„Foto aus Galerie wählen“</em> – das öffnet direkt die Smartphone-Kamera
              oder deine Galerie und funktioniert garantiert ohne HTTPS!
            </p>
          )}
        </div>
      )}

      <main className="capture-content">
        {!capturedImage && !cameraActive && (
          <div className="capture-choice-card">
            <div className="choice-illustration">📸</div>
            <h3>Wie möchtest du deine Zeichnung laden?</h3>
            <p>
              Halte das Blatt gut beleuchtet und eben. Die 4 Farben werden automatisch erkannt:
            </p>
            <div className="legend-strip">
              <span>⬛ Schwarz: Plattformen</span>
              <span>🟥 Rot: Gefahren</span>
              <span>🟩 Grün: Trampoline</span>
              <span>🟦 Blau: Blöcke</span>
            </div>

            <div className="choice-buttons">
              <button className="button button-primary" type="button" onClick={startCamera}>
                📷 Smartphone-Kamera öffnen
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                🖼 Foto aus Galerie wählen (JPG / PNG / WebP)
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="visually-hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        {cameraActive && (
          <div className="camera-view-container">
            <video ref={videoRef} autoPlay playsInline muted className="camera-feed" />
            <div className="camera-overlay-frame">
              <span className="frame-corner corner-tl" />
              <span className="frame-corner corner-tr" />
              <span className="frame-corner corner-bl" />
              <span className="frame-corner corner-br" />
              <span className="frame-hint">Blatt innerhalb des Rahmens halten</span>
            </div>
            <div className="camera-controls">
              <button className="button button-primary snap-btn" type="button" onClick={snapPhoto}>
                ⚪ Foto aufnehmen
              </button>
              <button className="button button-secondary" type="button" onClick={stopCamera}>
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {capturedImage && (
          <div className="review-container">
            <div className="review-toolbar">
              <button className="button button-secondary" type="button" onClick={rotatePhoto}>
                ↻ 90° Drehen
              </button>
              <button
                className={`button ${dragMode === "start" ? "button-active" : "button-secondary"}`}
                type="button"
                onClick={() => setDragMode(dragMode === "start" ? "none" : "start")}
              >
                🦖 Dino Start setzen {dragMode === "start" ? "(Klicke ins Bild)" : ""}
              </button>
              <button
                className={`button ${dragMode === "goal" ? "button-active" : "button-secondary"}`}
                type="button"
                onClick={() => setDragMode(dragMode === "goal" ? "none" : "goal")}
              >
                🏁 Ziel setzen {dragMode === "goal" ? "(Klicke ins Bild)" : ""}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setAnalyzedLevel(null);
                }}
              >
                Neues Foto
              </button>
            </div>

            <div
              className={`preview-stage ${dragMode !== "none" ? "targeting-mode" : ""}`}
              onClick={handleStageClick}
            >
              <img src={capturedImage} alt="Vorschau der Zeichnung" className="preview-background-img" />

              {analyzedLevel && (
                <div className="detection-overlay">
                  {/* Plattformen Schwarz */}
                  {analyzedLevel.platforms.map((p) => (
                    <span
                      key={p.id}
                      className="detected-box box-platform"
                      style={{
                        left: `${p.x / 10}%`,
                        top: `${p.y / 10}%`,
                        width: `${p.w / 10}%`,
                        height: `${p.h / 10}%`,
                      }}
                      title="Plattform (Schwarz)"
                    />
                  ))}
                  {/* Gefahren Rot */}
                  {analyzedLevel.hazards.map((h) => (
                    <span
                      key={h.id}
                      className="detected-box box-hazard"
                      style={{
                        left: `${h.x / 10}%`,
                        top: `${h.y / 10}%`,
                        width: `${h.w / 10}%`,
                        height: `${h.h / 10}%`,
                      }}
                      title="Gefahr (Rot)"
                    />
                  ))}
                  {/* Trampoline Grün */}
                  {(analyzedLevel.bouncers ?? []).map((b) => (
                    <span
                      key={b.id}
                      className="detected-box box-bouncer"
                      style={{
                        left: `${b.x / 10}%`,
                        top: `${b.y / 10}%`,
                        width: `${b.w / 10}%`,
                        height: `${b.h / 10}%`,
                      }}
                      title="Trampolin (Grün)"
                    />
                  ))}
                  {/* Blöcke Blau */}
                  {(analyzedLevel.movers ?? []).map((m) => (
                    <span
                      key={m.id}
                      className="detected-box box-mover"
                      style={{
                        left: `${m.x / 10}%`,
                        top: `${m.y / 10}%`,
                        width: `${m.w / 10}%`,
                        height: `${m.h / 10}%`,
                      }}
                      title="Physikblock (Blau)"
                    />
                  ))}

                  {/* Gelbe Sammelobjekte (Eier) */}
                  {(analyzedLevel?.collectibles ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="detected-box detected-collectible"
                      style={{
                        left: `${c.x / 10}%`,
                        top: `${c.y / 10}%`,
                        width: `${(c.w ?? 30) / 10}%`,
                        height: `${(c.h ?? 30) / 10}%`,
                        backgroundColor: "rgba(245, 197, 24, 0.45)",
                        border: "2px solid #f5c518",
                        borderRadius: "50%",
                        position: "absolute",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                      }}
                      title="Dino-Ei (Gelb)"
                    >
                      🥚
                    </div>
                  ))}

                  {/* Lila Teleporter (Portale) */}
                  {(analyzedLevel?.teleporters ?? []).map((t) => (
                    <div
                      key={t.id}
                      className="detected-box detected-teleporter"
                      style={{
                        left: `${t.x / 10}%`,
                        top: `${t.y / 10}%`,
                        width: `${(t.w ?? 35) / 10}%`,
                        height: `${(t.h ?? 55) / 10}%`,
                        backgroundColor: "rgba(155, 81, 224, 0.45)",
                        border: "2px solid #9b51e0",
                        borderRadius: "8px",
                        position: "absolute",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontWeight: "bold",
                        fontSize: "11px",
                      }}
                      title={`Teleporter ${t.pairIndex ? `(Paar ${t.pairIndex})` : ""}`}
                    >
                      🌀 {t.pairIndex ? `P${t.pairIndex}` : ""}
                    </div>
                  ))}

                  {(analyzedLevel.movingPlatforms ?? []).map((lift) => (
                    <div
                      key={lift.id}
                      className="marker-pin lift-pin"
                      style={{
                        left: `${lift.x / 10}%`,
                        top: `${lift.y / 10}%`,
                        backgroundColor: "#9b51e0",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      title={`Beweglicher Lift (${lift.axis === "horizontal" ? "↔ waagerecht" : "↕ senkrecht"})`}
                    >
                      {lift.axis === "horizontal" ? "↔" : "↕"}
                    </div>
                  ))}

                  {/* Start Marker */}
                  <div
                    className="marker-pin start-pin"
                    style={{ left: `${startPos.x / 10}%`, top: `${startPos.y / 10}%` }}
                    title="Startposition des Dinos"
                  >
                    🦖
                  </div>

                  {/* Goal Marker */}
                  <div
                    className="marker-pin goal-pin"
                    style={{ left: `${goalPos.x / 10}%`, top: `${goalPos.y / 10}%` }}
                    title="Ziel"
                  >
                    🏆
                  </div>
                </div>
              )}

              {analyzing && (
                <div className="analyzing-cover">
                  <div className="spinner" />
                  <strong>Erkenne Farben und Physik…</strong>
                </div>
              )}
            </div>

            {analyzedLevel && (
              <div className="detection-summary">
                <span>Plattformen: {analyzedLevel.platforms.length}</span>
                <span>Gefahren: {analyzedLevel.hazards.length}</span>
                <span>Trampoline: {analyzedLevel.bouncers?.length ?? 0}</span>
                <span>Physikblöcke: {analyzedLevel.movers?.length ?? 0}</span>
                <span>Dino-Eier: {analyzedLevel.collectibles?.length ?? 0}</span>
                <span>Lifte: {analyzedLevel.movingPlatforms?.length ?? 0}</span>
              </div>
            )}
          </div>
        )}
      </main>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
