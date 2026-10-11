import React, { useEffect, useState, useRef } from "react";
import type { Level, SavedLevelItem } from "@sketchquest/shared";
import {
  getAllLevels,
  deleteLevel,
  saveLevel,
  exportLevelFile,
  importLevelFile,
} from "../storage/db";

interface LevelLibraryProps {
  onPlayLevel: (level: Level, drawingDataUrl?: string) => void;
  onEditDrawing: (dataUrl: string) => void;
  onBackToMenu: () => void;
}

export function LevelLibrary({ onPlayLevel, onEditDrawing, onBackToMenu }: LevelLibraryProps) {
  const [levels, setLevels] = useState<SavedLevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<SavedLevelItem | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const fetchLevels = async () => {
    setLoading(true);
    try {
      const data = await getAllLevels();
      setLevels(data);
    } catch (err) {
      console.error("Fehler beim Laden der Levels:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

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
    await fetchLevels();
  };

  const handleExport = (item: SavedLevelItem) => {
    exportLevelFile(item);
  };

  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const item = await importLevelFile(file);
      await fetchLevels();
      setImportSuccessMsg(`✓ "${item.name}" erfolgreich importiert!`);
      setTimeout(() => setImportSuccessMsg(null), 3500);
    } catch (err) {
      alert("Fehler beim Importieren der Datei: " + (err instanceof Error ? err.message : String(err)));
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

  return (
    <div className="level-library-page">
      <header className="studio-header">
        <button className="button button-secondary" type="button" onClick={onBackToMenu}>
          ◀ Menü
        </button>
        <div className="studio-title">
          <h2>Meine Spiele & Levels</h2>
          <span className="studio-subtitle">Deine persönliche Spielesammlung</span>
        </div>
        <div className="studio-header-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => importInputRef.current?.click()}
            title="Level-Datei (.json) oder Bildzeichnung (.png / .jpg) importieren"
          >
            {importSuccessMsg ? importSuccessMsg : "📥 Level oder Bild importieren"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json,.dino.json,image/png,image/jpeg,image/webp"
            className="visually-hidden"
            onChange={handleImport}
          />
        </div>
      </header>

      <main className="library-content">
        {loading && <div className="loading-state">Lade lokale Level…</div>}

        {!loading && levels.length === 0 && (
          <div className="empty-library">
            <div className="empty-icon">🦖</div>
            <h3>Noch keine Level vorhanden!</h3>
            <p>
              Zeichne dein erstes Level im Zeichenstudio oder fotografiere eine echte Zeichnung ab!
            </p>
          </div>
        )}

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
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="card-badges">
                  <span>{item.level?.platforms?.length ?? 0} Plattformen</span>
                  {(item.level?.bouncers?.length ?? 0) > 0 && (
                    <span className="badge-bounce">
                      {item.level.bouncers.length} Trampoline
                    </span>
                  )}
                  {(item.level?.movers?.length ?? 0) > 0 && (
                    <span className="badge-mover">
                      {item.level.movers.length} Blöcke
                    </span>
                  )}
                  {(item.level?.collectibles?.length ?? 0) > 0 && (
                    <span className="badge-collectible">
                      🥚 {item.level.collectibles.length} Eier
                    </span>
                  )}
                  {(item.level?.teleporters?.length ?? 0) > 0 && (
                    <span className="badge-teleporter">
                      🌀 {item.level.teleporters.length} Portale
                    </span>
                  )}
                </div>
              </div>

              <div className="card-actions">
                <button
                  className="button button-play-small"
                  type="button"
                  onClick={() => playLevelItem(item)}
                >
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
                  onClick={() => handleExport(item)}
                  title="Als Datei exportieren"
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
      </main>

      {deleteTarget && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3>Level löschen?</h3>
            <p>
              Möchtest du das Level <strong>„{deleteTarget.name}“</strong> wirklich unwiderruflich
              löschen?
            </p>
            <div className="modal-actions">
              <button
                className="button button-danger"
                type="button"
                onClick={() => handleDelete(deleteTarget.id)}
              >
                Löschen
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
