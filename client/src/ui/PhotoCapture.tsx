import React, { useEffect, useRef, useState } from "react";
import { analyzeDrawing, type Level } from "@sketchquest/shared";
import { GuideModal } from "./GuideModal";
import type { BackgroundTheme } from "../game/paper";

interface PhotoCaptureProps {
  onPlayLevel: (level: Level, drawingDataUrl: string) => void;
  onBackToMenu: () => void;
  onCancel?: () => void;
  backgroundTheme?: BackgroundTheme;
}

export function PhotoCapture({ onPlayLevel, onBackToMenu, onCancel, backgroundTheme }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // Verbindet den Stream mit dem Video-Element, sobald cameraActive wahr ist und das Element im DOM existiert
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      const v = videoRef.current;
      v.srcObject = streamRef.current;
      v.muted = true;
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => console.warn("Video play error:", err));
      }
    }
  }, [cameraActive]);

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
      // Wenn getUserMedia im Browser nicht verfügbar ist (z.B. Safari auf HTTP)
      setErrorMessage("Live-Kamera im Browser wird auf diesem Gerät/Browser nicht direkt unterstützt (Safari auf iPad/iPhone benötigt HTTPS). Nutze einfach den lila Knopf 'Mit iPad- / Smartphone-Kamera fotografieren'!");
      setShowHttpsHint(true);
      return;
    }

    const constraintsList: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { audio: false, video: { facingMode: { ideal: "environment" } } },
      { audio: false, video: { facingMode: "environment" } },
      { audio: false, video: { facingMode: "user" } },
      { audio: false, video: true },
    ];

    let stream: MediaStream | null = null;
    let streamErr: any = null;
    for (const c of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        if (stream) break;
      } catch (err) {
        streamErr = err;
      }
    }

    if (stream) {
      streamRef.current = stream;
      setCameraActive(true);
    } else {
      console.warn("Live-Kamera nicht verfügbar:", streamErr);
      const isDenied = streamErr?.name === "NotAllowedError" || streamErr?.name === "PermissionDeniedError";
      if (isDenied) {
        setErrorMessage("Zugriff auf die iPad-Kamera wurde im Browser verweigert. Bitte erlaube den Kamera-Zugriff in den Safari-Einstellungen oder nutze den Button 'Mit iPad- / Smartphone-Kamera fotografieren'!");
      } else {
        setErrorMessage("Live-Kamera im Browser konnte nicht gestartet werden. Bitte nutze direkt den Knopf 'Mit iPad- / Smartphone-Kamera fotografieren'!");
        setShowHttpsHint(true);
      }
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);
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
      // Skalierung auf maximal 1600 Pixel für flüssige iPad-Verarbeitung und sparsamen RAM-Verbrauch
      let targetW = img.width;
      let targetH = img.height;
      const MAX_DIM = 1600;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      // Bei 90° oder 270° vertauschte Dimensionen
      const isSwapped = rotAngle === 90 || rotAngle === 270;
      canvas.width = isSwapped ? targetH : targetW;
      canvas.height = isSwapped ? targetW : targetH;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setAnalyzing(false);
        return;
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotAngle * Math.PI) / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
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

  const handleExportLevel = () => {
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

    const jsonStr = JSON.stringify(finalLevel, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(finalLevel.name || "Foto-Level").replace(/\s+/g, "_")}-${Date.now()}.dino.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel || onBackToMenu}
          title="Foto-Scan abbrechen und zum Editor zurückkehren"
          style={{ fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          ✖ Abbrechen
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
            <>
              <button
                className="button button-secondary"
                type="button"
                onClick={handleExportLevel}
                title="Level als Datei (.dino.json) herunterladen oder auf iPad/PC/TV übertragen"
              >
                💾 Level exportieren (.json)
              </button>
              <button className="button button-play-big" type="button" onClick={startGame}>
                ▶ Spiel starten!
              </button>
            </>
          )}
        </div>
      </header>

      {errorMessage && (
        <div className="error-banner">
          <strong>Hinweis:</strong> {errorMessage}
          {showHttpsHint && (
            <p className="https-help">
              💡 <strong>Tipp für iPad & Smartphones:</strong> Safari und Chrome blockieren die Live-Kamera im Browser
              über ungesichertes HTTP im lokalen WLAN.
              Nutze einfach den lila Knopf <em>„Mit iPad- / Smartphone-Kamera fotografieren“</em> – das öffnet direkt die native
              Kamera-App deines Geräts und funktioniert auf jedem iPad und Handy immer zu 100%!
            </p>
          )}
        </div>
      )}

      {backgroundTheme === "jungle" && (
        <div style={{ margin: "10px 16px", padding: "10px 16px", background: "rgba(46, 125, 50, 0.22)", border: "1px solid rgba(76, 175, 80, 0.45)", borderRadius: "10px", fontSize: "0.9rem", color: "#a5d6a7", textAlign: "center" }}>
          🌴 <strong>Urzeit-Dschungel aktiv:</strong> Deine gezeichnete Welt wird in den dichten Urwald eingebettet mit lebendigen Dschungel-Windböen! 🍃
        </div>
      )}

      <main className="capture-content">
        {!capturedImage && !cameraActive && (
          <div className="capture-choice-card">
            <div className="choice-illustration">📸</div>
            <h3>Wie möchtest du deine Zeichnung laden?</h3>
            <p>
              Halte das Blatt gut beleuchtet und eben. Alle 8 magischen Spielfarben werden automatisch erkannt:
            </p>
            <div className="legend-strip">
              <span>⬛ Schwarz: Plattformen</span>
              <span>🟥 Rot: Gefahren</span>
              <span>🟩 Grün: Trampoline</span>
              <span>🟦 Blau: Blöcke</span>
              <span>🟨 Gelb: Dino-Eier</span>
              <span>🟪 Lila: Portale</span>
              <span>🟫 Braun: Lifte</span>
              <span>🟧 Orange: Gegner</span>
            </div>

            <div className="choice-buttons">
              <label
                className="button button-primary"
                style={{
                  fontSize: "1.1rem",
                  padding: "14px 24px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                📸 Mit iPad- / Smartphone-Kamera fotografieren
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>

              <label
                className="button button-secondary"
                style={{
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                🖼️ Foto aus Mediathek / iPad-Galerie wählen
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
              </label>

              <button
                className="button button-secondary"
                type="button"
                onClick={startCamera}
              >
                📹 Live-Kamera im Browser öffnen
              </button>

              <button
                className="button button-secondary"
                type="button"
                onClick={onCancel || onBackToMenu}
                style={{
                  marginTop: "8px",
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  color: "#fca5a5",
                  fontWeight: 600,
                }}
              >
                ✖ Abbrechen & zurück zum Editor
              </button>
            </div>
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
              {analyzedLevel && (
                <button className="button button-secondary" type="button" onClick={handleExportLevel} title="Level als Datei speichern">
                  💾 Level exportieren (.json)
                </button>
              )}
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

                  {/* Schwebende Lifte Braun */}
                  {(analyzedLevel.movingPlatforms ?? []).map((lift) => (
                    <div
                      key={lift.id}
                      className="marker-pin lift-pin"
                      style={{
                        left: `${lift.x / 10}%`,
                        top: `${lift.y / 10}%`,
                        backgroundColor: "#8b5a2b",
                        border: "2px solid #5a3818",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                      title={`Schwebender Lift (${lift.axis === "horizontal" ? "↔ waagerecht" : "↕ senkrecht"})`}
                    >
                      {lift.axis === "horizontal" ? "↔" : "↕"}
                    </div>
                  ))}

                  {/* Patrouillierende Gegner Orange */}
                  {(analyzedLevel.enemies ?? []).map((e) => (
                    <div
                      key={e.id}
                      className="detected-box detected-enemy"
                      style={{
                        left: `${(e.x - 15) / 10}%`,
                        top: `${(e.y - 15) / 10}%`,
                        width: `3%`,
                        height: `3%`,
                        backgroundColor: "rgba(232, 89, 12, 0.45)",
                        border: "2px solid #e8590c",
                        borderRadius: "6px",
                        position: "absolute",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                      }}
                      title="Gegner (Orange)"
                    >
                      👾
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
                  <strong>Erkenne alle 8 Spielfarben…</strong>
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
                <span>Portale: {analyzedLevel.teleporters?.length ?? 0}</span>
                <span>Lifte: {analyzedLevel.movingPlatforms?.length ?? 0}</span>
                <span>Gegner: {analyzedLevel.enemies?.length ?? 0}</span>
              </div>
            )}
          </div>
        )}
      </main>
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
