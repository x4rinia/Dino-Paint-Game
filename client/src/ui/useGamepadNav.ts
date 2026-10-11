import { useEffect, useRef } from "react";

interface GamepadNavOptions {
  onBack?: () => void;
  onStart?: () => void;
  enabled?: boolean;
}

/**
 * Hook zur vollständigen Steuerung der Menüs per Gamepad (Xbox, PlayStation, Bluetooth).
 * Unterstützt Steuerkreuz, linken Stick, A-Taste (Bestätigen), B-Taste (Zurück), Start (Einstellungen).
 */
export function useGamepadNav({ onBack, onStart, enabled = true }: GamepadNavOptions = {}) {
  const lastAxesRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastButtonsRef = useRef<boolean[]>([]);
  const lastMoveTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    let rafId: number;

    const getFocusable = (): HTMLElement[] => {
      const selector = 'button:not([disabled]):not([aria-hidden="true"]), .menu-card, input:not([disabled]), [tabindex="0"]';
      return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";
      });
    };

    const focusAdjacent = (dir: "up" | "down" | "left" | "right") => {
      const items = getFocusable();
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      let currentIndex = active ? items.indexOf(active) : -1;

      document.body.classList.add("gamepad-mode-active");

      if (currentIndex === -1) {
        items[0].focus();
        items[0].scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }

      const currentRect = items[currentIndex].getBoundingClientRect();
      const currentCenter = {
        x: currentRect.left + currentRect.width / 2,
        y: currentRect.top + currentRect.height / 2,
      };

      let bestIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < items.length; i++) {
        if (i === currentIndex) continue;
        const rect = items[i].getBoundingClientRect();
        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };

        const dx = center.x - currentCenter.x;
        const dy = center.y - currentCenter.y;

        let isCandidate = false;
        if (dir === "right" && dx > 15) isCandidate = true;
        if (dir === "left" && dx < -15) isCandidate = true;
        if (dir === "down" && dy > 15) isCandidate = true;
        if (dir === "up" && dy < -15) isCandidate = true;

        if (isCandidate) {
          // Gewichtung in Hauptbewegungsrichtung
          const dist = dir === "left" || dir === "right"
            ? Math.abs(dx) + Math.abs(dy) * 2
            : Math.abs(dy) + Math.abs(dx) * 2;
          if (dist < minDistance) {
            minDistance = dist;
            bestIndex = i;
          }
        }
      }

      // Fallback: Lineares Weiterblättern falls kein geometrischer Nachbar gefunden wurde
      if (bestIndex === -1) {
        if (dir === "down" || dir === "right") {
          bestIndex = (currentIndex + 1) % items.length;
        } else {
          bestIndex = (currentIndex - 1 + items.length) % items.length;
        }
      }

      if (bestIndex >= 0 && bestIndex < items.length) {
        items[bestIndex].focus();
        items[bestIndex].scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    const handlePointerOrTouch = () => {
      document.body.classList.remove("gamepad-mode-active");
    };
    window.addEventListener("pointerdown", handlePointerOrTouch, { passive: true });
    window.addEventListener("touchstart", handlePointerOrTouch, { passive: true });

    const poll = () => {
      if (typeof navigator.getGamepads !== "function") {
        rafId = requestAnimationFrame(poll);
        return;
      }

      const gamepads = navigator.getGamepads();
      const now = Date.now();

      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp || !gp.connected) continue;

        const stickX = gp.axes[0] ?? 0;
        const stickY = gp.axes[1] ?? 0;
        const dpadUp = gp.buttons[12]?.pressed ?? false;
        const dpadDown = gp.buttons[13]?.pressed ?? false;
        const dpadLeft = gp.buttons[14]?.pressed ?? false;
        const dpadRight = gp.buttons[15]?.pressed ?? false;

        const btnA = gp.buttons[0]?.pressed ?? false; // A / Kreuz
        const btnB = gp.buttons[1]?.pressed ?? false; // B / Kreis
        const btnStart = gp.buttons[9]?.pressed ?? false; // Start / Options

        const prevA = lastButtonsRef.current[0] ?? false;
        const prevB = lastButtonsRef.current[1] ?? false;
        const prevStart = lastButtonsRef.current[9] ?? false;

        // Bestätigen (A)
        if (btnA && !prevA) {
          document.body.classList.add("gamepad-mode-active");
          const active = document.activeElement as HTMLElement | null;
          if (active && typeof active.click === "function") {
            active.click();
          } else {
            const first = getFocusable()[0];
            first?.focus();
            first?.click();
          }
        }

        // Zurück (B)
        if (btnB && !prevB && onBack) {
          onBack();
        }

        // Start (Options)
        if (btnStart && !prevStart && onStart) {
          onStart();
        }

        // D-Pad / Stick Bewegung mit 220ms Cooldown für kontrollierte Einzelschritte
        if (now - lastMoveTimeRef.current > 220) {
          if (stickX > 0.45 || dpadRight) {
            focusAdjacent("right");
            lastMoveTimeRef.current = now;
          } else if (stickX < -0.45 || dpadLeft) {
            focusAdjacent("left");
            lastMoveTimeRef.current = now;
          } else if (stickY > 0.45 || dpadDown) {
            focusAdjacent("down");
            lastMoveTimeRef.current = now;
          } else if (stickY < -0.45 || dpadUp) {
            focusAdjacent("up");
            lastMoveTimeRef.current = now;
          }
        }

        lastButtonsRef.current[0] = btnA;
        lastButtonsRef.current[1] = btnB;
        lastButtonsRef.current[9] = btnStart;
        lastAxesRef.current = { x: stickX, y: stickY };
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointerdown", handlePointerOrTouch);
      window.removeEventListener("touchstart", handlePointerOrTouch);
    };
  }, [enabled, onBack, onStart]);
}
