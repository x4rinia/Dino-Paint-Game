import React, { useEffect, useRef, useState, useCallback } from "react";
import { analyzeDrawing, type Level } from "@sketchquest/shared";
import { GuideModal } from "./GuideModal";

type Tool = "black" | "red" | "green" | "blue" | "yellow" | "purple" | "brown" | "orange" | "eraser";

interface DrawingCanvasProps {
  onPlayLevel: (level: Level, drawingDataUrl: string) => void;
  onBackToMenu: (currentDrawing?: string) => void;
  initialImage?: string;
}

const COLORS: Record<Tool, { hex: string; label: string; desc: string }> = {
  black: { hex: "#1d1d24", label: "Schwarz", desc: "Feste Plattformen & Wände" },
  red: { hex: "#d6453d", label: "Rot", desc: "Tödliche Gefahren (Lava / Stacheln)" },
  green: { hex: "#2fb457", label: "Grün", desc: "Trampoline & Sprungflächen" },
  blue: { hex: "#2a6df4", label: "Blau", desc: "Bewegliche Physikblöcke" },
  yellow: { hex: "#f5c518", label: "Gelb", desc: "Sammelobjekte (Dino-Eier)" },
  purple: { hex: "#9b51e0", label: "Lila", desc: "Teleporter-Portale (Beamen oder Vortex-Boost)" },
  brown: { hex: "#8b5a2b", label: "Braun", desc: "Bewegliche Lifte (Fährt waagerecht oder senkrecht)" },
  orange: { hex: "#e8590c", label: "Orange", desc: "Bewegliche patrouillierende Gegner" },
  eraser: { hex: "#ffffff", label: "Radierer", desc: "Linien entfernen" },
};

const BRUSH_SIZES = [
  { size: 5, label: "Fein" },
  { size: 14, label: "Mittel" },
  { size: 28, label: "Breit" },
];

export function DrawingCanvas({ onPlayLevel, onBackToMenu, initialImage }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Tool>("black");
  const [brushSize, setBrushSize] = useState<number>(14);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Undo/Redo Stacks (speichert ImageData Snapshot-Strings oder ImageData)
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const startPanPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1280;
  const CANVAS_HEIGHT = 720;

  // Initialisieren & weißer Hintergrund
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    historyRef.current = [];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);

    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        saveHistory();
      };
      img.src = initialImage;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Automatischer schwarzer Rand / Rahmen, damit Zeichnungen in den Ecken sauber abgeschlossen sind
      ctx.strokeStyle = "#1d1d24";
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 10);
      saveHistory();
    }
  }, [initialImage]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const data = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    historyRef.current.push(data);
    if (historyRef.current.length > 25) {
      historyRef.current.shift();
    }
    redoRef.current = [];
    setCanUndo(historyRef.current.length > 1);
    setCanRedo(false);
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const current = historyRef.current.pop()!;
    redoRef.current.push(current);

    const prev = historyRef.current[historyRef.current.length - 1];
    ctx.putImageData(prev, 0, 0);

    setCanUndo(historyRef.current.length > 1);
    setCanRedo(true);
  };

  const redo = () => {
    if (redoRef.current.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const next = redoRef.current.pop()!;
    historyRef.current.push(next);
    ctx.putImageData(next, 0, 0);

    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.strokeStyle = "#1d1d24";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, CANVAS_WIDTH - 10, CANVAS_HEIGHT - 10);
    saveHistory();
    setShowClearConfirm(false);
  };

  // Koordinaten-Umrechnung von Bildschirm zu Canvas
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Aktiver Pointer für Palm-Rejection (Handballenerkennung) & Stiftunterstützung
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerTypeRef = useRef<string | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm Rejection: Wenn mit Stift (Apple Pencil / S-Pen) gezeichnet wird, versehentliche Fingerberührungen ignorieren
    if (activePointerTypeRef.current === "pen" && e.pointerType === "touch") {
      return;
    }

    if (isPanMode || e.button === 1 || e.buttons === 4) {
      isPanningRef.current = true;
      startPanPointRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0 && e.button !== undefined) return;
    
    // Pointer capture für kontinuierliche Striche bis über den Rand hinaus
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    activePointerIdRef.current = e.pointerId;
    activePointerTypeRef.current = e.pointerType;
    isDrawingRef.current = true;
    const pt = getCanvasCoords(e);
    lastPointRef.current = pt;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Druckempfindlichkeit bei Stylus / Apple Pencil berücksichtigen
    let effectiveWidth = brushSize;
    if (e.pointerType === "pen" && typeof e.pressure === "number" && e.pressure > 0) {
      effectiveWidth = Math.max(2, Math.round(brushSize * Math.min(2.0, Math.max(0.35, e.pressure * 1.6))));
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = effectiveWidth;
    ctx.strokeStyle = COLORS[tool].hex;
    ctx.fillStyle = COLORS[tool].hex;

    // Ein einzelner Klick/Tipp zeichnet einen sauberen Punkt
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, effectiveWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      setPan({
        x: e.clientX - startPanPointRef.current.x,
        y: e.clientY - startPanPointRef.current.y,
      });
      return;
    }

    // Palm Rejection während des Strichs
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) {
      return;
    }

    if (!isDrawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const pt = getCanvasCoords(e);

    // Dynamische Linienbreite bei Stiftdruck
    let effectiveWidth = brushSize;
    if (e.pointerType === "pen" && typeof e.pressure === "number" && e.pressure > 0) {
      effectiveWidth = Math.max(2, Math.round(brushSize * Math.min(2.0, Math.max(0.35, e.pressure * 1.6))));
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = effectiveWidth;
    ctx.strokeStyle = COLORS[tool].hex;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (isPanningRef.current) {
      isPanningRef.current = false;
    }
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPointRef.current = null;
      activePointerIdRef.current = null;
      activePointerTypeRef.current = null;
      saveHistory();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || isPanMode) {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.min(3, Math.max(0.5, z * zoomDelta)));
    }
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `dino-level-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const playNow = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    setAnalyzing(true);
    setTimeout(() => {
      try {
        const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const dataUrl = canvas.toDataURL("image/png");

        const result = analyzeDrawing(imgData, {
          name: "Mein gezeichnetes Level",
          gridWidth: 320,
          gridHeight: 180,
        });

        const levelWithImage: Level = {
          ...result.level,
        };
        (levelWithImage as any).originalImage = dataUrl;

        onPlayLevel(levelWithImage, dataUrl);
      } catch (err) {
        alert("Fehler bei der Analyse der Zeichnung: " + (err instanceof Error ? err.message : String(err)));
      } finally {
        setAnalyzing(false);
      }
    }, 40);
  };

  const handleBackToMenu = () => {
    const canvas = canvasRef.current;
    const currentData = canvas ? canvas.toDataURL("image/png") : undefined;
    onBackToMenu(currentData);
  };

  return (
    <div className="drawing-studio">
      <header className="studio-header">
        <button className="button button-secondary" type="button" onClick={handleBackToMenu}>
          ◀ Menü
        </button>
        <div className="studio-title">
          <h2>Level zeichnen</h2>
          <span className="studio-subtitle">Zeichne mit allen 6 Spielfarben deine Welt</span>
        </div>
        <div className="studio-header-actions">
          <button className="button button-secondary" type="button" onClick={() => setShowGuide(true)} title="Zeichen-Anleitung">
            📖 Anleitung
          </button>
          <button className="button button-export" type="button" onClick={exportPng} title="Als PNG speichern">
            PNG Export
          </button>
          <button
            className="button button-play-big"
            type="button"
            onClick={playNow}
            disabled={analyzing}
          >
            {analyzing ? "Analysiere…" : "▶ Jetzt spielen!"}
          </button>
        </div>
      </header>

      <div className="studio-toolbar">
        <div className="tool-group colors-group">
          <span className="tool-label">Farbe:</span>
          {(["black", "red", "green", "blue", "yellow", "purple", "brown", "orange", "eraser"] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`color-btn ${tool === t ? "active" : ""}`}
              onClick={() => {
                setTool(t);
                setIsPanMode(false);
              }}
              title={`${COLORS[t].label}: ${COLORS[t].desc}`}
            >
              <span
                className="color-swatch"
                style={{
                  backgroundColor: COLORS[t].hex,
                  border: t === "eraser" ? "2px dashed #999" : "none",
                }}
              />
              <span className="color-name">{COLORS[t].label}</span>
            </button>
          ))}
        </div>

        <div className="tool-group size-group">
          <span className="tool-label">Größe:</span>
          {BRUSH_SIZES.map((b) => (
            <button
              key={b.size}
              type="button"
              className={`size-btn ${brushSize === b.size ? "active" : ""}`}
              onClick={() => setBrushSize(b.size)}
            >
              <span
                className="size-dot"
                style={{ width: Math.min(22, b.size), height: Math.min(22, b.size) }}
              />
              <span>{b.label}</span>
            </button>
          ))}
        </div>

        <div className="tool-group action-group">
          <button
            type="button"
            className="tool-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Rückgängig"
          >
            ⤺
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Wiederholen"
          >
            ⤻
          </button>
          <button
            type="button"
            className={`tool-btn ${isPanMode ? "active" : ""}`}
            onClick={() => setIsPanMode(!isPanMode)}
            title="Verschieben / Zoom"
          >
            ✋
          </button>
          <button
            type="button"
            className="tool-btn tool-btn-danger"
            onClick={() => setShowClearConfirm(true)}
            title="Alles löschen"
          >
            🗑
          </button>
        </div>
      </div>

      <div
        className="canvas-viewport"
        ref={containerRef}
        onWheel={handleWheel}
        style={{ cursor: isPanMode ? "grab" : tool === "eraser" ? "cell" : "crosshair" }}
      >
        <div
          className="canvas-transform-wrapper"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="drawing-board"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>

      <footer className="studio-legend">
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.black.hex }} />
          <strong>Schwarz:</strong> Boden & Plattformen
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.red.hex }} />
          <strong>Rot:</strong> Gefahren (Neustart)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.green.hex }} />
          <strong>Grün:</strong> Trampolin (Hochsprung)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.blue.hex }} />
          <strong>Blau:</strong> Physikblöcke (Schiebbar)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.yellow.hex }} />
          <strong>Gelb:</strong> Dino-Eier (Sammeln)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.purple.hex }} />
          <strong>Lila:</strong> Portale (Teleport / Vortex)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.brown.hex }} />
          <strong>Braun:</strong> Bewegliche Lifte
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.orange.hex }} />
          <strong>Orange:</strong> Gegner (Patrouille)
        </div>
      </footer>

      {showClearConfirm && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3>Zeichnung löschen?</h3>
            <p>Möchtest du das gesamte Zeichenblatt wirklich leeren?</p>
            <div className="modal-actions">
              <button className="button button-danger" type="button" onClick={clearCanvas}>
                Ja, alles löschen
              </button>
              <button className="button button-secondary" type="button" onClick={() => setShowClearConfirm(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
