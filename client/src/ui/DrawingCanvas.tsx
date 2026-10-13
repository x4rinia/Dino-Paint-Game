import React, { useEffect, useRef, useState, useCallback } from "react";
import { analyzeDrawing, type Level } from "@sketchquest/shared";
import { GuideModal } from "./GuideModal";
import { saveLevel, importLevelFile, getSetting } from "../storage/db";
import type { BackgroundTheme } from "../game/paper";

const COLOR_TOOLS = ["black", "red", "green", "blue", "yellow", "purple", "brown", "pink", "gray", "eraser"] as const;
type ColorTool = (typeof COLOR_TOOLS)[number];
type Tool = ColorTool;

interface DrawingCanvasProps {
  onPlayLevel: (level: Level, drawingDataUrl: string) => void;
  onBackToMenu: (currentDrawing?: string) => void;
  initialImage?: string;
  backgroundTheme?: BackgroundTheme;
  onBackgroundChange?: (bg: BackgroundTheme) => void;
  gameMode?: "jump_n_run" | "rpg_labyrinth";
  onGameModeChange?: (mode: "jump_n_run" | "rpg_labyrinth") => void;
  onOpenSettings?: () => void;
  onOpenGameMode?: () => void;
  onOpenPhotoScanner?: () => void;
  onOpenLibrary?: () => void;
}

const COLORS: Record<ColorTool, { hex: string; label: string; desc: string }> = {
  black: { hex: "#1d1d24", label: "Schwarz", desc: "Feste Plattformen & Wände" },
  red: { hex: "#d6453d", label: "Rot", desc: "Tödliche Gefahren (Stacheln / Lava)" },
  green: { hex: "#2fb457", label: "Grün", desc: "Trampoline & Sprungflächen" },
  blue: { hex: "#2a6df4", label: "Blau", desc: "Bewegliche Physikblöcke" },
  yellow: { hex: "#f5c518", label: "Gelb", desc: "Sammelobjekte (Dino-Eier)" },
  purple: { hex: "#9b51e0", label: "Lila", desc: "Teleporter-Portale (Beamen oder Vortex-Boost)" },
  brown: { hex: "#8b5a2b", label: "Braun", desc: "Bewegliche Lifte (Fährt waagerecht oder senkrecht)" },
  pink: { hex: "#ec4899", label: "Pink", desc: "🪰 Fliegende Gegner (Patrouille)" },
  gray: { hex: "#71717a", label: "Grau", desc: "🚩 Start (1 Punkt) & Ziel (2 Punkte)" },
  eraser: { hex: "#ffffff", label: "Radierer", desc: "Linien entfernen" },
};

const COLOR_TOOLTIPS: Record<ColorTool, string> = {
  black: "Schwarz: 🧱 Feste Plattformen, Mauern & Böden",
  red: "Rot: ⚠️ Tödliche Gefahren (Stacheln & Lava)",
  green: "Grün: 🍄 Federndes Pilz-Trampolin / Bumper",
  blue: "Blau: 📦 Schiebbare Kiste mit echter Physik",
  yellow: "Gelb: 🥚 Dino-Ei-Münzen zum Einsammeln",
  purple: "Lila: 🌀 Magische Portale & Teleporter",
  brown: "Braun: 🪵 Beweglicher Lift (fährt waagerecht/senkrecht)",
  pink: "Pink: 🦟 Fliegende Gegner (Patrouille)",
  gray: "Grau: 🏁 1 Punkt = Start, 2 Punkte = Start (links) & Ziel (rechts)",
  eraser: "Radiergummi: Löscht gezeichnete Linien",
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
  backgroundTheme = "paper",
  onBackgroundChange,
  gameMode = "jump_n_run",
  onGameModeChange,
  onOpenSettings,
  onOpenGameMode,
  onOpenPhotoScanner,
  onOpenLibrary,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getInitialZoom = () => {
    if (typeof window === "undefined") return 0.85;
    const isMobile = window.innerWidth <= 680;
    if (isMobile) {
      if (window.innerHeight > window.innerWidth) {
        // Hochformat auf Smartphone: 0.55 ist eine angenehme, große Zeichengröße
        return 0.55;
      }
      const scaleX = (window.innerWidth - 16) / 1280;
      const scaleY = (window.innerHeight - 90) / 720;
      return Number(Math.max(0.25, Math.min(scaleX, scaleY, 1.0)).toFixed(2));
    }
    const availW = Math.max(300, window.innerWidth - 32);
    const availH = Math.max(300, window.innerHeight - 170);
    return Number(Math.min(availW / 1280, availH / 720, 1.0).toFixed(2));
  };

  const [tool, setTool] = useState<Tool>("black");
  const [brushSize, setBrushSize] = useState<number>(14);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState<number>(getInitialZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showEditorBurger, setShowEditorBurger] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Start (S) und Ziel (Z) Marker
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [goalPos, setGoalPos] = useState<{ x: number; y: number } | null>(null);

  // Speicher-, Export- & Upload-Zustände für den Editor
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [levelNameInput, setLevelNameInput] = useState("Mein Dino-Level");
  const [saveTheme, setSaveTheme] = useState<BackgroundTheme>(backgroundTheme || "paper");
  const [saveGameMode, setSaveGameMode] = useState<"jump_n_run" | "rpg_labyrinth">(gameMode || "jump_n_run");
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);

  useEffect(() => {
    if (backgroundTheme) setSaveTheme(backgroundTheme);
  }, [backgroundTheme]);

  useEffect(() => {
    if (gameMode) setSaveGameMode(gameMode);
  }, [gameMode]);

  useEffect(() => {
    getSetting<boolean>("tooltips_enabled", true).then(setTooltipsEnabled);
  }, []);
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

  // 🔍 Responsiver Zoom & Skalierung für Smartphone, Laptop- und Desktop-Bildschirme
  const fitToScreen = useCallback((zoomMode?: "fit" | "large") => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth <= 680;
    const padX = isMobile ? 8 : 24;
    const padY = isMobile ? 8 : 24;
    const w = rect.width > 0 ? rect.width : window.innerWidth;
    const h = rect.height > 0 ? rect.height : (window.innerHeight - (isMobile ? 120 : 180));
    const availW = Math.max(200, w - padX);
    const availH = Math.max(200, h - padY);
    const scaleX = availW / CANVAS_WIDTH;
    const scaleY = availH / CANVAS_HEIGHT;

    if (zoomMode === "large") {
      setZoom(0.75);
      setPan({ x: 0, y: 0 });
      return;
    }

    if (zoomMode === "fit") {
      const bestZoom = Math.min(scaleX, scaleY, 1.0);
      setZoom(Number(Math.max(0.2, bestZoom).toFixed(2)));
      setPan({ x: 0, y: 0 });
      return;
    }

    // Auto-Fit beim Laden
    if (isMobile && window.innerHeight > window.innerWidth) {
      // Im Smartphone-Hochformat: 0.55 für großes, bequemes Zeichnen
      setZoom(0.55);
    } else {
      const bestZoom = Math.min(scaleX, scaleY, 1.0);
      setZoom(Number(Math.max(0.2, bestZoom).toFixed(2)));
    }
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const timer = setTimeout(() => fitToScreen(), 40);
    const ro = new ResizeObserver(() => fitToScreen());
    ro.observe(el);
    const onResize = () => fitToScreen();
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [fitToScreen]);

  // Starter-Level für Erststart des Editors zeichnen (Boden, Plattformen, Trampolin, Eier, Ziel)
  const drawStarterLevel = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Feste schwarze Böden & Plattformen
    ctx.fillStyle = "#1d1d24";
    ctx.fillRect(40, 620, 1200, 36); // Durchgehender Boden
    ctx.fillRect(360, 510, 180, 24); // Plattform 1
    ctx.fillRect(620, 410, 180, 24); // Plattform 2
    ctx.fillRect(880, 310, 260, 24); // Zielplattform

    // 2. Grünes Trampolin (Bouncer)
    ctx.fillStyle = "#2fb457";
    ctx.fillRect(230, 595, 80, 25);

    // 3. Rote Gefahrenzone (Lava)
    ctx.fillStyle = "#d6453d";
    ctx.fillRect(570, 605, 90, 15);

    // 4. Gelbe Dino-Eier (Sammelobjekte)
    ctx.fillStyle = "#f5c518";
    const drawEgg = (cx: number, cy: number) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    drawEgg(450, 475);
    drawEgg(710, 375);
    drawEgg(960, 275);

    // 5. Ziel (Flagge)
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(1060, 230, 40, 80);
  };

  // Initialisieren & weißer Hintergrund / Starter-Level
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
      // Erst-Start des Editors: Zeichne ein spielbares Starter-Level,
      // damit auf dem Smartphone nicht einfach ein leeres weißes Nichts da ist!
      drawStarterLevel(ctx);
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

    if (gameMode === "rpg_labyrinth") {
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

        // Blaue verschiebbare Kiste & Pinke Gegner
        drawSolidRect(520, 220, 48, 48, "#2a6df4");
        drawCircle(340, 260, 18, "#ec4899");
        drawCircle(880, 540, 18, "#ec4899");

        // 🌀 Genau 1 Vortex-Portal (Schleudert Dino durch die Wand in die Schatzkammer!)
        // Steht in der Mitte des Labyrinths – NICHT am Anfang!
        drawPortal(580, 490, 40, 68);

        // Dino-Eier
        drawEgg(120, 600);
        drawEgg(340, 100);
        drawEgg(600, 250);
        drawEgg(1120, 200);
        drawEgg(900, 620);

        // 🚩 Start (1. grauer Punkt) & 🏁 Ziel (2. grauer Punkt)
        drawCircle(90, 90, 16, "#71717a");
        drawCircle(1160, 600, 20, "#71717a");
        setStartPos(null);
        setGoalPos(null);
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

        drawCircle(300, 240, 18, "#ec4899");
        drawCircle(960, 460, 18, "#ec4899");

        // Portale verbinden Kammer 1 und Kammer 4 (Fern vom Start!)
        drawPortal(440, 180, 38, 68);
        drawPortal(1060, 500, 38, 68);

        drawEgg(240, 240);
        drawEgg(240, 600);
        drawEgg(1000, 220);
        drawEgg(1000, 600);

        // 🚩 Start & 🏁 Ziel als graue Punkte
        drawCircle(90, 90, 16, "#71717a");
        drawCircle(1160, 600, 20, "#71717a");
        setStartPos(null);
        setGoalPos(null);
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
        drawCircle(700, 420, 18, "#ec4899");

        // Genau 1 Vortex-Portal in der Mitte
        drawPortal(640, 520, 38, 68);

        drawEgg(120, 240);
        drawEgg(520, 180);
        drawEgg(840, 300);
        drawEgg(640, 420);

        // 🚩 Start & 🏁 Ziel als graue Punkte
        drawCircle(90, 90, 16, "#71717a");
        drawCircle(1160, 200, 20, "#71717a");
        setStartPos(null);
        setGoalPos(null);
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
        drawCircle(820, 245, 18, "#ec4899");

        // 🌀 Genau 1 Vortex-Katapult-Portal in der Mitte! (NICHT am Anfang!)
        // Katapultiert Dino hoch zu den schwebenden Himmels-Eiern
        drawPortal(640, 440, 38, 70);

        drawEgg(340, 390);
        drawEgg(570, 290);
        drawEgg(780, 210);
        drawEgg(1050, 470);

        // 🚩 Start & 🏁 Ziel als graue Punkte
        drawCircle(120, 540, 16, "#71717a");
        drawCircle(1120, 470, 20, "#71717a");
        setStartPos(null);
        setGoalPos(null);
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

        drawCircle(440, 260, 18, "#ec4899");
        drawCircle(1050, 315, 18, "#ec4899");

        // Portale: Oben in der Pyramide & unten rechts (Fern vom Start bei x:120!)
        drawPortal(460, 240, 38, 70);
        drawPortal(1140, 540, 38, 70);

        drawEgg(160, 440);
        drawEgg(470, 230);
        drawEgg(780, 170);
        drawEgg(1080, 570);

        // 🚩 Start & 🏁 Ziel als graue Punkte
        drawCircle(120, 580, 16, "#71717a");
        drawCircle(1040, 290, 20, "#71717a");
        setStartPos(null);
        setGoalPos(null);
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
        drawCircle(640, 555, 18, "#ec4899");

        // 🌀 Genau 1 Vortex-Portal (Schleudert Dino über die Schlucht!)
        drawPortal(530, 290, 38, 70);

        drawEgg(270, 340);
        drawEgg(630, 280);
        drawEgg(940, 290);
        drawEgg(600, 530);

        // 🚩 Start & 🏁 Ziel als graue Punkte
        drawCircle(110, 490, 16, "#71717a");
        drawCircle(1080, 470, 20, "#71717a");
        setStartPos(null);
        setGoalPos(null);
      }
    }

    saveHistory();
    setSaveToast(
      gameMode === "rpg_labyrinth"
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
    const cleanName = (levelNameInput || "mein_dino_level").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `${cleanName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setSaveToast("✓ PNG heruntergeladen!");
    setTimeout(() => setSaveToast(null), 3000);
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

      const levelToSave: Level = {
        ...result.level,
        gameMode: saveGameMode,
        theme: saveTheme,
      };

      await saveLevel({
        name: nameToUse,
        level: levelToSave,
        thumbnail: thumbUrl,
        originalImage: dataUrl,
      });

      if (onGameModeChange && saveGameMode !== gameMode) {
        onGameModeChange(saveGameMode);
      }
      if (onBackgroundChange && saveTheme !== backgroundTheme) {
        onBackgroundChange(saveTheme);
      }

      setSaveToast("✓ In Bibliothek gespeichert!");
      setTimeout(() => setSaveToast(null), 3500);
      setShowSaveModal(false);
    } catch (err) {
      alert("Fehler beim Speichern: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (showClearConfirm) {
          e.preventDefault();
          clearCanvas();
        } else if (showSaveModal) {
          if ((document.activeElement as HTMLElement)?.tagName !== "INPUT") {
            e.preventDefault();
            void handleSaveToLibrary();
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showClearConfirm, showSaveModal]);

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
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            if (baseName) setLevelNameInput(baseName);
            setSaveToast(`✓ Bild "${file.name}" geladen!`);
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
          gameMode: (gameMode as any) || "jump_n_run",
          theme: (backgroundTheme as any) || "paper",
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
        <button className="button button-secondary studio-back-btn" type="button" onClick={handleBackToMenu}>
          ◀ Menü
        </button>
        <div className="studio-title">
          <h2>Level-Editor</h2>
          <span className="studio-subtitle">Zeichne mit allen 9 Spielfarben deine Welt</span>
        </div>
        <div className="studio-header-actions">
          {/* Desktop-Aktionen (auf Bildschirmen > 680px) */}
          <div className="studio-actions-desktop">
            {onOpenGameMode && (
              <button
                className="button studio-mode-badge"
                type="button"
                onClick={onOpenGameMode}
                title="Spielmodus (Jump 'n' Run oder 4-Wege Labyrinth) und Welt-Hintergrund wählen"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "4px 12px",
                  lineHeight: 1.15,
                  backgroundColor: "#1e293b",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Modus:
                </span>
                <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "#4ade80" }}>
                  {gameMode === "rpg_labyrinth" ? "🧭 4-Wege Labyrinth" : "🏃 Jump 'n' Run"}
                </span>
              </button>
            )}

            <label
              className="button button-secondary"
              title="PNG-Bild vom Computer in den Editor laden"
              style={{
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor: "#2e3b56",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              📤 PNG Upload
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*,.json"
                style={{ display: "none" }}
                onChange={handleUploadFile}
              />
            </label>

            <button
              className="button button-secondary"
              type="button"
              onClick={exportPng}
              title="Aktuelle Zeichnung als PNG-Bild herunterladen"
              style={{
                backgroundColor: "#2e3b56",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                fontSize: "0.88rem",
                fontWeight: 600,
              }}
            >
              🖼️ PNG Download
            </button>

            {onOpenPhotoScanner && (
              <button
                className="button button-secondary"
                type="button"
                onClick={onOpenPhotoScanner}
                title="Foto einer Papierzeichnung aufnehmen oder Bild scannen"
                style={{
                  backgroundColor: "#2e3b56",
                  color: "#e2e8f0",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                }}
              >
                📸 Foto scannen
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
              🎲 Zufall
            </button>

            <button
              className="button button-secondary"
              type="button"
              onClick={() => setShowGuide(true)}
              title="Zeichen-Anleitung & Farbbedeutungen"
            >
              📖 Anleitung
            </button>

            <button
              className="button button-save"
              type="button"
              onClick={() => setShowSaveModal(true)}
              disabled={isSaving}
              title="Level mit Name, Spielwelt & Modus in der Bibliothek sichern"
            >
              {saveToast ? saveToast : "💾 Level speichern"}
            </button>
          </div>

          {/* Hauptaktion: ▶ Jetzt spielen (bleibt auf Mobile & Desktop sofort griffbereit) */}
          <button
            className="button button-play-big"
            type="button"
            onClick={playNow}
            disabled={analyzing}
            title="Zeichnung analysieren und sofort losspielen"
          >
            {analyzing ? "Analysiere…" : "▶ Jetzt spielen!"}
          </button>

          {/* Smartphone Editor Burger-Button (auf Bildschirmen <= 680px) */}
          <button
            className="button button-mobile-burger button-editor-mobile-burger"
            type="button"
            onClick={() => setShowEditorBurger(true)}
            aria-label="Editor-Menü öffnen"
            title="Editor-Menü öffnen"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Unsichtbarer File Input für Smartphone-Upload aus dem Burger-Menü */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*,.json"
        style={{ display: "none" }}
        onChange={handleUploadFile}
      />

      {/* Smartphone Editor Burger Drawer */}
      {showEditorBurger && (
        <div className="modal-backdrop mobile-burger-backdrop" onClick={() => setShowEditorBurger(false)}>
          <div className="mobile-burger-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-burger-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.4rem" }}>🎨</span>
                <strong style={{ fontSize: "1.05rem", color: "#f8fafc" }}>Editor-Menü</strong>
              </div>
              <button
                type="button"
                className="button button-burger-close"
                onClick={() => setShowEditorBurger(false)}
                aria-label="Menü schließen"
              >
                ✕
              </button>
            </div>

            <div className="mobile-burger-links">
              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  setShowSaveModal(true);
                }}
              >
                <span className="burger-item-icon">💾</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">Level speichern</span>
                  <span className="burger-item-desc">In deiner Bibliothek sichern</span>
                </div>
              </button>

              {onOpenGameMode && (
                <button
                  type="button"
                  className="mobile-burger-item"
                  onClick={() => {
                    setShowEditorBurger(false);
                    onOpenGameMode();
                  }}
                >
                  <span className="burger-item-icon">🧭</span>
                  <div className="burger-item-text">
                    <span className="burger-item-title">
                      Modus: {gameMode === "rpg_labyrinth" ? "Labyrinth" : "Jump 'n' Run"}
                    </span>
                    <span className="burger-item-desc">Spielmodus & Welt-Thema anpassen</span>
                  </div>
                </button>
              )}

              {onOpenPhotoScanner && (
                <button
                  type="button"
                  className="mobile-burger-item"
                  onClick={() => {
                    setShowEditorBurger(false);
                    onOpenPhotoScanner();
                  }}
                >
                  <span className="burger-item-icon">📸</span>
                  <div className="burger-item-text">
                    <span className="burger-item-title">Foto scannen</span>
                    <span className="burger-item-desc">Papierzeichnung abfotografieren</span>
                  </div>
                </button>
              )}

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  fileInputRef.current?.click();
                }}
              >
                <span className="burger-item-icon">📤</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">PNG / Bild hochladen</span>
                  <span className="burger-item-desc">Vom Smartphone-Speicher laden</span>
                </div>
              </button>

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  exportPng();
                }}
              >
                <span className="burger-item-icon">🖼️</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">PNG Bild herunterladen</span>
                  <span className="burger-item-desc">Zeichnung auf Gerät speichern</span>
                </div>
              </button>

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  generateRandomLevel();
                }}
              >
                <span className="burger-item-icon">🎲</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">Zufallslevel</span>
                  <span className="burger-item-desc">Bunte Strecke generieren</span>
                </div>
              </button>

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  setShowGuide(true);
                }}
              >
                <span className="burger-item-icon">📖</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">Zeichen-Anleitung</span>
                  <span className="burger-item-desc">Farbbedeutungen & Regeln</span>
                </div>
              </button>

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  fitToScreen();
                }}
              >
                <span className="burger-item-icon">🔍</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">Leinwand anpassen</span>
                  <span className="burger-item-desc">Optimal auf Bildschirmgröße zoomen</span>
                </div>
              </button>

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  setShowClearConfirm(true);
                }}
              >
                <span className="burger-item-icon">🗑️</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">Alles löschen</span>
                  <span className="burger-item-desc">Zeichenblatt komplett leeren</span>
                </div>
              </button>

              <button
                type="button"
                className="mobile-burger-item"
                onClick={() => {
                  setShowEditorBurger(false);
                  handleBackToMenu();
                }}
              >
                <span className="burger-item-icon">◀</span>
                <div className="burger-item-text">
                  <span className="burger-item-title">Zurück zum Menü</span>
                  <span className="burger-item-desc">Editor verlassen</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

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
              title={tooltipsEnabled ? COLOR_TOOLTIPS[t] : undefined}
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

        <div className="tool-group zoom-group" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button
            type="button"
            className="tool-btn-marker"
            onClick={() => fitToScreen("fit")}
            title="Ganzes Level anzeigen"
            style={{ fontSize: "0.8rem", padding: "6px 9px", background: "#3b4252" }}
          >
            🔍 Übersicht ({Math.round(zoom * 100)}%)
          </button>
          <button
            type="button"
            className="tool-btn-marker"
            onClick={() => fitToScreen("large")}
            title="Großes Zeichenblatt (75%)"
            style={{ fontSize: "0.8rem", padding: "6px 9px", background: "#059669", color: "#ffffff" }}
          >
            🔎 Groß
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

      {/* Smartphone Orientierungshinweis */}
      <div className="mobile-orientation-hint">
        <span>🔄 Tipp: Smartphone <strong>quer halten</strong> für riesigen Vollbild-Zeichenspaß!</span>
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


      {showClearConfirm && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3>Zeichnung löschen?</h3>
            <p>Möchtest du das gesamte Zeichenblatt wirklich leeren?</p>
            <div className="modal-actions">
              <button className="button button-danger" type="button" autoFocus onClick={clearCanvas}>
                Ja, alles löschen (Enter)
              </button>
              <button className="button button-secondary" type="button" onClick={() => setShowClearConfirm(false)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="modal-backdrop" onClick={() => setShowSaveModal(false)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, background: "#1e222d", color: "#f8fafc", borderRadius: 16, border: "1px solid #334155", padding: "24px" }}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.35rem", display: "flex", alignItems: "center", gap: "8px" }}>
              💾 Level in Bibliothek speichern
            </h3>
            <p style={{ marginTop: 0, marginBottom: 14, color: "#94a3b8", fontSize: "0.92rem", lineHeight: 1.45 }}>
              Gib deinem Level einen Namen und lege fest, welcher Hintergrund und Spielmodus verwendet werden soll:
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Name des Levels:
              </label>
              <input
                type="text"
                value={levelNameInput}
                onChange={(e) => setLevelNameInput(e.target.value)}
                className="form-input"
                placeholder="Name des Levels (z.B. Lava-Grotte)"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "1rem",
                  borderRadius: "8px",
                  border: "2px solid #3c4254",
                  background: "#11141c",
                  color: "#fff",
                  boxSizing: "border-box",
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveToLibrary();
                }}
              />
            </div>

            {/* Hintergrund / Spielwelt-Thema */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Hintergrund / Thema:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { id: "paper", label: "📝 Papier", desc: "Klassischer Notizblock" },
                  { id: "jungle", label: "🌴 Dschungel", desc: "Wind & Lianen" },
                  { id: "space", label: "🚀 Kosmos", desc: "Schwerelos & Sterne" },
                  { id: "volcano", label: "🌋 Vulkan", desc: "Doppelsprung & Glut" },
                ].map((th) => {
                  const isSelected = saveTheme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setSaveTheme(th.id as BackgroundTheme)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid #38bdf8" : "1px solid #334155",
                        background: isSelected ? "#1e293b" : "#131722",
                        color: "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        boxShadow: isSelected ? "0 0 10px rgba(56, 189, 248, 0.35)" : "none",
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>{th.label}</span>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{th.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spielmodus */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.88rem", fontWeight: 700, color: "#cbd5e1", marginBottom: 6 }}>
                Spielmodus:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { id: "jump_n_run", label: "🏃 Jump 'n' Run", desc: "Hüpfen & Schieben" },
                  { id: "rpg_labyrinth", label: "🧭 4-Wege Labyrinth", desc: "Draufsicht & Rätsel" },
                ].map((m) => {
                  const isSelected = saveGameMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSaveGameMode(m.id as "jump_n_run" | "rpg_labyrinth")}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid #4ade80" : "1px solid #334155",
                        background: isSelected ? "#142d1f" : "#131722",
                        color: "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        boxShadow: isSelected ? "0 0 10px rgba(74, 222, 128, 0.35)" : "none",
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>{m.label}</span>
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{m.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={exportPng}
                title="Aktuelle Zeichnung als PNG-Bild sichern"
                style={{ fontSize: "0.88rem" }}
              >
                🖼️ Als PNG sichern
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="button button-save"
                  type="button"
                  onClick={() => handleSaveToLibrary()}
                  disabled={isSaving}
                  style={{ fontWeight: 700 }}
                >
                  {isSaving ? "Speichere…" : "Speichern ✓ (Enter)"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
