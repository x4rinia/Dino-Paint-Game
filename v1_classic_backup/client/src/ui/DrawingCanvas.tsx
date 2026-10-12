import React, { useEffect, useRef, useState, useCallback } from "react";
import { analyzeDrawing, type Level } from "@sketchquest/shared";
import { GuideModal } from "./GuideModal";
import { saveLevel, importLevelFile, getSetting } from "../storage/db";
import type { BackgroundTheme } from "../game/paper";

const COLOR_TOOLS = ["black", "red", "green", "blue", "yellow", "purple", "brown", "orange", "eraser"] as const;
type ColorTool = (typeof COLOR_TOOLS)[number];
type Tool = ColorTool | "start" | "goal";

interface DrawingCanvasProps {
  onPlayLevel: (level: Level, drawingDataUrl: string) => void;
  onBackToMenu: (currentDrawing?: string) => void;
  initialImage?: string;
  backgroundTheme?: BackgroundTheme;
}

const COLORS: Record<ColorTool, { hex: string; label: string; desc: string }> = {
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

export function DrawingCanvas({ onPlayLevel, onBackToMenu, initialImage, backgroundTheme }: DrawingCanvasProps) {
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

  // Start (S) und Ziel (Z) Marker
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [goalPos, setGoalPos] = useState<{ x: number; y: number } | null>(null);

  // Speicher-, Export- & Upload-Zustände für den Editor
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [levelNameInput, setLevelNameInput] = useState("Mein Dino-Level");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setStartPos(null);
    setGoalPos(null);
    saveHistory();
    setShowClearConfirm(false);
  };

  // Koordinaten-Umrechnung von Bildschirm zu Canvas (mit Clamping an die Ränder)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH, (e.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT, (e.clientY - rect.top) * scaleY)),
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

    const pt = getCanvasCoords(e);

    // Start- und Ziel-Marker setzen
    if (tool === "start") {
      setStartPos(pt);
      setSaveToast("🚩 Startpunkt (S) gesetzt!");
      setTimeout(() => setSaveToast(null), 2000);
      return;
    }
    if (tool === "goal") {
      setGoalPos(pt);
      setSaveToast("🏁 Zielpunkt (Z) gesetzt!");
      setTimeout(() => setSaveToast(null), 2000);
      return;
    }
    
    // Pointer capture für kontinuierliche Striche bis über den Rand hinaus
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    activePointerIdRef.current = e.pointerId;
    activePointerTypeRef.current = e.pointerType;
    isDrawingRef.current = true;
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
    ctx.strokeStyle = COLORS[tool as Exclude<Tool, "start" | "goal">].hex;
    ctx.fillStyle = COLORS[tool as Exclude<Tool, "start" | "goal">].hex;

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
    ctx.strokeStyle = COLORS[tool as Exclude<Tool, "start" | "goal">]?.hex || "#1d1d24";

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

  const generateRandomLevel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const drawSolidRect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, 6);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();
    };

    const drawCircle = (cx: number, cy: number, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawEgg = (cx: number, cy: number) => {
      ctx.fillStyle = "#f5c518";
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPortal = (x: number, y: number, w: number = 38, h: number = 68) => {
      ctx.fillStyle = "#9b51e0";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, w, h, 18);
      } else {
        ctx.rect(x, y, w, h);
      }
      ctx.fill();
    };

    const isJungle = backgroundTheme === "jungle";
    const choice = Math.floor(Math.random() * 3);

    if (isJungle) {
      // 🌴 DYNAMISCHE URWALD-WELTEN (Aufrecht mit Baumwipfeln, Lianen & Windgängen)
      if (choice === 0) {
        // Dschungel-Layout 1: Baumwipfel & Lianen-Brücken
        drawSolidRect(30, 560, 340, 140, "#1d1d24");
        drawSolidRect(940, 520, 310, 180, "#1d1d24");

        // Aufsteigende Ast-Plattformen
        drawSolidRect(220, 430, 200, 28, "#1d1d24");
        drawSolidRect(460, 340, 220, 28, "#1d1d24");
        drawSolidRect(720, 250, 200, 28, "#1d1d24");
        drawSolidRect(580, 480, 180, 28, "#1d1d24");

        // Trampoline für den weiten Flug mit Rückenwind
        drawSolidRect(240, 540, 90, 20, "#2fb457");
        drawSolidRect(640, 460, 80, 20, "#2fb457");

        // Schwebender Lianen-Lift zwischen den Baumkronen
        drawSolidRect(360, 530, 140, 25, "#8b5a2b");

        // Dornen / Treibsand im tiefen Dschungeltal
        drawSolidRect(380, 680, 540, 35, "#d6453d");

        // Physikbox & Urwald-Gegner
        drawSolidRect(500, 290, 48, 48, "#2a6df4");
        drawCircle(800, 235, 18, "#e8590c");

        // Geheimportale
        drawPortal(70, 480, 38, 70);
        drawPortal(1080, 440, 38, 70);

        // Dino-Eier
        drawEgg(300, 380);
        drawEgg(560, 290);
        drawEgg(810, 200);
        drawEgg(670, 430);

        setStartPos({ x: 110, y: 520 });
        setGoalPos({ x: 1120, y: 470 });
      } else if (choice === 1) {
        // Dschungel-Layout 2: Tempel-Ruinen & Felsklippen
        drawSolidRect(30, 600, 360, 110, "#1d1d24");
        drawSolidRect(880, 600, 370, 110, "#1d1d24");
        drawSolidRect(400, 680, 470, 35, "#d6453d");

        drawSolidRect(250, 470, 190, 28, "#1d1d24");
        drawSolidRect(100, 340, 210, 28, "#1d1d24");
        drawSolidRect(360, 260, 240, 28, "#1d1d24");
        drawSolidRect(680, 200, 220, 28, "#1d1d24");
        drawSolidRect(950, 320, 240, 28, "#1d1d24");

        drawSolidRect(300, 580, 100, 20, "#2fb457");
        drawSolidRect(520, 240, 80, 20, "#2fb457");

        drawSolidRect(160, 290, 48, 48, "#2a6df4");
        drawSolidRect(470, 440, 160, 26, "#8b5a2b");

        drawCircle(440, 240, 18, "#e8590c");
        drawCircle(1040, 295, 18, "#e8590c");

        drawPortal(70, 260, 38, 70);
        drawPortal(1140, 520, 38, 70);

        drawEgg(160, 420);
        drawEgg(470, 210);
        drawEgg(780, 150);
        drawEgg(1080, 550);

        setStartPos({ x: 120, y: 560 });
        setGoalPos({ x: 1040, y: 270 });
      } else {
        // Dschungel-Layout 3: Riesen-Bäume & Doppel-Schwebelifte
        drawSolidRect(30, 540, 310, 160, "#1d1d24");
        drawSolidRect(460, 580, 340, 120, "#1d1d24");
        drawSolidRect(920, 520, 330, 180, "#1d1d24");

        drawSolidRect(340, 680, 110, 35, "#d6453d");
        drawSolidRect(810, 680, 100, 35, "#d6453d");

        drawSolidRect(180, 380, 190, 28, "#1d1d24");
        drawSolidRect(520, 320, 220, 28, "#1d1d24");
        drawSolidRect(860, 330, 180, 28, "#1d1d24");

        drawSolidRect(260, 520, 80, 20, "#2fb457");
        drawSolidRect(720, 560, 80, 20, "#2fb457");

        drawSolidRect(350, 430, 120, 25, "#8b5a2b");
        drawSolidRect(790, 420, 120, 25, "#8b5a2b");

        drawSolidRect(500, 530, 46, 46, "#2a6df4");
        drawCircle(640, 555, 18, "#e8590c");

        drawPortal(80, 460, 38, 70);
        drawPortal(1120, 440, 38, 70);

        drawEgg(230, 330);
        drawEgg(600, 270);
        drawEgg(910, 280);
        drawEgg(650, 530);

        setStartPos({ x: 110, y: 500 });
        setGoalPos({ x: 1080, y: 470 });
      }
    } else {
      // 📜 KLASSISCHE DYNAMISCHE PLATFORMER-WELTEN (Notizheft / Kosmos)
      if (choice === 0) {
        // Layout 1: Canyons & Himmelsinseln (Ausgewogene Stepping-Pfade)
        drawSolidRect(30, 580, 320, 120, "#1d1d24");
        drawSolidRect(940, 520, 310, 180, "#1d1d24");

        // Schwebende Stufen ins Himmelsreich
        drawSolidRect(260, 440, 180, 28, "#1d1d24");
        drawSolidRect(480, 340, 200, 28, "#1d1d24");
        drawSolidRect(740, 260, 180, 28, "#1d1d24");
        drawSolidRect(620, 480, 180, 28, "#1d1d24");

        // Schwebelift über den Canyon
        drawSolidRect(360, 560, 140, 25, "#8b5a2b");

        // Trampolin für den Riesensprung
        drawSolidRect(220, 560, 90, 20, "#2fb457");
        drawSolidRect(680, 460, 80, 20, "#2fb457");

        // Lava im Tal
        drawSolidRect(360, 680, 560, 35, "#d6453d");

        // Physik-Box & Gegner
        drawSolidRect(510, 290, 48, 48, "#2a6df4");
        drawCircle(820, 245, 18, "#e8590c");

        // Portale
        drawPortal(70, 500, 38, 70);
        drawPortal(1080, 440, 38, 70);

        // Dino-Eier entlang des Sprungbogens
        drawEgg(340, 390);
        drawEgg(570, 290);
        drawEgg(830, 210);
        drawEgg(720, 430);

        setStartPos({ x: 120, y: 540 });
        setGoalPos({ x: 1120, y: 470 });
      } else if (choice === 1) {
        // Layout 2: Stufen-Pyramide & Doppel-Trampolin
        drawSolidRect(30, 620, 360, 90, "#1d1d24");
        drawSolidRect(880, 620, 370, 90, "#1d1d24");
        drawSolidRect(400, 680, 470, 35, "#d6453d"); // Lava

        drawSolidRect(260, 490, 180, 28, "#1d1d24");
        drawSolidRect(100, 360, 200, 28, "#1d1d24");
        drawSolidRect(360, 280, 240, 28, "#1d1d24");
        drawSolidRect(680, 220, 220, 28, "#1d1d24");
        drawSolidRect(960, 340, 240, 28, "#1d1d24");

        drawSolidRect(300, 600, 100, 20, "#2fb457");
        drawSolidRect(520, 260, 80, 20, "#2fb457");

        drawSolidRect(160, 310, 48, 48, "#2a6df4");
        drawSolidRect(480, 460, 160, 26, "#8b5a2b");

        drawCircle(440, 260, 18, "#e8590c");
        drawCircle(1050, 315, 18, "#e8590c");

        drawPortal(70, 280, 38, 70);
        drawPortal(1140, 540, 38, 70);

        drawEgg(160, 440);
        drawEgg(470, 230);
        drawEgg(780, 170);
        drawEgg(1080, 570);

        setStartPos({ x: 120, y: 580 });
        setGoalPos({ x: 1040, y: 290 });
      } else {
        // Layout 3: Tal der Brücken & Schwebelifte
        drawSolidRect(30, 540, 300, 160, "#1d1d24");
        drawSolidRect(460, 580, 340, 120, "#1d1d24");
        drawSolidRect(920, 520, 330, 180, "#1d1d24");

        drawSolidRect(340, 680, 110, 35, "#d6453d");
        drawSolidRect(810, 680, 100, 35, "#d6453d");

        drawSolidRect(180, 390, 190, 28, "#1d1d24");
        drawSolidRect(520, 330, 220, 28, "#1d1d24");
        drawSolidRect(860, 340, 180, 28, "#1d1d24");

        drawSolidRect(260, 520, 80, 20, "#2fb457");
        drawSolidRect(720, 560, 80, 20, "#2fb457");

        drawSolidRect(350, 440, 120, 25, "#8b5a2b");
        drawSolidRect(790, 430, 120, 25, "#8b5a2b");

        drawSolidRect(500, 530, 46, 46, "#2a6df4");
        drawCircle(640, 555, 18, "#e8590c");

        drawPortal(90, 460, 38, 70);
        drawPortal(1160, 440, 38, 70);

        drawEgg(270, 340);
        drawEgg(630, 280);
        drawEgg(940, 290);
        drawEgg(600, 530);

        setStartPos({ x: 110, y: 490 });
        setGoalPos({ x: 1080, y: 470 });
      }
    }

    saveHistory();
    setSaveToast(
      isJungle
        ? "🌴 Kopfüber-Dschungel-Level gezeichnet! (Dino läuft an der Decke)"
        : "🎲 Neues Zufalls-Level gezeichnet!"
    );
    setTimeout(() => setSaveToast(null), 3000);
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `dino-level-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setSaveToast("✓ Bild heruntergeladen!");
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleSaveToLibrary = async (chosenName?: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    setIsSaving(true);
    try {
      const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      const dataUrl = canvas.toDataURL("image/png");
      const nameToUse = (chosenName || levelNameInput || "Mein Dino-Level").trim();

      const spawnMode = await getSetting<string>("spawn_mode", "manual");
      const useManual = spawnMode === "manual";

      const customStart = (useManual && startPos)
        ? { x: Math.round((startPos.x / CANVAS_WIDTH) * 1000), y: Math.round((startPos.y / CANVAS_HEIGHT) * 1000) }
        : undefined;
      const customGoal = (useManual && goalPos)
        ? { x: Math.round((goalPos.x / CANVAS_WIDTH) * 1000), y: Math.round((goalPos.y / CANVAS_HEIGHT) * 1000) }
        : undefined;

      const result = analyzeDrawing(imgData, {
        name: nameToUse,
        gridWidth: 320,
        gridHeight: 180,
        customStart,
        customGoal,
      });

      // Erstelle ein kompaktes Thumbnail
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = 240;
      thumbCanvas.height = 135;
      const tctx = thumbCanvas.getContext("2d");
      let thumbUrl = dataUrl;
      if (tctx) {
        tctx.drawImage(canvas, 0, 0, 240, 135);
        thumbUrl = thumbCanvas.toDataURL("image/jpeg", 0.7);
      }

      await saveLevel({
        name: nameToUse,
        level: result.level,
        thumbnail: thumbUrl,
        originalImage: dataUrl,
      });

      setSaveToast("✓ In Bibliothek gespeichert!");
      setTimeout(() => setSaveToast(null), 3500);
      setShowSaveModal(false);
    } catch (err) {
      alert("Fehler beim Speichern: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    try {
      if (/\.json$/i.test(file.name) || file.type === "application/json") {
        const item = await importLevelFile(file);
        setLevelNameInput(item.name);
        setSaveToast(`✓ Level "${item.name}" importiert!`);
        setTimeout(() => setSaveToast(null), 3500);

        const imgSource = item.originalImage || item.thumbnail;
        if (imgSource) {
          const img = new Image();
          img.onload = () => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            saveHistory();
          };
          img.src = imgSource;
        } else if (item.level) {
          // Zeichne Level-Objekte auf Canvas falls kein Bild vorhanden ist
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // Schwarz: Plattformen
          ctx.fillStyle = "#1d1d24";
          for (const p of item.level.platforms ?? []) {
            ctx.fillRect((p.x / 1000) * CANVAS_WIDTH, (p.y / 1000) * CANVAS_HEIGHT, (p.w / 1000) * CANVAS_WIDTH, (p.h / 1000) * CANVAS_HEIGHT);
          }
          // Rot: Gefahren
          ctx.fillStyle = "#d6453d";
          for (const h of item.level.hazards ?? []) {
            ctx.fillRect((h.x / 1000) * CANVAS_WIDTH, (h.y / 1000) * CANVAS_HEIGHT, (h.w / 1000) * CANVAS_WIDTH, (h.h / 1000) * CANVAS_HEIGHT);
          }
          // Grün: Bouncer
          ctx.fillStyle = "#2fb457";
          for (const b of item.level.bouncers ?? []) {
            ctx.fillRect((b.x / 1000) * CANVAS_WIDTH, (b.y / 1000) * CANVAS_HEIGHT, (b.w / 1000) * CANVAS_WIDTH, (b.h / 1000) * CANVAS_HEIGHT);
          }
          // Blau: Movers
          ctx.fillStyle = "#2a6df4";
          for (const m of item.level.movers ?? []) {
            ctx.fillRect((m.x / 1000) * CANVAS_WIDTH, (m.y / 1000) * CANVAS_HEIGHT, (m.w / 1000) * CANVAS_WIDTH, (m.h / 1000) * CANVAS_HEIGHT);
          }
          // Gelb: Dino-Eier
          ctx.fillStyle = "#f5c518";
          for (const c of item.level.collectibles ?? []) {
            const cw = ((c.w ?? 30) / 1000) * CANVAS_WIDTH;
            const ch = ((c.h ?? 30) / 1000) * CANVAS_HEIGHT;
            const cx = (c.x / 1000) * CANVAS_WIDTH + cw / 2;
            const cy = (c.y / 1000) * CANVAS_HEIGHT + ch / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(6, cw / 2), Math.max(8, ch / 2), 0, 0, Math.PI * 2);
            ctx.fill();
          }
          // Lila: Teleporter
          ctx.fillStyle = "#9b51e0";
          for (const t of item.level.teleporters ?? []) {
            ctx.fillRect((t.x / 1000) * CANVAS_WIDTH, (t.y / 1000) * CANVAS_HEIGHT, ((t.w ?? 35) / 1000) * CANVAS_WIDTH, ((t.h ?? 55) / 1000) * CANVAS_HEIGHT);
          }
          // Braun: Lifte
          ctx.fillStyle = "#8b5a2b";
          for (const mp of item.level.movingPlatforms ?? []) {
            ctx.fillRect((mp.x / 1000) * CANVAS_WIDTH, (mp.y / 1000) * CANVAS_HEIGHT, (mp.w / 1000) * CANVAS_WIDTH, (mp.h / 1000) * CANVAS_HEIGHT);
          }
          // Orange: Gegner
          ctx.fillStyle = "#e8590c";
          for (const e of item.level.enemies ?? []) {
            ctx.beginPath();
            ctx.arc((e.x / 1000) * CANVAS_WIDTH, (e.y / 1000) * CANVAS_HEIGHT, 16, 0, Math.PI * 2);
            ctx.fill();
          }
          saveHistory();
        }
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          if (!dataUrl) return;
          const img = new Image();
          img.onload = () => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            saveHistory();
            setSaveToast("✓ Bild erfolgreich geladen!");
            setTimeout(() => setSaveToast(null), 3000);
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      alert("Fehler beim Hochladen: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      e.target.value = "";
    }
  };

  const playNow = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    setAnalyzing(true);
    const spawnMode = await getSetting<string>("spawn_mode", "manual");
    setTimeout(() => {
      try {
        const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const dataUrl = canvas.toDataURL("image/png");

        const useManual = spawnMode === "manual";
        const customStart = (useManual && startPos)
          ? { x: Math.round((startPos.x / CANVAS_WIDTH) * 1000), y: Math.round((startPos.y / CANVAS_HEIGHT) * 1000) }
          : undefined;
        const customGoal = (useManual && goalPos)
          ? { x: Math.round((goalPos.x / CANVAS_WIDTH) * 1000), y: Math.round((goalPos.y / CANVAS_HEIGHT) * 1000) }
          : undefined;

        const result = analyzeDrawing(imgData, {
          name: levelNameInput || "Mein gezeichnetes Level",
          gridWidth: 320,
          gridHeight: 180,
          customStart,
          customGoal,
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
          <h2>Level-Editor</h2>
          <span className="studio-subtitle">Zeichne mit allen 8 Spielfarben deine Welt</span>
        </div>
        <div className="studio-header-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={generateRandomLevel}
            title="Generiert ein zufälliges buntes, spielbares Level"
            style={{
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#ffffff",
              borderColor: "#4338ca",
              fontWeight: 600,
            }}
          >
            🎲 Zufalls-Level
          </button>

          <button
            className="button button-secondary"
            type="button"
            onClick={() => setShowGuide(true)}
            title="Zeichen-Anleitung & Farbbedeutungen"
          >
            📖 Anleitung
          </button>

          <label
            className="button button-secondary"
            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            title="Eigenes Bild oder Level in den Editor laden"
          >
            📥 Bild laden
            <input
              type="file"
              accept=".json,application/json,image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleUploadFile}
            />
          </label>

          <button
            className="button button-secondary"
            type="button"
            onClick={exportPng}
            title="Zeichnung als PNG-Bild herunterladen"
          >
            ⬇️ Bild herunterladen
          </button>

          <button
            className="button button-save"
            type="button"
            onClick={() => setShowSaveModal(true)}
            title="Level dauerhaft in lokaler Bibliothek sichern"
          >
            {saveToast ? saveToast : "💾 In Bibliothek speichern"}
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
          {COLOR_TOOLS.map((t) => (
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

        <div className="tool-group marker-group">
          <span className="tool-label">Marker:</span>
          <button
            type="button"
            className={`tool-btn-marker ${tool === "start" ? "active-start" : ""}`}
            onClick={() => {
              setTool("start");
              setIsPanMode(false);
            }}
            title="Klicke auf die Leinwand, um den Startpunkt (S) zu setzen"
          >
            🚩 Start (S)
          </button>
          <button
            type="button"
            className={`tool-btn-marker ${tool === "goal" ? "active-goal" : ""}`}
            onClick={() => {
              setTool("goal");
              setIsPanMode(false);
            }}
            title="Klicke auf die Leinwand, um den Zielpunkt (Z) zu setzen"
          >
            🏁 Ziel (Z)
          </button>
          {(startPos || goalPos) && (
            <button
              type="button"
              className="tool-btn-reset-markers"
              onClick={() => {
                setStartPos(null);
                setGoalPos(null);
                setSaveToast("Marker zurückgesetzt (automatisch)");
                setTimeout(() => setSaveToast(null), 2000);
              }}
              title="Start- und Ziel-Marker entfernen (fällt auf automatische Platzierung zurück)"
            >
              ✕ Reset
            </button>
          )}
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
        style={{
          cursor:
            isPanMode
              ? "grab"
              : tool === "eraser"
              ? "cell"
              : tool === "start" || tool === "goal"
              ? "pointer"
              : "crosshair",
        }}
      >
        <div
          className="canvas-transform-wrapper"
          style={{
            position: "relative",
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
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

          {startPos && (
            <div
              style={{
                position: "absolute",
                left: `${startPos.x}px`,
                top: `${startPos.y}px`,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 10,
                userSelect: "none",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  color: "#ffffff",
                  padding: "4px 8px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                🦖 Start (S)
              </div>
              <div style={{ width: "3px", height: "12px", background: "#059669" }} />
            </div>
          )}

          {goalPos && (
            <div
              style={{
                position: "absolute",
                left: `${goalPos.x}px`,
                top: `${goalPos.y}px`,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 10,
                userSelect: "none",
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "#ffffff",
                  padding: "4px 8px",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "12px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                🏁 Ziel (Z)
              </div>
              <div style={{ width: "3px", height: "12px", background: "#d97706" }} />
            </div>
          )}
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

      {showSaveModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <h3>💾 Level in Bibliothek speichern</h3>
            <p style={{ marginTop: 8, marginBottom: 12 }}>
              Gib deinem Level einen Namen. Es wird offline in deiner Bibliothek gespeichert:
            </p>
            <input
              type="text"
              value={levelNameInput}
              onChange={(e) => setLevelNameInput(e.target.value)}
              className="form-input"
              placeholder="Name des Levels (z.B. Lava-Grotte)"
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: "1.05rem",
                borderRadius: "8px",
                border: "2px solid #3c4254",
                background: "#181a20",
                color: "#fff",
                marginBottom: 16,
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveToLibrary();
              }}
            />
            <div className="modal-actions">
              <button
                className="button button-save"
                type="button"
                onClick={() => handleSaveToLibrary()}
                disabled={isSaving}
              >
                {isSaving ? "Speichere…" : "Speichern"}
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setShowSaveModal(false)}
              >
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
