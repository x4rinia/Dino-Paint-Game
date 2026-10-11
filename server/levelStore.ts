import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { SavedLevelItem, SaveLevelRequest } from "@sketchquest/shared";

const DATA_DIR = path.resolve(import.meta.dirname, "../data");
const LEVELS_DIR = path.join(DATA_DIR, "levels");
const IMAGES_DIR = path.join(DATA_DIR, "images");

// Sicherstellen, dass die Speicherverzeichnisse existieren
fs.mkdirSync(LEVELS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

export function listSavedLevels(): Array<Omit<SavedLevelItem, "originalImage">> {
  const files = fs.readdirSync(LEVELS_DIR).filter((f) => f.endsWith(".json"));
  const levels: Array<Omit<SavedLevelItem, "originalImage">> = [];

  for (const file of files) {
    try {
      const fullPath = path.join(LEVELS_DIR, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const item = JSON.parse(content) as SavedLevelItem;
      // Für die Listenansicht reicht das Thumbnail (spart Bandbreite)
      const { originalImage, ...summary } = item;
      levels.push(summary);
    } catch (err) {
      console.warn(`[levelStore] Konnte ${file} nicht laden:`, err);
    }
  }

  // Neueste zuerst
  levels.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return levels;
}

export function getSavedLevel(id: string): SavedLevelItem | null {
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const fullPath = path.join(LEVELS_DIR, `${safeId}.json`);

  if (!fs.existsSync(fullPath)) return null;

  try {
    const content = fs.readFileSync(fullPath, "utf-8");
    return JSON.parse(content) as SavedLevelItem;
  } catch (err) {
    console.error(`[levelStore] Fehler beim Lesen von ${id}:`, err);
    return null;
  }
}

export function saveLevel(req: SaveLevelRequest): SavedLevelItem {
  const id = req.id && req.id.trim() ? req.id.replace(/[^a-zA-Z0-9_-]/g, "") : `level-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const now = new Date().toISOString();

  let originalImagePath: string | undefined = undefined;
  if (req.originalImage && req.originalImage.startsWith("data:image")) {
    try {
      const match = req.originalImage.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const buffer = Buffer.from(match[2], "base64");
        const imageFile = `${id}.${ext}`;
        fs.writeFileSync(path.join(IMAGES_DIR, imageFile), buffer);
        originalImagePath = `/api/images/${imageFile}`;
      }
    } catch (err) {
      console.warn(`[levelStore] Konnte Originalbild für ${id} nicht separat schreiben:`, err);
    }
  }

  const existing = getSavedLevel(id);

  const item: SavedLevelItem = {
    id,
    name: req.name || "Mein Dino-Level",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    thumbnail: req.thumbnail,
    originalImage: originalImagePath || req.originalImage,
    level: req.level,
  };

  const fullPath = path.join(LEVELS_DIR, `${id}.json`);
  fs.writeFileSync(fullPath, JSON.stringify(item, null, 2), "utf-8");
  return item;
}

export function deleteSavedLevel(id: string): boolean {
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const fullPath = path.join(LEVELS_DIR, `${safeId}.json`);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    // Zugehöriges Bild bereinigen
    const possibleImages = fs.readdirSync(IMAGES_DIR).filter((f) => f.startsWith(`${safeId}.`));
    for (const img of possibleImages) {
      try {
        fs.unlinkSync(path.join(IMAGES_DIR, img));
      } catch {}
    }
    return true;
  }
  return false;
}
