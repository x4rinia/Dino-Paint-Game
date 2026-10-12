import React, { useEffect, useState, useRef } from "react";
import type { Level, SavedLevelItem } from "@sketchquest/shared";
import {
  getAllLevels,
  deleteLevel,
  saveLevel,
  exportLevelFile,
  importLevelFile,
} from "../storage/db";
import {
  getAllWorlds,
  saveAllWorlds,
  createNewWorld,
  setWorldLevelSlot,
  deleteWorld,
  resolveLevelById,
  type World,
} from "../storage/worlds";

interface LevelLibraryProps {
  onPlayLevel: (level: Level, drawingDataUrl?: string, worldContext?: { world: World; levelIndex: number }) => void;
  onEditDrawing: (dataUrl: string) => void;
  onBackToMenu: () => void;
  initialTab?: "worlds" | "levels";
}

export function LevelLibrary({
  onPlayLevel,
  onEditDrawing,
  onBackToMenu,
  initialTab = "worlds",
}: LevelLibraryProps) {
  const [activeTab, setActiveTab] = useState<"worlds" | "levels">(initialTab);
  const [levels, setLevels] = useState<SavedLevelItem[]>([]);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Modals & Aktionen
  const [deleteTarget, setDeleteTarget] = useState<SavedLevelItem | null>(null);
  const [assigningSlot, setAssigningSlot] = useState<number | null>(null);
  const [showCreateWorldModal, setShowCreateWorldModal] = useState(false);
  const [newWorldName, setNewWorldName] = useState("");
  const [newWorldTheme, setNewWorldTheme] = useState<"jungle" | "volcano" | "space" | "paper">("jungle");
  const [worldResolvedLevels, setWorldResolvedLevels] = useState<Record<number, Level | null>>({});
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [lvls, wrlds] = await Promise.all([getAllLevels(), getAllWorlds()]);
      setLevels(lvls);
      setWorlds(wrlds);
      if (wrlds.length > 0 && !selectedWorldId) {
        setSelectedWorldId(wrlds[0].id);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Bibliothek:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const activeWorld = worlds.find((w) => w.id === selectedWorldId) || worlds[0];

  // Lade die 8 Level für die aktuell ausgewählte Welt auf
  useEffect(() => {
    if (!activeWorld) return;
    let isCancelled = false;
    const loadSlots = async () => {
      const map: Record<number, Level | null> = {};
      for (let i = 0; i < 8; i++) {
        const id = activeWorld.levelIds[i];
        if (id) {
          map[i] = await resolveLevelById(id);
        } else {
          map[i] = null;
        }
      }
      if (!isCancelled) {
        setWorldResolvedLevels(map);
      }
    };
    loadSlots();
    return () => {
      isCancelled = true;
    };
  }, [activeWorld]);

  const handleDelete = async (id: string) => {
    await deleteLevel(id);
    const updated = levels.filter((l) => l.id !== id);
    setLevels(updated);
    setDeleteTarget(null);
  };

  const handleDuplicate = async (item: SavedLevelItem) => {
    await saveLevel({
      name: `${item.name} (Kopie)`,
      level: item.level,
      thumbnail: item.thumbnail,
      originalImage: item.originalImage,
    });
    await fetchAllData();
  };

  const handleExport = (item: SavedLevelItem) => {
    exportLevelFile(item);
  };

  const handleExportPng = (item: SavedLevelItem) => {
    const dataUrl = item.originalImage || item.thumbnail;
    if (!dataUrl) {
      alert("Dieses Level besitzt kein gespeichertes Bild.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${item.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    a.click();
  };

  const handleExportWorld = async (worldToExport: World) => {
    try {
      const resolvedList = await Promise.all(
        worldToExport.levelIds.map(async (id) => (id ? await resolveLevelById(id) : null))
      );
      const bundle = {
        type: "dino_world_bundle",
        version: 1,
        world: worldToExport,
        levels: resolvedList,
        exportedAt: Date.now(),
      };
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${worldToExport.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.world.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Fehler beim Exportieren der Welt: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith(".json") || file.type === "application/json") {
        const text = await file.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed.type === "dino_world_bundle" && parsed.world) {
            // Importiere alle enthaltenen Level in die Datenbank
            const newLevelIds: (string | null)[] = [];
            for (let i = 0; i < (parsed.levels || []).length; i++) {
              const lvl = parsed.levels[i];
              if (lvl) {
                const saved = await saveLevel({
                  name: lvl.name || `Welt-Level ${i + 1}`,
                  level: lvl,
                  thumbnail: (lvl as any).originalImage,
                  originalImage: (lvl as any).originalImage,
                });
                newLevelIds.push(saved.id);
              } else {
                newLevelIds.push(null);
              }
            }
            while (newLevelIds.length < 8) newLevelIds.push(null);
            const importedWorld: World = {
              id: `world-custom-${Date.now()}`,
              name: parsed.world.name || "Importierte Welt",
              theme: parsed.world.theme || "jungle",
              description: parsed.world.description || "Importierte 8-Level-Welt",
              icon: parsed.world.icon || "🌍",
              levelIds: newLevelIds.slice(0, 8),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            const allW = await getAllWorlds();
            await saveAllWorlds([...allW, importedWorld]);
            await fetchAllData();
            setSelectedWorldId(importedWorld.id);
            setActiveTab("worlds");
            setImportSuccessMsg(`✓ Welt "${importedWorld.name}" mit 8 Leveln importiert!`);
            setTimeout(() => setImportSuccessMsg(null), 3500);
            return;
          }
        } catch {
          // Kein Bundle, fahre mit normalem Level-Import fort
        }
      }

      const item = await importLevelFile(file);
      await fetchAllData();
      setImportSuccessMsg(`✓ "${item.name}" erfolgreich importiert!`);
      setTimeout(() => setImportSuccessMsg(null), 3500);
    } catch (err) {
      alert("Fehler beim Importieren: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      e.target.value = "";
    }
  };

  const playLevelItem = (item: SavedLevelItem) => {
    const fullLevel = item.level;
    const fullImage = item.originalImage || item.thumbnail;
    if (fullImage) {
      (fullLevel as any).originalImage = fullImage;
    }
    onPlayLevel(fullLevel, fullImage);
  };

  // Starte das Spielen einer Welt ab einem bestimmten Slot (0 bis 7)
  const playWorldAtSlot = async (slotIndex: number) => {
    if (!activeWorld) return;
    const levelToPlay = worldResolvedLevels[slotIndex];
    if (!levelToPlay) {
      alert(`Level ${slotIndex + 1} ist in dieser Welt noch nicht belegt! Bitte verbinde erst ein Level mit diesem Slot.`);
      return;
    }
    onPlayLevel(levelToPlay, (levelToPlay as any).originalImage, {
      world: activeWorld,
      levelIndex: slotIndex,
    });
  };

  const handleAssignLevelToSlot = async (lvl: SavedLevelItem) => {
    if (assigningSlot === null || !activeWorld) return;
    await setWorldLevelSlot(activeWorld.id, assigningSlot, lvl.id);
    setAssigningSlot(null);
    await fetchAllData();
  };

  const handleClearSlot = async (slotIndex: number) => {
    if (!activeWorld) return;
    await setWorldLevelSlot(activeWorld.id, slotIndex, null);
    await fetchAllData();
  };

  const handleCreateWorldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorldName.trim()) return;
    const created = await createNewWorld(newWorldName, newWorldTheme);
    setShowCreateWorldModal(false);
    setNewWorldName("");
    await fetchAllData();
    setSelectedWorldId(created.id);
  };

  const handleDeleteActiveWorld = async () => {
    if (!activeWorld) return;
    if (worlds.length <= 1) {
      alert("Du musst mindestens eine Welt behalten!");
      return;
    }
    if (confirm(`Möchtest du "${activeWorld.name}" wirklich löschen?`)) {
      await deleteWorld(activeWorld.id);
      await fetchAllData();
      if (worlds.length > 0) {
        setSelectedWorldId(worlds[0].id);
      }
    }
  };

  return (
    <div className="level-library-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="studio-header">
        <button className="button button-secondary" type="button" onClick={onBackToMenu}>
          ◀ Menü
        </button>
        <div className="studio-title">
          <h2>🌍 Welten & Level-Bibliothek</h2>
          <span className="studio-subtitle">Verbinde deine gezeichneten Level zu kompletten Welten!</span>
        </div>
        <div className="studio-header-actions">
          <label
            className="button button-secondary"
            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            title="Level-Datei (.json) oder Bild (.png / .jpg) importieren"
          >
            {importSuccessMsg ? importSuccessMsg : "📥 Level importieren"}
            <input
              type="file"
              accept=".json,application/json,.dino.json,image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={handleImport}
            />
          </label>
        </div>
      </header>

      {/* HAUPT-TABS: WELTEN vs. ALLE LEVEL */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          padding: "16px 20px 0",
          maxWidth: "1140px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <button
          type="button"
          className={`button ${activeTab === "worlds" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("worlds")}
          style={{ fontSize: "1.1rem", padding: "10px 24px", fontWeight: "bold" }}
        >
          🌍 Spielwelten (8 Level pro Welt)
        </button>
        <button
          type="button"
          className={`button ${activeTab === "levels" ? "button-primary" : "button-secondary"}`}
          onClick={() => setActiveTab("levels")}
          style={{ fontSize: "1.1rem", padding: "10px 24px", fontWeight: "bold" }}
        >
          📁 Alle Einzel-Level ({levels.length})
        </button>
      </div>

      <main className="library-content" style={{ flex: 1, padding: "20px 24px 60px", maxWidth: "1140px", margin: "0 auto", width: "100%" }}>
        {loading && <div className="loading-state">Lade Welten & Level…</div>}

        {/* ======================================================== */}
        {/* TAB 1: WELTEN-SYSTEM (8 LEVEL PRO WELT)                   */}
        {/* ======================================================== */}
        {!loading && activeTab === "worlds" && (
          <div className="worlds-view-container" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* WELTEN-AUSWAHL-LEISTE */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                overflowX: "auto",
                paddingBottom: "8px",
                borderBottom: "2px solid rgba(0,0,0,0.08)",
                alignItems: "center",
              }}
            >
              {worlds.map((w) => {
                const isSelected = activeWorld?.id === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedWorldId(w.id)}
                    className={`button ${isSelected ? "button-primary" : "button-secondary"}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 18px",
                      borderRadius: "10px",
                      whiteSpace: "nowrap",
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <span style={{ fontSize: "1.3rem" }}>{w.icon || "🌍"}</span>
                    <span>{w.name}</span>
                  </button>
                );
              })}

              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowCreateWorldModal(true)}
                style={{ padding: "8px 16px", borderRadius: "10px", whiteSpace: "nowrap" }}
              >
                ➕ Neue Welt erstellen
              </button>
            </div>

            {/* AUSGEWÄHLTE WELT KOPFBEREICH */}
            {activeWorld && (
              <div
                style={{
                  background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                  border: "2px solid #cbd5e1",
                  borderRadius: "16px",
                  padding: "20px 24px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "16px",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "2rem" }}>{activeWorld.icon || "🌍"}</span>
                    <h3 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a" }}>{activeWorld.name}</h3>
                  </div>
                  <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
                    {activeWorld.description} (Thema: <strong>{activeWorld.theme}</strong>)
                  </p>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => playWorldAtSlot(0)}
                    style={{
                      fontSize: "1.1rem",
                      padding: "10px 22px",
                      fontWeight: "bold",
                      boxShadow: "0 6px 14px rgba(16, 185, 129, 0.4)",
                    }}
                  >
                    ▶️ Welt spielen (ab Level 1)
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => handleExportWorld(activeWorld)}
                    title="Diese komplette Welt mit allen 8 Leveln als .world.json exportieren"
                    style={{ fontSize: "0.92rem", padding: "10px 16px" }}
                  >
                    💾 Welt als JSON sichern
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={handleDeleteActiveWorld}
                    title="Diese Welt löschen"
                    style={{ padding: "10px 14px", color: "#dc2626" }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}

            {/* 8 LEVEL-SLOTS GRID */}
            <div style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h4 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b" }}>
                  Level-Verbindungen (8 Level dieser Welt):
                </h4>
                <span style={{ fontSize: "0.9rem", color: "#64748b" }}>
                  Klicke auf „Level verbinden“, um deine gezeichneten Level zuzuweisen!
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "16px",
                }}
              >
                {Array.from({ length: 8 }).map((_, index) => {
                  const resolved = worldResolvedLevels[index];
                  const hasLevel = Boolean(resolved);
                  const isBossSlot = index === 7;

                  return (
                    <div
                      key={index}
                      style={{
                        background: hasLevel ? "#ffffff" : "rgba(241, 245, 249, 0.7)",
                        border: isBossSlot
                          ? "3px solid #eab308"
                          : hasLevel
                          ? "2px solid #94a3b8"
                          : "2px dashed #cbd5e1",
                        borderRadius: "14px",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        boxShadow: hasLevel ? "0 4px 10px rgba(0,0,0,0.06)" : "none",
                        position: "relative",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span
                          style={{
                            fontWeight: "bold",
                            fontSize: "0.95rem",
                            color: isBossSlot ? "#b45309" : "#334155",
                            background: isBossSlot ? "#fef3c7" : "#f1f5f9",
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          Level {index + 1} {isBossSlot && "🏆 Finale"}
                        </span>
                        {hasLevel && (
                          <span style={{ color: "#10b981", fontSize: "0.85rem", fontWeight: "bold" }}>
                            ✓ Belegt
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          height: "90px",
                          background: hasLevel ? "#f8fafc" : "#f1f5f9",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        {hasLevel ? (
                          (resolved as any)?.originalImage ? (
                            <img
                              src={(resolved as any).originalImage}
                              alt={resolved?.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ fontSize: "2rem" }}>🦖</div>
                          )
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Leer</span>
                        )}
                      </div>

                      <div style={{ flex: 1 }}>
                        <strong style={{ display: "block", fontSize: "1rem", color: "#0f172a", marginBottom: "4px" }}>
                          {resolved ? resolved.name : "Kein Level verbunden"}
                        </strong>
                        <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                          {resolved
                            ? `${resolved.platforms?.length ?? 0} Plattformen, ${resolved.collectibles?.length ?? 0} Eier`
                            : "Slot ist noch frei"}
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                        {hasLevel ? (
                          <>
                            <button
                              type="button"
                              className="button button-primary"
                              onClick={() => playWorldAtSlot(index)}
                              style={{ flex: 1, padding: "6px 10px", fontSize: "0.88rem" }}
                            >
                              ▶ Spielen
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => setAssigningSlot(index)}
                              title="Anderes Level mit diesem Slot verbinden"
                              style={{ padding: "6px 10px", fontSize: "0.88rem" }}
                            >
                              🔗
                            </button>
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() => handleClearSlot(index)}
                              title="Slot leeren"
                              style={{ padding: "6px 10px", fontSize: "0.88rem", color: "#dc2626" }}
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => setAssigningSlot(index)}
                            style={{ width: "100%", padding: "8px", fontSize: "0.9rem", fontWeight: "bold" }}
                          >
                            ➕ Level verbinden
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: ALLE EINZEL-LEVEL                                  */}
        {/* ======================================================== */}
        {!loading && activeTab === "levels" && (
          <div>
            {levels.length === 0 ? (
              <div className="empty-library">
                <div className="empty-icon">🦖</div>
                <h3>Noch keine gespeicherten Level!</h3>
                <p>Zeichne ein eigenes Level im Zeichenstudio oder scanne ein Papier-Foto ab!</p>
              </div>
            ) : (
              <div className="levels-grid">
                {levels.map((item) => (
                  <div key={item.id} className="level-card">
                    <div className="card-thumb" onClick={() => playLevelItem(item)}>
                      {item.thumbnail || item.originalImage ? (
                        <img src={item.thumbnail || item.originalImage} alt={item.name} />
                      ) : (
                        <div className="thumb-placeholder">🎮</div>
                      )}
                      <div className="play-overlay">
                        <span className="play-badge">▶ Spielen</span>
                      </div>
                    </div>

                    <div className="card-info">
                      <h3 className="card-title">{item.name}</h3>
                      <span className="card-date">
                        {new Date(item.updatedAt || item.createdAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                      <div className="card-badges">
                        <span>{item.level?.platforms?.length ?? 0} Plattformen</span>
                        {(item.level?.bouncers?.length ?? 0) > 0 && (
                          <span className="badge-bounce">{item.level.bouncers.length} Trampoline</span>
                        )}
                        {(item.level?.collectibles?.length ?? 0) > 0 && (
                          <span className="badge-collectible">🥚 {item.level.collectibles.length} Eier</span>
                        )}
                        {(item.level?.teleporters?.length ?? 0) > 0 && (
                          <span className="badge-teleporter">🌀 {item.level.teleporters.length} Portale</span>
                        )}
                      </div>
                    </div>

                    <div className="card-actions">
                      <button className="button button-play-small" type="button" onClick={() => playLevelItem(item)}>
                        Spielen
                      </button>
                      <button
                        className="button button-secondary-small"
                        type="button"
                        onClick={() => onEditDrawing(item.originalImage || item.thumbnail || "")}
                        title="Level im Zeichenstudio bearbeiten"
                      >
                        ✏️
                      </button>
                      <button
                        className="button button-secondary-small"
                        type="button"
                        onClick={() => handleDuplicate(item)}
                        title="Duplizieren"
                      >
                        📋
                      </button>
                      <button
                        className="button button-secondary-small"
                        type="button"
                        onClick={() => handleExportPng(item)}
                        title="Als PNG-Bild herunterladen"
                      >
                        🖼️
                      </button>
                      <button
                        className="button button-secondary-small"
                        type="button"
                        onClick={() => handleExport(item)}
                        title="Als Level-JSON exportieren"
                      >
                        💾
                      </button>
                      <button
                        className="button button-danger-small"
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        title="Löschen"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL: LEVEL MIT WELT-SLOT VERBINDEN */}
      {assigningSlot !== null && (
        <div className="modal-backdrop" onClick={() => setAssigningSlot(null)}>
          <div
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "640px", maxHeight: "85vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0 }}>Level mit Slot {assigningSlot + 1} verbinden</h3>
              <button className="button-close" type="button" onClick={() => setAssigningSlot(null)}>
                ✕
              </button>
            </div>
            <p style={{ color: "#64748b", margin: "0 0 16px" }}>
              Wähle eines deiner gespeicherten Level aus der Bibliothek, um es mit diesem Slot zu verbinden:
            </p>

            {levels.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: "20px" }}>
                Du hast noch keine eigenen Level gespeichert. Zeichne zuerst ein Level im Studio!
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {levels.map((lvl) => (
                  <div
                    key={lvl.id}
                    onClick={() => handleAssignLevelToSlot(lvl)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      cursor: "pointer",
                      background: "#f8fafc",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#e2e8f0")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {lvl.thumbnail ? (
                        <img src={lvl.thumbnail} alt={lvl.name} style={{ width: "45px", height: "30px", borderRadius: "4px", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: "1.4rem" }}>🎮</span>
                      )}
                      <div>
                        <strong style={{ display: "block", color: "#0f172a" }}>{lvl.name}</strong>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          {lvl.level?.platforms?.length ?? 0} Plattformen, {lvl.level?.collectibles?.length ?? 0} Eier
                        </span>
                      </div>
                    </div>
                    <button className="button button-primary" type="button" style={{ padding: "6px 14px" }}>
                      Auswählen ✓
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NEUE WELT ERSTELLEN */}
      {showCreateWorldModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateWorldModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <h3>➕ Neue 8-Level-Welt erstellen</h3>
            <form onSubmit={handleCreateWorldSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "12px" }}>
              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Name der Welt:</label>
                <input
                  type="text"
                  required
                  value={newWorldName}
                  onChange={(e) => setNewWorldName(e.target.value)}
                  placeholder="z.B. Dinos Traumwelt"
                  className="form-input"
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "6px" }}>Thema & Umgebung:</label>
                <select
                  value={newWorldTheme}
                  onChange={(e) => setNewWorldTheme(e.target.value as any)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                >
                  <option value="jungle">🌴 Dschungel (Wind & Lianen)</option>
                  <option value="volcano">🌋 Vulkan (Funken & Lava)</option>
                  <option value="space">🚀 Kosmos (Schwerelosigkeit)</option>
                  <option value="paper">📝 Notizheft (Klassischer Papier-Look)</option>
                </select>
              </div>

              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" className="button button-secondary" onClick={() => setShowCreateWorldModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="button button-primary">
                  Welt erstellen ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LEVEL LÖSCHEN */}
      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3>Level löschen?</h3>
            <p>
              Möchtest du das Level <strong>„{deleteTarget.name}“</strong> wirklich unwiderruflich löschen?
            </p>
            <div className="modal-actions">
              <button className="button button-danger" type="button" onClick={() => handleDelete(deleteTarget.id)}>
                Löschen
              </button>
              <button className="button button-secondary" type="button" onClick={() => setDeleteTarget(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
