import React, { useEffect, useRef, useState } from "react";
import { gameEvents, type Level } from "@sketchquest/shared";
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

  // 5. Gelb: Dino-Eier
  ctx.fillStyle = "#f5c518";
  for (const c of level.collectibles ?? []) {
    const cw = c.w ?? 30;
    const ch = c.h ?? 30;
    const cx = ((c.x + cw / 2) / 1000) * 1280;
    const cy = ((c.y + ch / 2) / 1000) * 720;
    const rx = (cw / 2000) * 1280;
    const ry = (ch / 2000) * 720;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(6, rx), Math.max(8, ry), 0, 0, Math.PI * 2);
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

  // 8. Orange: Bewegliche Gegner
  ctx.fillStyle = "#e8590c";
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

  // TV-Modus & PWA Install
  const [tvMode, setTvModeState] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSmartphone, setIsSmartphone] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundTheme>("paper");
  const [gameMode, setGameModeState] = useState<GameMode>("jump_n_run");

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

    // Prüfe ob PWA bereits installiert ist
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

    // Fange PWA-Installationsereignis ab
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

  const handleStartPlaying = (level: Level, drawingDataUrl?: string) => {
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
        />
        {showSettings && (
          <SettingsModal onClose={() => setShowSettings(false)} />
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
        onBackToMenu={() => setScreen("menu")}
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
            <span className="eyebrow">Dino spielt:</span>
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
                setScreen("menu");
              }}
            >
              ◀ Hauptmenü
            </button>
          </div>
        </header>

        <div className={`game-stage-container bg-stage-${selectedBackground}`} ref={gameContainerRef} />
      </main>
    );
  }

  // 5. HAUPTMENÜ
  return (
    <div className={`dino-app-home ${tvMode ? "tv-mode-layout" : ""}`}>
      <header className="home-topbar">
        <div className="brand-logo">
          <span className="brand-icon">🦖</span>
          <span className="brand-text">Dino Paint Game</span>
          <span className="badge-pwa-offline">Offline PWA</span>
        </div>
        <div className="topbar-actions">
          <button
            className="button button-guide-pill"
            type="button"
            onClick={() => setShowGuide(true)}
            title="Zeichen-Anleitung & Tipps"
            style={{ backgroundColor: "#9b51e0", color: "#fff" }}
          >
            📖 Anleitung
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              if (isMusicPlaying()) {
                pauseBgMusic();
              } else {
                startBgMusic();
              }
            }}
            title="Dino-Hintergrundmusik an- oder ausschalten"
            style={{ backgroundColor: "#253048", color: "#4ade80", border: "1px solid rgba(74, 222, 128, 0.45)" }}
          >
            🎵 Musik
          </button>
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
            title="TV-Modus & Bildübertragung"
          >
            📺 TV-Modus
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setShowGameModeModal(true)}
            title="Spielmodus (Jump 'n' Run oder Labyrinth) und Spielwelt wählen"
            style={{
              backgroundColor: "#2e3b56",
              color: "#e2e8f0",
              border: "1px solid rgba(255, 255, 255, 0.25)",
            }}
          >
            {gameMode === "rpg_labyrinth" ? "🧭 Labyrinth" : "🏃 Jump 'n' Run"}
          </button>
          <button
            className="button button-settings-icon"
            type="button"
            onClick={() => setShowSettings(true)}
            title="Audio, Soundeffekte & Einstellungen"
          >
            ⚙️ Einstellungen
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="mascot-hero">
          <div className="mascot-visual">
            <div className="mascot-dino-wrap">
              <svg
                className="dino-svg"
                viewBox="0 0 200 160"
                width="220"
                height="176"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Niedlicher Ankylosaurus SVG */}
                <circle cx="20" cy="95" r="14" fill="#708090" stroke="#1d1d24" strokeWidth="3" />
                <path d="M 20 95 Q 45 92 70 85" stroke="#2e8b57" strokeWidth="16" fill="none" strokeLinecap="round" />
                <rect x="65" y="105" width="16" height="28" rx="8" fill="#228b22" stroke="#1d1d24" strokeWidth="3" />
                <rect x="110" y="105" width="16" height="28" rx="8" fill="#228b22" stroke="#1d1d24" strokeWidth="3" />
                <ellipse cx="105" cy="85" rx="55" ry="38" fill="#3cb371" stroke="#1d1d24" strokeWidth="4" />
                <ellipse cx="110" cy="98" rx="36" ry="18" fill="#98fb98" />
                <polygon points="70,52 80,32 90,52" fill="#ffd700" stroke="#1d1d24" strokeWidth="3" />
                <polygon points="95,50 108,28 120,50" fill="#ffd700" stroke="#1d1d24" strokeWidth="3" />
                <polygon points="125,55 138,36 148,56" fill="#ffd700" stroke="#1d1d24" strokeWidth="3" />
                <rect x="85" y="112" width="16" height="28" rx="8" fill="#2e8b57" stroke="#1d1d24" strokeWidth="3" />
                <rect x="130" y="112" width="16" height="28" rx="8" fill="#2e8b57" stroke="#1d1d24" strokeWidth="3" />
                <circle cx="155" cy="72" r="26" fill="#3cb371" stroke="#1d1d24" strokeWidth="4" />
                <circle cx="152" cy="82" r="7" fill="#ffb6c1" opacity="0.8" />
                <circle cx="162" cy="65" r="10" fill="#ffffff" stroke="#1d1d24" strokeWidth="3" />
                <circle cx="165" cy="65" r="5.5" fill="#1d1d24" />
                <circle cx="167" cy="63" r="2" fill="#ffffff" />
                <path d="M 166 80 Q 174 83 178 77" stroke="#1d1d24" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </div>
            <div className="speech-bubble">
              <strong>Hallo! Ich bin Dino!</strong>
              <span>
                Zeichne deine eigene Plattform-Welt mit 8 magischen Farben oder fotografiere deine Zeichnung!
              </span>
            </div>
          </div>

          <h1 className="hero-heading">Zeichnen. Erkennen. Sofort spielen!</h1>
          <p className="hero-lead">
            Erschaffe deine eigenen bunten Plattformwelten auf Tablet, Smartphone, PC und TV!
          </p>
        </section>

        {isSmartphone && (
          <section className="smartphone-helper-card">
            <div className="phone-badge">📱 Smartphone-Tipp</div>
            <h3>Für das beste Spielerlebnis empfohlen</h3>
            <p>
              Da Smartphone-Bildschirme zum Spielen recht klein sind, empfehlen wir zwei ideale Möglichkeiten:
            </p>
            <div className="smartphone-actions-grid">
              <div
                className="phone-action-item card-action-scanner"
                onClick={() => setScreen("camera")}
              >
                <div className="phone-action-icon">📸</div>
                <div className="phone-action-text">
                  <strong>Foto-Scanner (Handy als Kamera)</strong>
                  <span>Papier-Zeichnung fotografieren, analysieren & Level exportieren</span>
                </div>
                <span className="phone-action-cta">Scannen ▶</span>
              </div>

              <div
                className="phone-action-item card-action-stream"
                onClick={() => setShowTvModal(true)}
              >
                <div className="phone-action-icon">📺</div>
                <div className="phone-action-text">
                  <strong>Auf den Fernseher streamen</strong>
                  <span>Per AirPlay / Cast auf den Smart TV übertragen & mit Controller spielen</span>
                </div>
                <span className="phone-action-cta">TV-Anleitung ▶</span>
              </div>
            </div>
          </section>
        )}

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

        <section className="menu-cards-grid">
          <div className="menu-card card-capture" tabIndex={0} onClick={() => setScreen("camera")}>
            <div className="card-symbol">📸</div>
            <h3>Foto aufnehmen</h3>
            <p>Papierzeichnung mit dem Smartphone/Tablet fotografieren oder Bild hochladen.</p>
            <span className="card-cta">Jetzt scannen ▶</span>
          </div>

          <div
            className="menu-card card-draw"
            tabIndex={0}
            onClick={() => {
              // Immer sauberes, neues Blatt öffnen
              setInitialDrawingForStudio(undefined);
              setCurrentDrawingUrl(undefined);
              setCurrentLevel(null);
              setScreen("draw");
            }}
          >
            <div className="card-symbol">🎨</div>
            <h3>Level zeichnen</h3>
            <p>Direkt mit Finger, Apple Pencil oder Stift auf einem leeren Blatt malen.</p>
            <span className="card-cta">Studio öffnen ▶</span>
          </div>

          <div className="menu-card card-library" tabIndex={0} onClick={() => setScreen("library")}>
            <div className="card-symbol">📁</div>
            <h3>Meine Spiele</h3>
            <p>Deine gespeicherten Welten öffnen, bearbeiten und spielen.</p>
            <span className="card-cta">Bibliothek öffnen ▶</span>
          </div>
        </section>

        <section className="rules-legend-box">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <h3 style={{ margin: 0 }}>Die 8 Spielregeln: Jede Farbe hat magische Kräfte</h3>
            <button className="button button-secondary" type="button" onClick={() => setShowGuide(true)} style={{ fontSize: "16px" }}>
              📖 Zeichen-Anleitung & Tipps
            </button>
          </div>
          <div className="legend-columns">
            <div className="rule-item">
              <span className="color-indicator color-black" />
              <div>
                <strong>Schwarz</strong>
                <span>Feste Böden, Mauern & Plattformen</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator color-red" />
              <div>
                <strong>Rot</strong>
                <span>Tödliche Gefahren (Stacheln & Lava)</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator color-green" />
              <div>
                <strong>Grün</strong>
                <span>Trampoline (Katapultiert lebendig federnd nach oben)</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator color-blue" />
              <div>
                <strong>Blau</strong>
                <span>Bewegliche Blöcke mit echter Physik</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator color-yellow" />
              <div>
                <strong>Gelb</strong>
                <span>Sammelobjekte (Sammle alle Eier vor dem Ziel)</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator color-purple" />
              <div>
                <strong>Lila</strong>
                <span>Teleporter (Portale oder magischer Vortex-Katapult)</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator" style={{ backgroundColor: "#8b5a2b" }} />
              <div>
                <strong>Braun</strong>
                <span>Bewegliche Lifte (Fährt waagerecht oder senkrecht)</span>
              </div>
            </div>
            <div className="rule-item">
              <span className="color-indicator" style={{ backgroundColor: "#e8590c" }} />
              <div>
                <strong>Orange</strong>
                <span>Gegner (Patrouillieren hin und her)</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="footer-credits">
          <strong>Dino Paint Game</strong> • Version 2.5 • by X4rinia & Dino
        </div>
      </footer>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
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
