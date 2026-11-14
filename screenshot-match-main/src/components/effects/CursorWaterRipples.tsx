import { useEffect, useRef } from "react";

/**
 * Small cursor-following water ripples, inspired by water surface rings.
 * Uses no React state: individual decorative rings animate and self-remove.
 * Pointer events pass through; disabled on touch/reduced-motion devices.
 */
export function CursorWaterRipples() {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let lastWave = -Infinity;

    const onPointerMove = (event: PointerEvent) => {
      if (!media.matches || event.pointerType !== "mouse") return;
      if (document.visibilityState !== "visible") return;
      if (event.timeStamp - lastWave < 95) return;
      const layer = layerRef.current;
      if (!layer) return;
      lastWave = event.timeStamp;

      const ring = document.createElement("span");
      ring.className = "awqaat-water-wave";
      ring.style.left = `${event.clientX}px`;
      ring.style.top = `${event.clientY}px`;
      ring.setAttribute("aria-hidden", "true");

      // A hard cap keeps the effect lightweight even with rapid mouse input.
      if (layer.childElementCount >= 9) layer.firstElementChild?.remove();
      layer.appendChild(ring);
      ring.addEventListener("animationend", () => ring.remove(), { once: true });
    };

    const clear = () => { layerRef.current?.replaceChildren(); };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, []);

  return <div ref={layerRef} className="awqaat-water-ripples" aria-hidden="true" />;
}
