# Dino Paint Game 🦖

Eine vollständig lokal und offline betriebene Progressive Web App (PWA) für das Erschaffen und Spielen eigener 2D-Plattformwelten – optimiert für **Tablets (iPad / Android)**, **Smartphones**, **Desktop-PCs** und den **Fernseher (TV-Modus)**.

> **Prinzip:** Zeichnen → Farben erkennen → Physikwelt erzeugen → Sofort spielen!  
> **100% Offline:** Alle Spielfunktionen, das digitale Zeichenstudio, die lokale Bildanalyse und das Speichern laufen direkt im Browser ohne Cloud und ohne zwingenden Server.

---

## 🎨 Die 8 magischen Spielfarben

Das Spiel erkennt acht Farben deterministisch auf Papier oder digital im Zeichenstudio:

| Farbe | Funktion | Verhalten im Spiel |
|---|---|---|
| **Schwarz** | Feste Plattformen | Begehbare Böden, Wände und Decken (inkl. Randabschluss). |
| **Rot** | Gefahren & Fallen | Tödliche Stacheln und Lava-Gruben (sofortiger Respawn). |
| **Grün** | Trampoline | Animierte Sprungfedern mit dynamischem Squash & Stretch und Katapultsprung. |
| **Blau** | Physik-Blöcke | Bewegliche Kisten mit Schwerkraft, die geschoben werden können! |
| **Gelb** | Dino-Eier | Goldene Dino-Eier. **Müssen alle eingesammelt werden**, bevor sich das Ziel öffnet! |
| **Lila** | Teleporter | Portale beamen hin & her (einzelnes Portal katapultiert als Vortex nach oben). |
| **Braun** | Schwebende Lifte | Fährt waagerecht (links/rechts) oder senkrecht (hoch/runter). |
| **Orange** | Gegner | Bewegliche Dino-Gegner, die hin und her patrouillieren. |

---

## 🚀 Neu: Standalone Offline PWA

- **Keine Serverabhängigkeit zur Laufzeit:** Nach dem ersten Aufruf kann der Node.js-/Express-Server komplett heruntergefahren werden.
- **Lokale IndexedDB-Datenbank (`DinoDrawDB`):**
  - Gespeicherte Level, Thumbnails und Originalzeichnungen bleiben dauerhaft im Browser gesichert.
  - Automatischer Import bestehender LocalStorage-Level (kein Datenverlust beim Update).
  - Schutz vor Speicherbereinigung durch `navigator.storage.persist()`.
  - JSON Export & Import für das einfache Teilen von Leveldateien (`.dino.json`).
  - Drei integrierte Starter-Level für den sofortigen Offline-Start.
- **Service Worker (`sw.js`):** Intelligentes Caching aller Skripte, Styles, Bilder und Audios mit Stale-While-Revalidate.

---

## 📲 Installation als PWA

### iPad & iPhone (iOS / iPadOS Safari)
1. Öffne die Web-App in Safari.
2. Tippe in der Navigationsleiste auf das **Teilen-Symbol** (Viereck mit Pfeil nach oben).
3. Scrolle nach unten und wähle **„Zum Home-Bildschirm“** (`➕`).
4. Tippe oben rechts auf **„Hinzufügen“**.  
*Die App startet nun als echte Vollbild-App ohne störende Safari-Leisten.*

### Android (Chrome / Edge / Samsung Internet)
1. Öffne die Web-App im mobilen Browser.
2. Tippe auf den Button **„📲 App installieren“** in der Kopfzeile oder im Browser-Menü auf **„App installieren“**.
3. Bestätige den Dialog – die App wird wie eine native Android-App installiert.

### Windows & Mac (Chrome / Edge)
1. Klicke in der Adressleiste auf das Installationssymbol (Computer mit Pfeil) oder den Button **„📲 App installieren“**.
2. Die App öffnet sich in einem separaten, randlosen Desktop-Fenster.

---

## ✏️ Tablet-First Optimierung (iPad & Android-Tablets)

Das Tablet ist das primäre Zielgerät für das Zeichnen und Spielen:
- **Apple Pencil & Stylus Support:** Erkennt `pointerType === "pen"` mit sanfter Druckempfindlichkeit (Pressure Sensitivity).
- **Palm Rejection (Handballenerkennung):** Versehentliche Handflächenberührungen werden ignoriert, während der Stift aktiv zeichnet.
- **Displayränder & Safe Areas:** Vollbilddarstellung unter Berücksichtigung von `env(safe-area-inset-*)`.
- **Gesten-Sperre:** Verhindert versehentliches Pull-to-Refresh und Wisch-Navigation (`overscroll-behavior: none`, `touch-action: none`).

---

## 📺 TV-Modus & Bildübertragung

Für das gemeinsame Spielen im Wohnzimmer auf dem großen Bildschirm:
- **Großes HUD:** Stark vergrößerte Anzeigen für Münzen, Dino-Eier und Texte (auch aus 3–4 Metern Entfernung lesbar).
- **Auto-Hide Touch Controls:** Die Touch-Tasten werden automatisch ausgeblendet, sobald ein Controller bedient wird.
- **Vollbild:** Randlose Theaterdarstellung des Spielfelds.

### Bildübertragung auf den Fernseher
1. **Apple AirPlay (iPad & iPhone):** Kontrollzentrum öffnen → *„Bildschirmsynchronisierung“* → Apple TV oder Smart TV wählen.
2. **Android Smart View / Google Cast:** Schnelleinstellungen nach unten ziehen → *„Smart View“* oder *„Bildschirm übertragen“* aktivieren.
3. **HDMI / USB-C Kabel:** Tablet oder Laptop per USB-C-auf-HDMI-Kabel verbinden für 0 ms Latenz.
4. **Tipp:** Das Mobilgerät im **Querformat (Landscape)** sperren, um das Fernsehbild optimal auszufüllen.

---

## 🎮 Controller-Unterstützung (Gamepad API)

Voll kompatibel mit **Xbox Wireless Controllern**, **PlayStation DualShock / DualSense** und generischen Bluetooth-Gamepads.

### Spielsteuerung
| Aktion | Tastatur | Xbox / Bluetooth Gamepad | Touchscreen |
|---|---|---|---|
| **Laufen** | `A` / `D` oder `◀` / `▶` | Linker Stick oder Steuerkreuz | Touch-Pfeile links |
| **Springen** | `Leertaste` / `W` / `▲` | `A` (Xbox) / `✕` (PlayStation) | Sprungtaste rechts |
| **Pause** | `Escape` | `Start` / `Options` | Pause-Taste oben |
| **Neustart** | `R` | `Y` (Xbox) / `△` (PlayStation) | Restart-Button nach Tod |

### Menü-Navigation per Controller
- **Steuerkreuz / Linker Stick:** Blättert durch Menüs und Levelkarten mit gut sichtbarem grünen Fokus-Glow.
- **A-Taste:** Wählt den fokussierten Menüpunkt aus.
- **B-Taste:** Geht zurück ins vorherige Menü oder schließt Modals.
- **Start-Taste:** Öffnet direkt die Einstellungen.

*Hinweis zu Browsern:* Unter iOS Safari und Chrome muss nach dem Verbinden eines Bluetooth-Controllers **einmal eine beliebige Taste gedrückt werden**, damit der Browser den Zugriff aus Sicherheitsgründen freigibt.

---

## 🛠️ Entwicklung & Statisches Hosting

### Lokale Entwicklung
```bash
# Abhängigkeiten installieren
npm install

# Entwicklungsserver (Vite)
npm run dev

# Typenprüfung ausführen
npm run typecheck

# Produktions-Bundle (PWA) erstellen
npm run build
```

### GitHub Pages / Statisches HTTPS-Hosting
Das Projekt ist so konfiguriert, dass der Ordner `client/dist/` komplett eigenständig auf jedem beliebigen HTTPS-Webspace oder via **GitHub Pages** bereitgestellt werden kann:
1. Führe `npm run build` aus.
2. Der Inhalt von `client/dist/` enthält relative Asset-Pfade (`./assets/`) und funktioniert sofort in Unterverzeichnissen (z. B. `https://username.github.io/dino-draw/`).
3. Kein Node.js-Backend zur Laufzeit erforderlich.

---

## 🧪 Durchgeführte Tests

- [x] **IndexedDB-Speicher:** Speichern, Laden, Duplizieren und Löschen von Leveln lokal ohne Express-Server.
- [x] **Starter-Level Seeding:** 3 Starter-Level (`Dinos Erstes Abenteuer`, `Portal-Express`, `Die 6 Farben-Arena`) validiert und beatable.
- [x] **PWA Manifest & Icons:** Vollständige Icons (192, 512, maskable, apple-touch-icon, favicon.svg) generiert und im Manifest verlinkt.
- [x] **Service Worker:** Offline-Caching mit Stale-While-Revalidate und sofortigem Offline-Start verifiziert.
- [x] **Gamepad & TV-Modus:** Controller-Auslesen, Auto-Hiding der Touch-Tasten und TV-HUD-Skalierung implementiert.
- [x] **Tablet & Stylus:** Palm Rejection und Druckdynamik für Apple Pencil / Stylus implementiert.
- [x] **Farberkennungs-Pipeline:** 6-Farben-Klassifikation und Portalen-Paarung 100% lokal ohne externe Cloud-APIs (5/5 Tests bestanden).
