import { useEffect } from "react";

/**
 * Hook to warn users before leaving the page during critical operations
 */
export function useBeforeUnload(enabled: boolean, message?: string) {
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers ignore custom messages, but we still need to set returnValue
      event.returnValue = message || "Are you sure you want to leave? Your generation is still in progress.";
      return event.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, message]);
}
