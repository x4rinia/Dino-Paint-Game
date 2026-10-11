import "./env";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import express, { type ErrorRequestHandler } from "express";
import {
  LevelRequestSchema,
  RoastRequestSchema,
  SaveLevelRequestSchema,
  type HealthResponse,
  type LevelResponse,
  type RoastResponse,
} from "@sketchquest/shared";
import { usageSnapshot } from "./budget";
import { dailyCap, isLiveRoast, isRecord, isReplay, mode } from "./config";
import { hasGeminiKey } from "./gemini";
import { serveLevel, serveRoast } from "./serve";
import { parseSketchImage } from "./sketchImage";
import {
  deleteSavedLevel,
  getSavedLevel,
  listSavedLevels,
  saveLevel,
} from "./levelStore";

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIST = path.resolve(import.meta.dirname, "../client/dist");
const IMAGES_DIR = path.resolve(import.meta.dirname, "../data/images");

const app = express();

// Request log
app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const started = Date.now();
  res.on("finish", () => {
    console.log(`[http] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});

app.use(express.json({ limit: "30mb" }));

// Statisches Bereitstellen der hochgeladenen Level-Bilder
app.use("/api/images", express.static(IMAGES_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: mode() } satisfies HealthResponse);
});

// Level analysieren
app.post("/api/level", async (req, res) => {
  const body = LevelRequestSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Body must be { image: string } (base64 image)" });
    return;
  }
  const parsed = parseSketchImage(body.data.image);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  res.json((await serveLevel(parsed.image)) satisfies LevelResponse);
});

// Level-Bibliothek Endpunkte
app.get("/api/levels", (_req, res) => {
  res.json(listSavedLevels());
});

app.get("/api/levels/:id", (req, res) => {
  const item = getSavedLevel(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Level nicht gefunden" });
    return;
  }
  res.json(item);
});

app.post("/api/levels", (req, res) => {
  const parsed = SaveLevelRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Level-Daten", details: parsed.error.issues });
    return;
  }
  const saved = saveLevel(parsed.data);
  res.json(saved);
});

app.delete("/api/levels/:id", (req, res) => {
  const ok = deleteSavedLevel(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Level konnte nicht gelöscht werden" });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/levels/import", (req, res) => {
  try {
    const raw = req.body;
    if (!raw || typeof raw !== "object" || !raw.level) {
      res.status(400).json({ error: "Ungültiges Level-Importformat" });
      return;
    }
    const saved = saveLevel({
      name: raw.name || "Importiertes Level",
      level: raw.level,
      thumbnail: raw.thumbnail,
      originalImage: raw.originalImage,
    });
    res.json(saved);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Importieren des Levels" });
  }
});

// Roast Endpoint
app.post("/api/roast", async (req, res) => {
  const body = RoastRequestSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Body must be a RoastRequest" });
    return;
  }
  res.json((await serveRoast(body.data)) satisfies RoastResponse);
});

if (process.env.NODE_ENV !== "production") {
  app.get("/api/usage", (_req, res) => {
    res.json({
      ...usageSnapshot(),
      mode: mode(),
      liveRoast: isLiveRoast(),
      record: isRecord(),
      replay: isReplay(),
      keyConfigured: hasGeminiKey(),
    });
  });
}

// 404 für unbekannte /api Routen
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Produktion / Gebauter Client: Client ausliefern wenn dist existiert
if (process.env.NODE_ENV === "production" || fs.existsSync(path.join(CLIENT_DIST, "index.html"))) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

const onError: ErrorRequestHandler = (err, req, res, _next) => {
  const status =
    typeof err?.status === "number" && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(`[error] ${req.method} ${req.path}`, err);
  if (res.headersSent) return;
  res.status(status).json({
    error: status >= 500 ? "Interner Serverfehler" : err.type === "entity.too.large" ? "Anfrage zu groß" : "Ungültige Anfrage",
  });
};
app.use(onError);

function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

app.listen(PORT, "0.0.0.0", () => {
  const lanIp = getLanIp();
  console.log(`
======================================================================
  🦖  Dino Draw Your Game – Lokaler Server läuft!  🦕
======================================================================
  PC / Desktop:     http://localhost:${PORT}
  Smartphone / LAN: http://${lanIp}:${PORT}
======================================================================
  Offline-Modus aktiv: Zeichnungen werden lokal im Browser & Server
  analysiert (keine externe KI, kein Schlüssel erforderlich).
======================================================================
`);

  if (!process.env.NO_OPEN) {
    import("node:child_process").then(({ exec }) => {
      const openCmd =
        process.platform === "win32"
          ? `start http://localhost:${PORT}`
          : process.platform === "darwin"
          ? `open http://localhost:${PORT}`
          : `xdg-open http://localhost:${PORT}`;
      exec(openCmd);
    }).catch(() => {});
  }
});
