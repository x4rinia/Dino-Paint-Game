import React, { useEffect, useRef, useState } from "react";
import { gameEvents, type Level } from "@sketchquest/shared";
import { easyLevel } from "../game/testLevels";
import { mountGame } from "../game";
import { DrawingCanvas } from "./DrawingCanvas";
import { PhotoCapture } from "./PhotoCapture";
import { LevelLibrary } from "./LevelLibrary";
import { SettingsModal } from "./SettingsModal";
import { GameModeModal } from "./GameModeModal";
import { TvModal } from "./TvModal";
import { InstallPromptModal } from "./InstallPromptModal";
import { GuideModal } from "./GuideModal";
import { useGamepadNav } from "./useGamepadNav";
import { initStorage, saveLevel, getSetting, setSetting } from "../storage/db";
import { setMusicEnabled, installAudioUnlock, startBgMusic, pauseBgMusic, isMusicPlaying } from "../game/audio";
import { narrator } from "../game/narrator";
import { BACKGROUND_THEMES, type BackgroundTheme } from "../game/paper";
import type { GameMode } from "../game/Player";
import { resolveLevelById, saveWorldBestTime, formatWorldTime, type World } from "../storage/worlds";
import "./App.css";

type Screen = "menu" | "draw" | "camera" | "library" | "playing";

/** Rendert ein Level ohne vorhandenes PNG-Original als sauberes Bild auf einen Canvas */
function renderLevelGeometryToDataUrl(level: Level): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 1280, 720);

  // 1. Schwarz: Plattformen
  ctx.fillStyle = "#1d1d24";
  for (const p of level.platforms) {
    ctx.fillRect((p.x / 1000) * 1280, (p.y / 1000) * 720, (p.w / 1000) * 1280, (p.h / 1000) * 720);
  }

  // 2. Rot: Gefahren
  ctx.fillStyle = "#d6453d";
  for (const h of level.hazards) {
    ctx.fillRect((h.x / 1000) * 1280, (h.y / 1000) * 720, (h.w / 1000) * 1280, (h.h / 1000) * 720);
  }

  // 3. Grün: Trampoline
  ctx.fillStyle = "#2fb457";
  for (const b of level.bouncers ?? []) {
    ctx.fillRect((b.x / 1000) * 1280, (b.y / 1000) * 720, (b.w / 1000) * 1280, (b.h / 1000) * 720);
  }

  // 4. Blau: Physikblöcke
  ctx.fillStyle = "#2a6df4";
  for (const m of level.movers ?? []) {
    ctx.fillRect((m.x / 1000) * 1280, (m.y / 1000) * 720, (m.w / 1000) * 1280, (m.h / 1000) * 720);
  }

  // 5. Gelb: Dino-Eier (unterstützt collectibles & coins)
  ctx.fillStyle = "#f5c518";
  const previewCollectibles = [
    ...(level.collectibles ?? []),
    ...(level.coins ?? []).map((coin) => ({ x: coin.x, y: coin.y, w: 24, h: 24 })),
  ];
  for (const c of previewCollectibles) {
    const cw = c.w ?? 24;
    const ch = c.h ?? 24;
    const cx = ((c.x + cw / 2) / 1000) * 1280;
    const cy = ((c.y + ch / 2) / 1000) * 720;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // 6. Lila: Teleporter-Portale
  ctx.fillStyle = "#9b51e0";
  for (const t of level.teleporters ?? []) {
    ctx.fillRect((t.x / 1000) * 1280, (t.y / 1000) * 720, ((t.w ?? 35) / 1000) * 1280, ((t.h ?? 55) / 1000) * 720);
  }

  // 7. Braun: Bewegliche Lifte
  ctx.fillStyle = "#8b5a2b";
  for (const mp of level.movingPlatforms ?? []) {
    ctx.fillRect((mp.x / 1000) * 1280, (mp.y / 1000) * 720, (mp.w / 1000) * 1280, (mp.h / 1000) * 720);
  }

  // 8. Pink: Fliegende Gegner (Insekten)
  ctx.fillStyle = "#ec4899";
  for (const e of level.enemies ?? []) {
    ctx.beginPath();
    ctx.arc((e.x / 1000) * 1280, (e.y / 1000) * 720, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
}

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [currentLevel, setCurrentLevel] = useState<Level | null>(null);
  const [currentDrawingUrl, setCurrentDrawingUrl] = useState<string | undefined>(undefined);
  const [initialDrawingForStudio, setInitialDrawingForStudio] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [showGameModeModal, setShowGameModeModal] = useState(false);
  const [showTvModal, setShowTvModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // TV-Modus
  const [tvMode, setTvModeState] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSmartphone, setIsSmartphone] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundTheme>("paper");
  const [gameMode, setGameModeState] = useState<GameMode>("jump_n_run");
  const [gamepadSwapAB, setGamepadSwapAB] = useState(false);

  // Kampagnen-System für Welten (Zufälliger Start, Zeiterfassung & Anfangs-/Endsequenzen)
  const [worldCampaign, setWorldCampaign] = useState<{
    world: World;
    sequenceOrder: number[];
    currentStep: number;
    startTime: number;
  } | null>(null);
  const [worldIntroCampaign, setWorldIntroCampaign] = useState<{
    world: World;
    sequenceOrder: number[];
  } | null>(null);
  const [worldOutroStatus, setWorldOutroStatus] = useState<{
    world: World;
    totalTimeMs: number;
    isNewRecord: boolean;
    previousBest?: number;
  } | null>(null);
  const [campaignTimerMs, setCampaignTimerMs] = useState(0);

  useEffect(() => {
    if (!worldCampaign || screen !== "playing") {
      setCampaignTimerMs(0);
      return;
    }
    const interval = setInterval(() => {
      setCampaignTimerMs(Date.now() - worldCampaign.startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [worldCampaign, screen]);

  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const gameHandleRef = useRef<ReturnType<typeof mountGame> | null>(null);

  // Initialisiere IndexedDB & Einstellungen beim Start
  useEffect(() => {
    initStorage().catch(console.error);

    // Audio-Freischaltung für das gesamte Spiel & Sofortstart
    installAudioUnlock();
    startBgMusic();

    getSetting<BackgroundTheme>("selected_background", "paper").then((bg) => {
      setSelectedBackground(bg);
    });

    getSetting<boolean>("gamepad_swap_ab", false).then((swapped) => {
      setGamepadSwapAB(swapped);
    });

    getSetting<GameMode>("game_mode", "jump_n_run").then((mode) => {
      setGameModeState(mode);
    });

    getSetting<boolean>("tv_mode", false).then((val) => {
      setTvModeState(val);
    });

    getSetting<boolean>("music_enabled", true).then((enabled) => {
      setMusicEnabled(enabled);
    });

    getSetting<boolean>("narrator_enabled", false).then((enabled) => {
      narrator.setEnabled(enabled);
    });

    // Prüfe ob App bereits installiert ist
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsStandalone(true);
    }

    // Smartphone-Erkennung
    const checkIsPhone = () => {
      const isNarrow = window.innerWidth <= 680;
      const isMobileUA = /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent) && !/iPad/i.test(navigator.userAgent);
      setIsSmartphone(isNarrow || isMobileUA);
    };
    checkIsPhone();
    window.addEventListener("resize", checkIsPhone);

    // Fange Installationsereignis ab
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("resize", checkIsPhone);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const toggleTvMode = async () => {
    const nextVal = !tvMode;
    setTvModeState(nextVal);
    await setSetting("tv_mode", nextVal);
    if (!nextVal) {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }
    } else {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // ignore
      }
    }
  };

  // Gamepad-Navigation in den Menüs
  useGamepadNav({
    enabled: screen === "menu" && !showSettings && !showTvModal && !showInstallModal,
    swapAB: gamepadSwapAB,
    onBack: () => {
      if (showSettings) setShowSettings(false);
      else if (showTvModal) setShowTvModal(false);
      else if (showInstallModal) setShowInstallModal(false);
    },
    onStart: () => setShowSettings(true),
  });

  // Spiel mounten wenn im Playing-Screen (tvMode entkoppelt, damit TV-Umschaltung das Spiel nicht neu startet)
  useEffect(() => {
    if (screen === "playing" && currentLevel && gameContainerRef.current) {
      if (gameHandleRef.current) {
        gameHandleRef.current.destroy();
      }
      const handle = mountGame(gameContainerRef.current, {
        tvMode,
        background: selectedBackground,
        gameMode,
        gamepadSwapAB,
      });
      gameHandleRef.current = handle;
      handle.loadLevel(currentLevel);

      return () => {
        handle.destroy();
        gameHandleRef.current = null;
      };
    }
  }, [screen, currentLevel, selectedBackground, gameMode, gamepadSwapAB]);

  // TV-Modus dynamisch weiterleiten ohne das Spiel neu zu starten
  useEffect(() => {
    if (gameHandleRef.current) {
      gameHandleRef.current.setTvMode(tvMode);
    }
  }, [tvMode]);

  const handleEditCurrentLevel = () => {
    if (!currentLevel) return;
    if (gameHandleRef.current) {
      gameHandleRef.current.destroy();
      gameHandleRef.current = null;
    }
    const drawingToUse = currentDrawingUrl || renderLevelGeometryToDataUrl(currentLevel);
    setInitialDrawingForStudio(drawingToUse);
    setCurrentDrawingUrl(drawingToUse);
    setScreen("draw");
  };

  useEffect(() => {
    const unsub = gameEvents.on("editLevel", () => {
      handleEditCurrentLevel();
    });
    return unsub;
  }, [currentLevel, currentDrawingUrl]);

  // Sieg in einem Level: Kampagnen-Fortschritt oder Welt-Vollendung
  useEffect(() => {
    const unsub = gameEvents.on("win", async () => {
      if (worldCampaign) {
        const nextStep = worldCampaign.currentStep + 1;
        if (nextStep < worldCampaign.sequenceOrder.length) {
          // Nächstes zufälliges Level in der Welt laden
          const nextSlot = worldCampaign.sequenceOrder[nextStep];
          const nextLevelId = worldCampaign.world.levelIds[nextSlot];
          const nextLevel = nextLevelId ? await resolveLevelById(nextLevelId) : null;
          if (nextLevel) {
            setWorldCampaign((prev) => (prev ? { ...prev, currentStep: nextStep } : null));
            handleStartPlaying(nextLevel, (nextLevel as any).originalImage);
          } else {
            setScreen("library");
            setWorldCampaign(null);
          }
        } else {
          // 🎉 WELT VOLLENDET! Triumph-Endsequenz & Rekord-Speicherung
          const totalTimeMs = Date.now() - worldCampaign.startTime;
          const result = await saveWorldBestTime(worldCampaign.world.id, totalTimeMs);
          setWorldOutroStatus({
            world: worldCampaign.world,
            totalTimeMs,
            isNewRecord: result.isNewRecord,
            previousBest: result.previousBest,
          });
          setWorldCampaign(null);
        }
      }
    });
    return unsub;
  }, [worldCampaign]);

  const handleStartWorldCampaign = (world: World, sequenceOrder: number[]) => {
    setWorldIntroCampaign({ world, sequenceOrder });
  };

  const handleConfirmStartCampaign = async () => {
    if (!worldIntroCampaign) return;
    const { world, sequenceOrder } = worldIntroCampaign;
    setWorldIntroCampaign(null);
    setWorldOutroStatus(null);

    const firstSlot = sequenceOrder[0];
    const firstLevelId = world.levelIds[firstSlot];
    const firstLevel = firstLevelId ? await resolveLevelById(firstLevelId) : null;
    if (!firstLevel) {
      alert("Fehler beim Laden des Levels!");
      return;
    }
    const levelMode = (firstLevel as any).gameMode || "jump_n_run";
    const levelTheme = (firstLevel as any).theme || world.theme || "jungle";
    setGameModeState(levelMode);
    setSelectedBackground(levelTheme);

    setWorldCampaign({
      world,
      sequenceOrder,
      currentStep: 0,
      startTime: Date.now(),
    });
    handleStartPlaying(firstLevel, (firstLevel as any).originalImage);
  };

  const handleStartPlaying = (
    level: Level,
    drawingDataUrl?: string
  ) => {
    if ((level as any).gameMode) {
      setGameModeState((level as any).gameMode);
    }
    if ((level as any).theme) {
      setSelectedBackground((level as any).theme);
    }
    setCurrentLevel(level);
    const imgUrl = drawingDataUrl || (level as any).originalImage;
    setCurrentDrawingUrl(imgUrl);
    if (imgUrl) {
      setInitialDrawingForStudio(imgUrl);
    }
    setScreen("playing");
  };

  const handleEditDrawing = (dataUrl: string) => {
    setInitialDrawingForStudio(dataUrl);
    setCurrentDrawingUrl(dataUrl);
    setScreen("draw");
  };

  const handleSaveCurrentLevel = async () => {
    if (!currentLevel) return;
    const name = currentLevel.name || `Dino-Level ${Date.now()}`;
    await saveLevel({
      name,
      level: currentLevel,
      thumbnail: currentDrawingUrl,
      originalImage: currentDrawingUrl,
    });
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2500);
  };

  const renderWorldIntroModal = () => {
    if (!worldIntroCampaign) return null;
    const { world, sequenceOrder } = worldIntroCampaign;
    return (
      <div className="modal-backdrop" style={{ zIndex: 10000 }}>
        <div className="modal-box" style={{ maxWidth: "520px", textAlign: "center", padding: "32px 28px" }}>
          <div style={{ fontSize: "3.6rem", marginBottom: "8px" }}>{world.icon}🦖🚀</div>
          <h2 style={{ color: "#2563eb", fontSize: "1.9rem", marginBottom: "8px" }}>
            Welt: {world.name}
          </h2>
          <p style={{ fontSize: "1.05rem", color: "#4b5563", marginBottom: "16px" }}>
            {world.description}
          </p>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(245,158,11,0.08))",
              border: "1px solid rgba(37,99,235,0.2)",
              borderRadius: "16px",
              padding: "16px 20px",
              marginBottom: "22px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontWeight: "bold",
                color: "#1e3a8a",
                marginBottom: "6px",
              }}
            >
              <span>🎯 Kampagnen-Ziel:</span>
              <span>Alle {sequenceOrder.length} Level durchspielen!</span>
            </div>
            <div style={{ fontSize: "0.92rem", color: "#374151", marginBottom: "10px" }}>
              🎲 <strong>Zufälliger Start:</strong> Die Level-Reihenfolge wird für diesen Durchlauf zufällig gemischt!
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", color: "#92400e" }}>
              <span>⏱️ Aktuelle Bestzeit:</span>
              <strong>{world.bestTime ? formatWorldTime(world.bestTime) : "Noch kein Rekord – sei der Erste!"}</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button
              className="button button-primary"
              type="button"
              onClick={handleConfirmStartCampaign}
              style={{ fontSize: "1.15rem", padding: "14px 28px", fontWeight: "bold" }}
            >
              🚀 Welt jetzt starten!
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setWorldIntroCampaign(null)}
            >
              ✕ Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderWorldOutroModal = () => {
    if (!worldOutroStatus) return null;
    const { world, totalTimeMs, isNewRecord, previousBest } = worldOutroStatus;
    return (
      <div className="modal-backdrop" style={{ zIndex: 10000 }}>
        <div className="modal-box" style={{ maxWidth: "520px", textAlign: "center", padding: "36px 30px" }}>
          <div style={{ fontSize: "4.2rem", marginBottom: "8px" }}>
            🏆🎉🦖👑
          </div>
          <h2 style={{ color: "#16a34a", fontSize: "2rem", marginBottom: "10px" }}>
            Welt gemeistert!
          </h2>
          <p style={{ fontSize: "1.1rem", color: "#374151", marginBottom: "20px" }}>
            Herzlichen Glückwunsch! Du hast die gesamte Welt <strong>„{world.name}“</strong> bezwungen!
          </p>

          <div
            style={{
              background: isNewRecord
                ? "linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(245, 158, 11, 0.1))"
                : "rgba(243, 244, 246, 0.8)",
              border: isNewRecord ? "2px solid #f59e0b" : "1px solid #d1d5db",
              borderRadius: "16px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            {isNewRecord && (
              <div style={{ color: "#b45309", fontWeight: "bold", fontSize: "1.2rem", marginBottom: "8px" }}>
                👑 NEUER WELTREKORD! 👑
              </div>
            )}
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: "900",
                color: "#1f2937",
                fontFamily: "monospace",
                letterSpacing: "1px",
              }}
            >
              ⏱️ {formatWorldTime(totalTimeMs)}
            </div>
            {previousBest && isNewRecord && (
              <div style={{ fontSize: "0.95rem", color: "#059669", marginTop: "4px" }}>
                Vorherige Bestzeit: {formatWorldTime(previousBest)}
              </div>
            )}
            {!isNewRecord && world.bestTime && (
              <div style={{ fontSize: "0.95rem", color: "#6b7280", marginTop: "4px" }}>
                Aktuelle Bestzeit: {formatWorldTime(world.bestTime)}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                setWorldOutroStatus(null);
                const occupied: number[] = [];
                world.levelIds.forEach((id, idx) => {
                  if (id) occupied.push(idx);
                });
                for (let i = occupied.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [occupied[i], occupied[j]] = [occupied[j], occupied[i]];
                }
                handleStartWorldCampaign(world, occupied);
              }}
              style={{ fontSize: "1.1rem", padding: "12px 24px" }}
            >
              🔄 Nochmal versuchen (Rekord jagen)
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setWorldOutroStatus(null);
                setScreen("library");
              }}
            >
              📚 Zurück zur Welten-Auswahl
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 1. DIGITALES ZEICHENSTUDIO
  if (screen === "draw") {
    return (
      <>
        <DrawingCanvas
          onPlayLevel={handleStartPlaying}
          onBackToMenu={(currentDrawing) => {
            if (currentDrawing) {
              setInitialDrawingForStudio(currentDrawing);
              setCurrentDrawingUrl(currentDrawing);
            }
            setScreen("menu");
          }}
          initialImage={initialDrawingForStudio}
          backgroundTheme={selectedBackground}
          gameMode={gameMode}
          onOpenSettings={() => setShowSettings(true)}
          onOpenGameMode={() => setShowGameModeModal(true)}
          onOpenPhotoScanner={() => setScreen("camera")}
          onOpenLibrary={() => setScreen("library")}
        />
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            tvMode={tvMode}
            onToggleTvMode={toggleTvMode}
            gamepadSwapAB={gamepadSwapAB}
            onToggleGamepadSwapAB={setGamepadSwapAB}
            onOpenStreamModal={() => {
              setShowSettings(false);
              setShowTvModal(true);
            }}
          />
        )}
        {showGameModeModal && (
          <GameModeModal
            onClose={() => setShowGameModeModal(false)}
            currentBackground={selectedBackground}
            onBackgroundChange={setSelectedBackground}
            currentGameMode={gameMode}
            onGameModeChange={(newMode) => {
              setGameModeState(newMode);
              void setSetting("game_mode", newMode);
            }}
          />
        )}
      </>
    );
  }

  // 2. FOTO AUFNEHMEN / IMPORTIEREN
  if (screen === "camera") {
    return (
      <PhotoCapture
        onPlayLevel={handleStartPlaying}
        onBackToMenu={() => setScreen("draw")}
        onCancel={() => setScreen("draw")}
        backgroundTheme={selectedBackground}
      />
    );
  }

  // 3. MEINE SPIELE (BIBLIOTHEK)
  if (screen === "library") {
    return (
      <>
        <LevelLibrary
          onPlayLevel={handleStartPlaying}
          onEditDrawing={handleEditDrawing}
          onBackToMenu={() => setScreen("menu")}
          onStartWorldCampaign={handleStartWorldCampaign}
        />
        {worldIntroCampaign && renderWorldIntroModal()}
        {worldOutroStatus && renderWorldOutroModal()}
      </>
    );
  }

  // 4. SPIELEN (PHASER GAME)
  if (screen === "playing") {
    return (
      <main className={`game-screen-wrapper ${tvMode ? "tv-mode-active" : ""}`}>
        <header className="game-play-nav">
          <div className="nav-level-info">
            <span className="eyebrow">
              {worldCampaign
                ? `🌍 Welt: ${worldCampaign.world.name} (Level ${worldCampaign.currentStep + 1}/${worldCampaign.sequenceOrder.length})`
                : "Dino spielt:"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <h1 className="nav-level-name">{currentLevel?.name || "Level"}</h1>
              {worldCampaign && (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "2px solid #f59e0b",
                    color: "#b45309",
                    fontWeight: 800,
                    borderRadius: "20px",
                    padding: "3px 12px",
                    fontSize: "1.05rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>⏱️ {formatWorldTime(campaignTimerMs)}</span>
                  {worldCampaign.world.bestTime && (
                    <span style={{ fontSize: "0.82rem", opacity: 0.85, fontWeight: "normal" }}>
                      (Rekord: {formatWorldTime(worldCampaign.world.bestTime)})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="nav-play-buttons">
            <button
              className="button button-pause"
              type="button"
              onClick={() => gameHandleRef.current?.togglePause()}
              title="Spiel pausieren oder fortsetzen (Taste P)"
              style={{ background: "#475569", color: "#ffffff", fontWeight: "bold" }}
            >
              ⏸️ Pause
            </button>
            <button
              className="button button-restart"
              type="button"
              onClick={() => gameHandleRef.current?.restartLevel()}
              title="Level von vorn neu starten (Taste R)"
              style={{ background: "#dc2626", color: "#ffffff", fontWeight: "bold" }}
            >
              🔄 Neustart
            </button>
            <button
              className="button button-edit-level"
              type="button"
              onClick={handleEditCurrentLevel}
              title="Level im Zeichenstudio bearbeiten (Taste E)"
            >
              ✏️ Level bearbeiten
            </button>
            <button
              className={`button button-tv-toggle ${tvMode ? "active" : ""}`}
              type="button"
              onClick={toggleTvMode}
              title={tvMode ? "TV-Modus deaktivieren" : "TV-Modus aktivieren"}
            >
              {tvMode ? "📺 TV-Modus: AN" : "📺 TV-Modus"}
            </button>
            <button
              className="button button-save"
              type="button"
              onClick={handleSaveCurrentLevel}
              title="Level in IndexedDB speichern"
            >
              {saveSuccessMsg ? "✓ Gespeichert!" : "💾 Level speichern"}
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                if (gameHandleRef.current) {
                  gameHandleRef.current.destroy();
                  gameHandleRef.current = null;
                }
                setScreen("library");
              }}
              title="Welten und Level-Bibliothek öffnen"
            >
              🌍 Welten-Bibliothek
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                if (gameHandleRef.current) {
                  gameHandleRef.current.destroy();
                  gameHandleRef.current = null;
                }
                setScreen("menu");
              }}
            >
              ◀ Hauptmenü
            </button>
          </div>
        </header>

        <div className={`game-stage-container bg-stage-${selectedBackground}`} ref={gameContainerRef} />

        {worldIntroCampaign && renderWorldIntroModal()}
        {worldOutroStatus && renderWorldOutroModal()}
      </main>
    );
  }

  // 5. HAUPTMENÜ
  return (
    <div
      className={`dino-app-home ${tvMode ? "tv-mode-layout" : ""}`}
      style={{ backgroundImage: 'url("./sprites/home_background_themes.jpg")' }}
    >
      <header className="home-topbar">
        <div className="brand-logo" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src="./sprites/dino_mascot.png"
            alt="Dino"
            style={{ width: "42px", height: "42px", objectFit: "contain" }}
          />
          <span className="brand-text">Dino Paint Game</span>
        </div>
        <div className="topbar-actions">
          {!isStandalone && (
            <button
              className="button button-install-pill"
              type="button"
              onClick={() => setShowInstallModal(true)}
              title="App auf dem Gerät installieren"
            >
              📲 App installieren
            </button>
          )}
          <button
            className={`button button-tv-pill ${tvMode ? "active" : ""}`}
            type="button"
            onClick={() => setShowTvModal(true)}
            title="Streaming- & Fernseher-Menü öffnen"
          >
            📡 Streamen & TV
          </button>
          <button
            className="button button-settings-icon"
            type="button"
            onClick={() => setShowSettings(true)}
            title="Audio, Soundeffekte, Controller & Einstellungen"
          >
            ⚙️ Einstellungen
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="mascot-hero">
          <div className="mascot-visual">
            <div className="mascot-dino-wrap">
              <div className="mascot-dino-aura" />
              <img
                className="mascot-dino-img"
                src="./sprites/dino_mascot.png"
                alt="Dino Abenteurer"
              />
            </div>

            <div className="speech-bubble">
              <strong>🦖 Hallo! Ich bin Dino!</strong>
              <span>
                Zeichne deine eigenen Level mit Stiften auf Papier oder male direkt im Zeichenstudio. In der Bibliothek kannst du deine Level zu Welten mit je 8 Leveln verbinden!
              </span>
            </div>
          </div>

          <h1 className="hero-heading">Zeichnen. Welten bauen. Spielen!</h1>
          <p className="hero-lead">
            Erschaffe bunte Plattform-Welten mit je 8 Leveln auf PC, Tablet, Smartphone & TV!
          </p>
        </section>

        {currentLevel && (
          <section className="resume-level-banner">
            <div className="resume-banner-left">
              <span className="resume-badge">✨ Zuletzt geöffnetes Level</span>
              <h3 className="resume-name">{currentLevel.name || "Mein gezeichnetes Level"}</h3>
              <p className="resume-hint">
                Dein Level geht nicht verloren! Du kannst es direkt im Zeichenstudio anpassen oder weiterspielen:
              </p>
            </div>
            <div className="resume-banner-actions">
              <button
                className="button button-edit-level"
                type="button"
                onClick={handleEditCurrentLevel}
              >
                ✏️ Level weiterbearbeiten
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => setScreen("playing")}
              >
                ▶ Weiterspielen
              </button>
            </div>
          </section>
        )}

        <section className="menu-cards-grid">
          {/* 1. SPIELEN & WELTEN */}
          <div
            className="menu-card card-play-action"
            tabIndex={0}
            onClick={() => {
              setScreen("library");
            }}
          >
            <div className="card-symbol">🌍</div>
            <h3>Welten spielen</h3>
            <p>
              Wähle eine Welt mit 8 Leveln zum Spielen oder verbinde deine eigenen gezeichneten Level zu einer 8er-Welt!
            </p>
            <span className="card-cta">
              Welten-Bibliothek öffnen ▶
            </span>
          </div>

          {/* 2. LEVEL ZEICHNEN */}
          <div
            className="menu-card card-draw-action"
            tabIndex={0}
            onClick={() => {
              setInitialDrawingForStudio(undefined);
              setCurrentDrawingUrl(undefined);
              setCurrentLevel(null);
              setScreen("draw");
            }}
          >
            <div className="card-symbol">🎨</div>
            <h3>Level zeichnen</h3>
            <p>
              Erschaffe eigene Level im Zeichenstudio mit 9 magischen Spielfarben, Stiften oder Foto-Scan.
            </p>
            <span className="card-cta">
              Zeichenstudio öffnen ▶
            </span>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-credits">
          <strong>Dino Paint Game</strong> • Version 2.6 • by X4rinia & Dino
        </div>
      </footer>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          tvMode={tvMode}
          onToggleTvMode={toggleTvMode}
          gamepadSwapAB={gamepadSwapAB}
          onToggleGamepadSwapAB={setGamepadSwapAB}
          onOpenStreamModal={() => {
            setShowSettings(false);
            setShowTvModal(true);
          }}
        />
      )}
      {showGameModeModal && (
        <GameModeModal
          onClose={() => setShowGameModeModal(false)}
          currentBackground={selectedBackground}
          onBackgroundChange={setSelectedBackground}
          currentGameMode={gameMode}
          onGameModeChange={(m) => {
            setGameModeState(m);
            void setSetting("game_mode", m);
          }}
        />
      )}
      {showTvModal && (
        <TvModal
          onClose={() => setShowTvModal(false)}
          tvMode={tvMode}
          onToggleTvMode={toggleTvMode}
        />
      )}
      {showInstallModal && (
        <InstallPromptModal
          onClose={() => setShowInstallModal(false)}
          deferredPrompt={deferredPrompt}
          onInstallSuccess={() => setIsStandalone(true)}
        />
      )}
      {showGuide && <GuideModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}
