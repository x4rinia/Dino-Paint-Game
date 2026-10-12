import React, { useMemo } from "react";
import type { Level } from "@sketchquest/shared";

/**
 * Zeichnet eine kompakte Vorschau-Grafik der Level-Geometrie auf ein Offscreen-Canvas.
 * Berücksichtigt alle Farben (Plattformen, Gefahren, Trampoline, Kisten, Eier, Portale, Lifte, Gegner, Ziel).
 */
export function renderLevelGeometryToDataUrl(level: Level, width = 360, height = 200): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const sx = (val: number) => (val / 1000) * width;
  const sy = (val: number) => (val / 1000) * height;

  // Hintergrundfarbe passend zum Thema
  const theme = (level as any).theme || "paper";
  const bgColors: Record<string, string> = {
    space: "#111424",
    volcano: "#200e12",
    jungle: "#d5ece0",
    paper: "#f7f2e3",
  };
  ctx.fillStyle = bgColors[theme] || "#f7f2e3";
  ctx.fillRect(0, 0, width, height);

  // Feines Notizblock-Karomuster bei Papier
  if (theme === "paper") {
    ctx.strokeStyle = "rgba(79, 124, 172, 0.12)";
    ctx.lineWidth = 1;
    const step = 16;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // 1. Schwarz: Plattformen
  ctx.fillStyle = theme === "space" ? "#475569" : "#1e293b";
  for (const p of level.platforms || []) {
    ctx.fillRect(sx(p.x), sy(p.y), Math.max(2, sx(p.w)), Math.max(2, sy(p.h)));
  }

  // 2. Rot: Gefahren / Lava / Stacheln
  ctx.fillStyle = "#ef4444";
  for (const h of level.hazards || []) {
    ctx.fillRect(sx(h.x), sy(h.y), Math.max(2, sx(h.w)), Math.max(2, sy(h.h)));
  }

  // 3. Grün: Trampoline / Bouncer
  ctx.fillStyle = "#10b981";
  for (const b of level.bouncers || []) {
    ctx.fillRect(sx(b.x), sy(b.y), Math.max(2, sx(b.w)), Math.max(2, sy(b.h)));
  }

  // 4. Blau: Physikblöcke / Schubkisten
  ctx.fillStyle = "#3b82f6";
  for (const m of level.movers || []) {
    ctx.fillRect(sx(m.x), sy(m.y), Math.max(4, sx(m.w)), Math.max(4, sy(m.h)));
  }

  // 5. Lila: Portale & Lifte
  ctx.fillStyle = "#a855f7";
  for (const t of level.teleporters || []) {
    const tw = Math.max(4, sx(t.w ?? 35));
    const th = Math.max(6, sy(t.h ?? 55));
    ctx.fillRect(sx(t.x), sy(t.y), tw, th);
  }

  // Braun: Bewegliche Lifte
  ctx.fillStyle = "#92400e";
  for (const mp of level.movingPlatforms || []) {
    ctx.fillRect(sx(mp.x), sy(mp.y), Math.max(6, sx(mp.w)), Math.max(3, sy(mp.h)));
  }

  // 6. Gelb: Dino-Eier & Münzen
  ctx.fillStyle = "#facc15";
  ctx.strokeStyle = "#ca8a04";
  ctx.lineWidth = 1;
  const collectibles = [
    ...(level.collectibles || []),
    ...(level.coins || []).map((coin) => ({ x: coin.x, y: coin.y, w: 24, h: 24 })),
  ];
  for (const c of collectibles) {
    const cw = c.w ?? 24;
    const ch = c.h ?? 24;
    const cx = sx(c.x + cw / 2);
    const cy = sy(c.y + ch / 2);
    const r = Math.max(3, Math.min(width, height) * 0.024);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 7. Pink/Orange: Patrouillierende Gegner
  ctx.fillStyle = "#f43f5e";
  for (const e of level.enemies || []) {
    const ex = sx(e.x);
    const ey = sy(e.y);
    const er = Math.max(4, Math.min(width, height) * 0.028);
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Ziel-Tor (Grün mit Torbogen)
  if (level.goal) {
    const gx = sx(level.goal.x);
    const gy = sy(level.goal.y);
    const gw = Math.max(6, sx(level.goal.w));
    const gh = Math.max(10, sy(level.goal.h));
    ctx.fillStyle = "#059669";
    ctx.fillRect(gx, gy, gw, gh);
    ctx.fillStyle = "#34d399";
    ctx.fillRect(gx + 2, gy + 2, Math.max(1, gw - 4), Math.max(1, gh - 4));
  }

  // 9. Start-Position (Kleiner Dino-Punkt / Marker)
  if (level.start) {
    const startX = sx(level.start.x);
    const startY = sy(level.start.y);
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(startX, startY, Math.max(4, Math.min(width, height) * 0.028), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  return canvas.toDataURL("image/png");
}

interface LevelThumbnailProps {
  level?: Level | null;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function LevelThumbnail({
  level,
  imageUrl,
  alt = "Level-Vorschau",
  className,
  style,
}: LevelThumbnailProps) {
  const generatedPreview = useMemo(() => {
    if (imageUrl) return null;
    if (!level) return null;
    return renderLevelGeometryToDataUrl(level);
  }, [level, imageUrl]);

  const displayUrl = imageUrl || generatedPreview;

  if (displayUrl) {
    return (
      <img
        src={displayUrl}
        alt={alt}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          ...style,
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "1.8rem",
        background: "#f1f5f9",
        color: "#94a3b8",
        ...style,
      }}
    >
      🦖
    </div>
  );
}
