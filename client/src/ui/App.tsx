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
import { resolveLevelById, type World } from "../storage/worlds";
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

  // 8-Level-Welten-System
  const [activeWorldContext, setActiveWorldContext] = useState<{ world: World; levelIndex: number } | null>(null);
  const [worldWinStatus, setWorldWinStatus] = useState<{
    world: World;
    completedSlot: number;
    nextSlot: number;
    isComplete: boolean;
  } | null>(null);

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
    onBack: () => {
      if (showSettings) setShowSettings(false);
      else if (showTvModal) setShowTvModal(false);
      else if (showInstallModal) setShowInstallModal(false);
    },
    onStart: () => setShowSettings(true),
  });

  // Spiel mounten wenn im Playing-Screen
  useEffect(() => {
    if (screen === "playing" && currentLevel && gameContainerRef.current) {
      if (gameHandleRef.current) {
        gameHandleRef.current.destroy();
      }
      const handle = mountGame(gameContainerRef.current, {
        tvMode,
        background: selectedBackground,
        gameMode,
      });
      gameHandleRef.current = handle;
      handle.loadLevel(currentLevel);

      return () => {
        handle.destroy();
        gameHandleRef.current = null;
      };
    }
  }, [screen, currentLevel, tvMode, selectedBackground, gameMode]);

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

  // Sieg in einem Level: Prüfe ob wir uns in einer 8-Level-Welt befinden
  useEffect(() => {
    const unsub = gameEvents.on("win", () => {
      if (activeWorldContext) {
        const nextSlot = activeWorldContext.levelIndex + 1;
        const isComplete = nextSlot >= 8;
        setWorldWinStatus({
          world: activeWorldContext.world,
          completedSlot: activeWorldContext.levelIndex,
          nextSlot,
          isComplete,
        });
      }
    });
    return unsub;
  }, [activeWorldContext]);

  const handlePlayNextWorldLevel = async () => {
    if (!worldWinStatus) return;
    const { world, nextSlot } = worldWinStatus;
    if (nextSlot < 8) {
      const nextLevelId = world.levelIds[nextSlot];
      const nextLevel = nextLevelId ? await resolveLevelById(nextLevelId) : null;
      if (nextLevel) {
        handleStartPlaying(nextLevel, (nextLevel as any).originalImage, {
          world,
          levelIndex: nextSlot,
        });
      } else {
        alert(`Slot ${nextSlot + 1} ist noch nicht belegt! Öffne die Bibliothek, um ein Level zuzuweisen.`);
        setScreen("library");
      }
    } else {
      setScreen("library");
    }
    setWorldWinStatus(null);
  };

  const handleStartPlaying = (
    level: Level,
    drawingDataUrl?: string,
    worldContext?: { world: World; levelIndex: number }
  ) => {
    setCurrentLevel(level);
    const imgUrl = drawingDataUrl || (level as any).originalImage;
    setCurrentDrawingUrl(imgUrl);
    if (imgUrl) {
      setInitialDrawingForStudio(imgUrl);
    }
    if (worldContext) {
      setActiveWorldContext(worldContext);
    } else {
      setActiveWorldContext(null);
    }
    setWorldWinStatus(null);
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
      <LevelLibrary
        onPlayLevel={handleStartPlaying}
        onEditDrawing={handleEditDrawing}
        onBackToMenu={() => setScreen("menu")}
      />
    );
  }

  // 4. SPIELEN (PHASER GAME)
  if (screen === "playing") {
    return (
      <main className={`game-screen-wrapper ${tvMode ? "tv-mode-active" : ""}`}>
        <header className="game-play-nav">
          <div className="nav-level-info">
            <span className="eyebrow">
              {activeWorldContext
                ? `🌍 Welt: ${activeWorldContext.world.name} (Level ${activeWorldContext.levelIndex + 1}/8)`
                : "Dino spielt:"}
            </span>
            <h1 className="nav-level-name">{currentLevel?.name || "Level"}</h1>
          </div>
          <div className="nav-play-buttons">
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

        {/* 8-Level-Welt: Fortschritts-Dialog bei Level-Sieg */}
        {worldWinStatus && (
          <div className="modal-backdrop" style={{ zIndex: 10000 }}>
            <div className="modal-box" style={{ maxWidth: "480px", textAlign: "center", padding: "32px 28px" }}>
              {worldWinStatus.isComplete ? (
                <>
                  <div style={{ fontSize: "3.8rem", marginBottom: "8px" }}>🏆🎉🦖</div>
                  <h2 style={{ color: "#2563eb", fontSize: "1.8rem", marginBottom: "10px" }}>Welt gemeistert!</h2>
                  <p style={{ fontSize: "1.1rem", color: "#374151", marginBottom: "24px" }}>
                    Fantastisch! Du hast alle <strong>8 Level</strong> der Welt <strong>„{worldWinStatus.world.name}“</strong> erfolgreich abgeschlossen!
                  </p>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => {
                        setWorldWinStatus(null);
                        setScreen("library");
                      }}
                      style={{ fontSize: "1.1rem", padding: "12px 24px" }}
                    >
                      🌍 Zurück zur Welten-Auswahl
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "3.6rem", marginBottom: "8px" }}>🌟⭐🦖</div>
                  <h2 style={{ color: "#16a34a", fontSize: "1.8rem", marginBottom: "10px" }}>
                    Level {worldWinStatus.completedSlot + 1} von 8 geschafft!
                  </h2>
                  <p style={{ fontSize: "1.05rem", color: "#374151", marginBottom: "24px" }}>
                    Großartig gemeistert! Bereit für das nächste Abenteuer in <strong>„{worldWinStatus.world.name}“</strong>?
                  </p>
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={handlePlayNextWorldLevel}
                      style={{ fontSize: "1.15rem", padding: "14px 28px", fontWeight: "bold" }}
                    >
                      ▶ Nächstes Level ({worldWinStatus.nextSlot + 1}/8) spielen
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => {
                        setWorldWinStatus(null);
                        setScreen("library");
                      }}
                    >
                      🌍 Welten-Übersicht
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  // 5. HAUPTMENÜ
  return (
    <div className={`dino-app-home ${tvMode ? "tv-mode-layout" : ""}`}>
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
          <div className="mascot-visual" style={{ gap: "32px", alignItems: "center", justifyContent: "center" }}>
            <div
              className="mascot-dino-wrap"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Leuchtende bunte Aura */}
              <div
                style={{
                  position: "absolute",
                  width: "220px",
                  height: "220px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(52, 211, 153, 0.45) 0%, rgba(59, 130, 246, 0.25) 55%, transparent 75%)",
                  filter: "blur(12px)",
                  zIndex: 0,
                }}
              />
              <img
                src="./sprites/dino_mascot.png"
                alt="Dino Abenteurer"
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: "185px",
                  height: "auto",
                  filter: "drop-shadow(0 14px 28px rgba(0,0,0,0.22))",
                }}
              />
            </div>

            <div className="speech-bubble" style={{ maxWidth: "430px" }}>
              <strong>Hallo! Ich bin Dino!</strong>
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
              <span className="resume-badge">Zuletzt geöffnetes Level</span>
              <h3 className="resume-name">{currentLevel.name || "Mein gezeichnetes Level"}</h3>
              <p className="resume-hint">
                Dein Level geht nicht verloren! Du kannst es direkt im Zeichenstudio weiterbearbeiten oder weiterspielen:
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

        <section className="menu-cards-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", maxWidth: "860px", margin: "0 auto" }}>
          {/* 1. SPIELEN & WELTEN */}
          <div
            className="menu-card card-play-action"
            tabIndex={0}
            onClick={() => {
              setScreen("library");
            }}
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              border: "3px solid #047857",
              boxShadow: "0 10px 25px rgba(16, 185, 129, 0.35)",
            }}
          >
            <div className="card-symbol" style={{ fontSize: "3.2rem" }}>🌍</div>
            <h3 style={{ color: "#ffffff", fontSize: "1.8rem", margin: "6px 0" }}>Welten spielen</h3>
            <p style={{ color: "#d1fae5", fontSize: "0.95rem" }}>
              Wähle eine Welt mit 8 Leveln zum Spielen oder verbinde deine eigenen gezeichneten Level zu einer 8er-Welt!
            </p>
            <span className="card-cta" style={{ background: "#ffffff", color: "#065f46", fontWeight: "bold" }}>
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
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              color: "#ffffff",
              border: "3px solid #1d4ed8",
              boxShadow: "0 10px 25px rgba(59, 130, 246, 0.35)",
            }}
          >
            <div className="card-symbol" style={{ fontSize: "3.2rem" }}>🎨</div>
            <h3 style={{ color: "#ffffff", fontSize: "1.8rem", margin: "6px 0" }}>Level zeichnen</h3>
            <p style={{ color: "#dbeafe", fontSize: "0.95rem" }}>
              Erschaffe eigene Level im Zeichenstudio mit 9 magischen Spielfarben, Stiften oder Foto-Scan.
            </p>
            <span className="card-cta" style={{ background: "#ffffff", color: "#1e40af", fontWeight: "bold" }}>
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
