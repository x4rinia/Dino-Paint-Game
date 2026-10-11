import type { Level, SavedLevelItem, SaveLevelRequest } from "@sketchquest/shared";
import { DEFAULT_STARTER_LEVELS } from "./starterLevels";

const DB_NAME = "DinoDrawDB";
const DB_VERSION = 1;
const STORE_LEVELS = "levels";
const STORE_SETTINGS = "settings";
const LOCAL_STORAGE_KEY = "dino_saved_levels";

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Öffnet die IndexedDB für Dino Draw Your Game.
 * Funktioniert 100% offline im Browser auf PC, Tablet und Smartphone.
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB wird von diesem Browser nicht unterstützt."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // ObjectStore für Level
      if (!db.objectStoreNames.contains(STORE_LEVELS)) {
        const levelStore = db.createObjectStore(STORE_LEVELS, { keyPath: "id" });
        levelStore.createIndex("updatedAt", "updatedAt", { unique: false });
        levelStore.createIndex("createdAt", "createdAt", { unique: false });
        levelStore.createIndex("name", "name", { unique: false });
      }

      // ObjectStore für Einstellungen
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Fehler beim Öffnen von IndexedDB"));
    };
  });

  return dbPromise;
}

/**
 * Lädt alle gespeicherten Level aus der IndexedDB,
 * sortiert nach dem neuesten Änderungsdatum.
 */
export async function getAllLevels(): Promise<SavedLevelItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LEVELS, "readonly");
      const store = tx.objectStore(STORE_LEVELS);
      const req = store.getAll();

      req.onsuccess = () => {
        const list = (req.result || []) as SavedLevelItem[];
        // Sortiere: Neueste zuerst
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB Fehler, verwende LocalStorage Fallback:", err);
    // Fallback auf LocalStorage
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Holt ein einzelnes Level anhand der ID.
 */
export async function getLevelById(id: string): Promise<SavedLevelItem | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEVELS, "readonly");
    const store = tx.objectStore(STORE_LEVELS);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result as SavedLevelItem | undefined);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Speichert ein Level in der lokalen IndexedDB.
 */
export async function saveLevel(data: SaveLevelRequest): Promise<SavedLevelItem> {
  const now = new Date().toISOString();
  const id = data.id || `level-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const item: SavedLevelItem = {
    id,
    name: data.name.trim() || `Dino-Level ${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    level: data.level,
    thumbnail: data.thumbnail,
    originalImage: data.originalImage,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LEVELS, "readwrite");
      const store = tx.objectStore(STORE_LEVELS);
      const req = store.put(item);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("IndexedDB Speichern fehlgeschlagen, speichere in LocalStorage:", err);
    // LocalStorage Fallback
    const existing = await getAllLevels();
    const filtered = existing.filter((l) => l.id !== id);
    filtered.unshift(item);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  }

  return item;
}

/**
 * Löscht ein Level aus der IndexedDB.
 */
export async function deleteLevel(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LEVELS, "readwrite");
      const store = tx.objectStore(STORE_LEVELS);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB Delete Fehler:", err);
  }

  // Auch im LocalStorage Fallback löschen
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw) as SavedLevelItem[];
      const updated = list.filter((l) => l.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}
}

/**
 * Exportiert ein Level als JSON-Datei zum Herunterladen.
 */
export function exportLevelFile(item: SavedLevelItem): void {
  const json = JSON.stringify(item, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = item.name.replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "_");
  a.download = `${safeName || "dino_level"}.dino.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Importiert ein Level aus einer JSON-Datei oder einem JSON-String
 * und speichert es in IndexedDB.
 */
export async function importLevelFile(input: File | string): Promise<SavedLevelItem> {
  let text: string;
  let filename = "Importiertes Level";

  if (typeof input === "string") {
    text = input;
  } else {
    filename = input.name.replace(/\.dino\.json$/i, "").replace(/\.json$/i, "");
    text = await input.text();
  }

  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !parsed.level) {
    throw new Error("Ungültiges Level-Format. Die Datei enthält kein gültiges Spielfeld.");
  }

  const name = parsed.name || filename;
  return saveLevel({
    name,
    level: parsed.level,
    thumbnail: parsed.thumbnail,
    originalImage: parsed.originalImage,
  });
}

/**
 * Migriert bestehende Level aus dem alten LocalStorage in IndexedDB.
 * Verhindert Datenverlust beim Umstieg auf die PWA!
 */
export async function migrateFromLocalStorage(): Promise<number> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return 0;

    const list = JSON.parse(raw) as SavedLevelItem[];
    if (!Array.isArray(list) || list.length === 0) return 0;

    const db = await openDB();
    let migratedCount = 0;

    for (const item of list) {
      if (item && item.id && item.level) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_LEVELS, "readwrite");
          const store = tx.objectStore(STORE_LEVELS);
          const req = store.put(item);
          req.onsuccess = () => {
            migratedCount++;
            resolve();
          };
          req.onerror = () => resolve();
        });
      }
    }

    console.log(`[Storage] ${migratedCount} Level erfolgreich aus LocalStorage in IndexedDB migriert.`);
    return migratedCount;
  } catch (err) {
    console.warn("[Storage] Migration aus LocalStorage übersprungen:", err);
    return 0;
  }
}

/**
 * Initialisiert die Datenbank beim ersten Start:
 * 1. Führt ggf. Migration aus LocalStorage durch.
 * 2. Wenn noch keine Level vorhanden sind, werden 3 abwechslungsreiche
 *    Starter-Level geladen (Tutorial, Portale, 6-Farben-Arena).
 */
export async function initStorage(): Promise<void> {
  try {
    await openDB();
    await migrateFromLocalStorage();

    // Test- und Starter-Level automatisch bereinigen, damit die Bibliothek sauber ist
    const levels = await getAllLevels();
    for (const item of levels) {
      const lower = item.name.toLowerCase();
      if (
        item.id.startsWith("starter-") ||
        item.id.startsWith("test-") ||
        lower.includes("test") ||
        lower.includes("abenteuer") ||
        lower.includes("portal-express") ||
        lower.includes("arena")
      ) {
        await deleteLevel(item.id);
      }
    }

    // Persistenz anfordern, damit Browser die Daten nicht löscht
    await requestPersistentStorage();
  } catch (err) {
    console.warn("[Storage] Initialisierung mit Warnung abgeschlossen:", err);
  }
}

/**
 * Fragt den Browser nach dauerhaftem Speicherplatz (Persistenz).
 * Verhindert, dass Safari oder Chrome die Level bei knappem Speicherplatz aufräumen.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log("[Storage] Persistenter Speicher gewährt:", granted);
        return granted;
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Gibt den aktuellen Speicherplatzverbrauch zurück.
 */
export async function getStorageQuota(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  percentage: number;
  persisted: boolean;
}> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let persisted = false;

  if (typeof navigator !== "undefined" && navigator.storage) {
    try {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        usedBytes = est.usage || 0;
        quotaBytes = est.quota || 0;
      }
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
    } catch {}
  }

  const percentage = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;
  return { usedBytes, quotaBytes, percentage, persisted };
}

/**
 * Liest eine Einstellung aus IndexedDB.
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SETTINGS, "readonly");
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result && req.result.value !== undefined) {
          resolve(req.result.value as T);
        } else {
          resolve(defaultValue);
        }
      };
      req.onerror = () => resolve(defaultValue);
    });
  } catch {
    return defaultValue;
  }
}

/**
 * Schreibt eine Einstellung in IndexedDB.
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, "readwrite");
      const store = tx.objectStore(STORE_SETTINGS);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[Storage] Einstellung konnte nicht gespeichert werden:", err);
  }
}
