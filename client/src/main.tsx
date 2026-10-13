import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA Service Worker Registration & Cache-Update
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        // Prüfe auf Aktualisierungen im Hintergrund (ohne störenden Reload mitten im Spiel!)
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker Registrierung fehlgeschlagen:", err);
      });
  });
}
