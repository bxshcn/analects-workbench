import { useEffect } from "react";
import { useAnalectsStore } from "../store/analectsStore";
import { prefersReducedMotion } from "./useElementSize";

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function useKeyboardElevator(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableElement(event.target)) return;
      const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

      if (event.key === "j") {
        const panel = document.getElementById("index-panel");
        if (panel) {
          event.preventDefault();
          panel.scrollIntoView({ behavior, block: "start" });
        }
        return;
      }
      if (event.key === "k") {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior });
        return;
      }
      if (event.key === "Escape") {
        useAnalectsStore.getState().clearFocus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}

export function useToastTimer(): void {
  const toast = useAnalectsStore((state) => state.toast);
  const dismissToast = useAnalectsStore((state) => state.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismissToast(), 3000);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);
}
