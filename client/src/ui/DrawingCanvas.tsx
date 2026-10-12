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
  gameMode?: "jump_n_run" | "rpg_labyrinth";
  onGameModeChange?: (mode: "jump_n_run" | "rpg_labyrinth") => void;
  onOpenSettings?: () => void;
  onOpenGameMode?: () => void;
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

export function DrawingCanvas({
  onPlayLevel,
  onBackToMenu,
  initialImage,
  backgroundTheme,
  gameMode = "jump_n_run",
  onGameModeChange,
  onOpenSettings,
  onOpenGameMode,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [activeMode, setActiveMode] = useState<"jump_n_run" | "rpg_labyrinth">(gameMode);
  const [tool, setTool] = useState<Tool>("black");
  const [brushSize, setBrushSize] = useState<number>(14);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(0.85);
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

  // 🔍 Responsiver Zoom & Skalierung für Laptop- und Desktop-Bildschirme
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padX = 24;
    const padY = 24;
    const availW = Math.max(200, rect.width - padX);
    const availH = Math.max(200, rect.height - padY);
    const scaleX = availW / CANVAS_WIDTH;
    const scaleY = availH / CANVAS_HEIGHT;
    // Perfekt einpassen: Maximiert die sichtbare Fläche ohne Abschneiden
    const bestZoom = Math.min(scaleX, scaleY, 1.0);
    setZoom(Number(Math.max(0.2, bestZoom).toFixed(2)));
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const timer = setTimeout(fitToScreen, 40);
    const ro = new ResizeObserver(() => fitToScreen());
    ro.observe(el);
    window.addEventListener("resize", fitToScreen);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", fitToScreen);
    };
  }, [fitToScreen]);

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

    if (activeMode === "rpg_labyrinth") {
      // 🧭 RPG MAKER / TOP-DOWN LABYRINTH MODUS
      // Stabile dicke Außenmauern
      drawSolidRect(20, 20, 1240, 24, "#1d1d24"); // Oben
      drawSolidRect(20, 676, 1240, 24, "#1d1d24"); // Unten
      drawSolidRect(20, 20, 24, 680, "#1d1d24"); // Links
      drawSolidRect(1236, 20, 24, 680, "#1d1d24"); // Rechts

      if (choice === 0) {
        // Labyrinth 1: Irrgarten der 8 Farben mit 1 Vortex-Katapult (weit weg vom Start!)
        drawSolidRect(220, 20, 24, 460, "#1d1d24");
        drawSolidRect(220, 480, 260, 24, "#1d1d24");
        drawSolidRect(460, 160, 24, 340, "#1d1d24");
        drawSolidRect(460, 160, 260, 24, "#1d1d24");
        drawSolidRect(700, 160, 24, 380, "#1d1d24");
        drawSolidRect(220, 580, 500, 24, "#1d1d24");
        drawSolidRect(800, 240, 24, 460, "#1d1d24");
        drawSolidRect(800, 360, 300, 24, "#1d1d24");
        drawSolidRect(980, 100, 24, 280, "#1d1d24");
        drawSolidRect(980, 480, 180, 24, "#1d1d24");

        // Rote Gefahren (Lava / Stacheln in Abzweigungen)
        drawSolidRect(320, 450, 100, 22, "#d6453d");
        drawSolidRect(880, 330, 80, 22, "#d6453d");
        drawSolidRect(540, 650, 140, 22, "#d6453d");

        // Grüne Speed-Booster (Trampolin-Impulse)
        drawSolidRect(100, 420, 80, 24, "#2fb457");
        drawSolidRect(720, 120, 60, 24, "#2fb457");

        // Blaue verschiebbare Kiste & Orange Gegner
        drawSolidRect(520, 220, 48, 48, "#2a6df4");
        drawCircle(340, 260, 18, "#e8590c");
        drawCircle(880, 540, 18, "#e8590c");

        // 🌀 Genau 1 Vortex-Portal (Schleudert Dino durch die Wand in die Schatzkammer!)
        // Steht in der Mitte des Labyrinths – NICHT am Anfang!
        drawPortal(580, 490, 40, 68);

        // Dino-Eier
        drawEgg(120, 600);
        drawEgg(340, 100);
        drawEgg(600, 250);
        drawEgg(1120, 200);
        drawEgg(900, 620);

        setStartPos({ x: 90, y: 90 });
        setGoalPos({ x: 1160, y: 600 });
      } else if (choice === 1) {
        // Labyrinth 2: Die 4 Tempel-Kammern mit Raum-Portalen (fern vom Start)
        drawSolidRect(620, 20, 24, 300, "#1d1d24");
        drawSolidRect(620, 400, 24, 300, "#1d1d24");
        drawSolidRect(20, 340, 520, 24, "#1d1d24");
        drawSolidRect(720, 340, 540, 24, "#1d1d24");

        drawSolidRect(200, 140, 160, 24, "#1d1d24");
        drawSolidRect(200, 520, 160, 24, "#1d1d24");
        drawSolidRect(880, 140, 160, 24, "#1d1d24");
        drawSolidRect(880, 520, 160, 24, "#1d1d24");

        drawSolidRect(380, 310, 80, 22, "#d6453d");
        drawSolidRect(800, 370, 80, 22, "#d6453d");

        drawSolidRect(570, 160, 34, 70, "#2fb457");
        drawSolidRect(650, 520, 34, 70, "#2fb457");

        drawCircle(300, 240, 18, "#e8590c");
        drawCircle(960, 460, 18, "#e8590c");

        // Portale verbinden Kammer 1 und Kammer 4 (Fern vom Start!)
        drawPortal(440, 180, 38, 68);
        drawPortal(1060, 500, 38, 68);

        drawEgg(240, 240);
        drawEgg(240, 600);
        drawEgg(1000, 220);
        drawEgg(1000, 600);

        setStartPos({ x: 90, y: 90 });
        setGoalPos({ x: 1160, y: 600 });
      } else {
        // Labyrinth 3: Das Wandelnde Schloss mit 1 Vortex
        drawSolidRect(200, 120, 840, 24, "#1d1d24");
        drawSolidRect(200, 240, 24, 400, "#1d1d24");
        drawSolidRect(320, 240, 720, 24, "#1d1d24");
        drawSolidRect(1020, 240, 24, 380, "#1d1d24");
        drawSolidRect(320, 360, 24, 260, "#1d1d24");
        drawSolidRect(440, 360, 480, 24, "#1d1d24");
        drawSolidRect(440, 480, 480, 24, "#1d1d24");

        drawSolidRect(600, 210, 80, 24, "#d6453d");
        drawSolidRect(500, 650, 120, 22, "#d6453d");

        drawSolidRect(100, 400, 80, 24, "#2fb457");
        drawCircle(700, 420, 18, "#e8590c");

        // Genau 1 Vortex-Portal in der Mitte
        drawPortal(640, 520, 38, 68);

        drawEgg(120, 240);
        drawEgg(520, 180);
        drawEgg(840, 300);
        drawEgg(640, 420);

        setStartPos({ x: 90, y: 90 });
        setGoalPos({ x: 1160, y: 200 });
      }
    } else {
      // 🏃‍♂️ JUMP 'N' RUN MODUS (Platformer)
      if (choice === 0) {
        // Layout 1: Canyons & Himmelsinseln (1 einzelnes Vortex-Portal statt 2!)
        drawSolidRect(30, 580, 320, 120, "#1d1d24");
        drawSolidRect(940, 520, 310, 180, "#1d1d24");

        drawSolidRect(260, 440, 180, 28, "#1d1d24");
        drawSolidRect(480, 340, 200, 28, "#1d1d24");
        drawSolidRect(740, 260, 180, 28, "#1d1d24");
        drawSolidRect(620, 480, 180, 28, "#1d1d24");

        drawSolidRect(360, 560, 140, 25, "#8b5a2b");

        // Trampoline für den weiten Sprung
        drawSolidRect(220, 560, 90, 20, "#2fb457");
        drawSolidRect(680, 460, 80, 20, "#2fb457");

        // Lava im Tal
        drawSolidRect(360, 680, 560, 35, "#d6453d");

        drawSolidRect(510, 290, 48, 48, "#2a6df4");
        drawCircle(820, 245, 18, "#e8590c");

        // 🌀 Genau 1 Vortex-Katapult-Portal in der Mitte! (NICHT am Anfang!)
        // Katapultiert Dino hoch zu den schwebenden Himmels-Eiern
        drawPortal(640, 440, 38, 70);

        drawEgg(340, 390);
        drawEgg(570, 290);
        drawEgg(780, 210);
        drawEgg(1050, 470);

        setStartPos({ x: 120, y: 540 });
        setGoalPos({ x: 1120, y: 470 });
      } else if (choice === 1) {
        // Layout 2: Stufen-Pyramide & Vulkanfelsen (Portale weit weg vom Start!)
        drawSolidRect(30, 620, 360, 90, "#1d1d24");
        drawSolidRect(880, 620, 370, 90, "#1d1d24");
        drawSolidRect(400, 680, 470, 35, "#d6453d");

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

        // Portale: Oben in der Pyramide & unten rechts (Fern vom Start bei x:120!)
        drawPortal(460, 240, 38, 70);
        drawPortal(1140, 540, 38, 70);

        drawEgg(160, 440);
        drawEgg(470, 230);
        drawEgg(780, 170);
        drawEgg(1080, 570);

        setStartPos({ x: 120, y: 580 });
        setGoalPos({ x: 1040, y: 290 });
      } else {
        // Layout 3: Tal der Brücken mit 1 Vortex-Katapult
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

        // 🌀 Genau 1 Vortex-Portal (Schleudert Dino über die Schlucht!)
        drawPortal(530, 290, 38, 70);

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
      activeMode === "rpg_labyrinth"
        ? "🧭 Neues RPG-Labyrinth gezeichnet! (4-Wege-Steuerung)"
        : isJungle
        ? "🌴 Dschungel-Level gezeichnet! (Wind & Lianen)"
        : "🎲 Neues Jump 'n' Run Level gezeichnet!"
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
          {onOpenGameMode && (
            <button
              className="button button-secondary"
              type="button"
              onClick={onOpenGameMode}
              title="Spielmodus (Jump 'n' Run oder 4-Wege Labyrinth) und Welt-Hintergrund wählen"
              style={{
                backgroundColor: "#2e3b56",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              {gameMode === "rpg_labyrinth" ? "🧭 Labyrinth" : "🏃 Jump 'n' Run"}
            </button>
          )}

          {onOpenSettings && (
            <button
              className="button button-secondary"
              type="button"
              onClick={onOpenSettings}
              title="Audio, Soundeffekte, Controller & Offline-Speicher"
              style={{
                backgroundColor: "#253048",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              ⚙️ Einstellungen
            </button>
          )}

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

        <div className="tool-group zoom-group" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button
            type="button"
            className="tool-btn-marker"
            onClick={fitToScreen}
            title="Leinwand automatisch optimal an den Laptop-Bildschirm anpassen"
            style={{ fontSize: "0.8rem", padding: "6px 9px", background: "#3b4252" }}
          >
            🔍 Anpassen ({Math.round(zoom * 100)}%)
          </button>
          <button
            type="button"
            className="tool-btn"
            style={{ width: 34, height: 34, fontSize: "1rem" }}
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
            title="Vergrößern (+)"
          >
            +
          </button>
          <button
            type="button"
            className="tool-btn"
            style={{ width: 34, height: 34, fontSize: "1rem" }}
            onClick={() => setZoom((z) => Math.max(0.2, Number((z - 0.1).toFixed(2))))}
            title="Verkleinern (−)"
          >
            −
          </button>
        </div>
      </div>

      <div
        className="canvas-viewport"
        ref={containerRef}
        onWheel={handleWheel}
        style={{
          backgroundColor:
            backgroundTheme === "space"
              ? "#131728"
              : backgroundTheme === "jungle"
              ? "#1d2922"
              : backgroundTheme === "volcano"
              ? "#200e12"
              : "#1a1c23",
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
          <strong>Schwarz:</strong> 🧱 Wände & Böden
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.red.hex }} />
          <strong>Rot:</strong> ⚠️ Stacheln & Gefahren
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.green.hex }} />
          <strong>Grün:</strong> 🍄 Pilz-Trampolin / Bumper
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.blue.hex }} />
          <strong>Blau:</strong> 📦 Holz-Kiste (Schiebbar)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.yellow.hex }} />
          <strong>Gelb:</strong> 🪙 Dino-Ei-Münzen (Sammeln)
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.purple.hex }} />
          <strong>Lila:</strong> 🌀 Portale & Vortex
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.brown.hex }} />
          <strong>Braun:</strong> 🪵 Bewegliche Lifte
        </div>
        <div className="legend-item">
          <span className="legend-pill" style={{ backgroundColor: COLORS.orange.hex }} />
          <strong>Orange:</strong> 🐌 Gegner (Patrouille)
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
