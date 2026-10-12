import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA Service Worker Registration & Sofortiges Cache-Update
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        // Prüfe auf Aktualisierungen bei jedem Seitenaufruf
        reg.update().catch(() => {});
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // Neuer Service Worker ist bereit – Seite automatisch neu laden
                console.log("[PWA] Neue Version verfügbar. Lade neu...");
                window.location.reload();
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker Registrierung fehlgeschlagen:", err);
      });
  });
}
