import { useEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize((previous) => {
        const width = Math.max(0, Math.round(rect.width));
        const height = Math.max(0, Math.round(rect.height));
        if (previous.width === width && previous.height === height) return previous;
        return { width, height };
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return [ref, size] as const;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * 在几何切换时对数值做平滑插值。节点集合不变时（如对数弧长开关），
 * 逐项补间；集合变化时（如筛选关系）直接切换，避免错位。
 */
export function useTweenedAngles<T extends { key: string; values: number[] }>(
  targets: T[],
  enabled: boolean,
): T[] {
  const [display, setDisplay] = useState<T[]>(targets);
  const frameRef = useRef<number | null>(null);
  const previousRef = useRef<T[]>(targets);

  useEffect(() => {
    const sameShape =
      targets.length === display.length &&
      targets.every((target, index) => target.key === display[index]?.key);

    if (!enabled || !sameShape || prefersReducedMotion()) {
      previousRef.current = targets;
      setDisplay(targets);
      return;
    }

    const from = previousRef.current;
    const start = performance.now();
    const duration = 280;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = targets.map((target, index) => {
        const source = from[index];
        if (!source || source.key !== target.key) return target;
        return {
          ...target,
          values: target.values.map((value, valueIndex) => {
            const base = source.values[valueIndex] ?? value;
            return base + (value - base) * eased;
          }),
        };
      });
      setDisplay(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = targets;
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targets, enabled]);

  return display;
}
