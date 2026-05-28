import { type RefObject, useEffect } from "react";

// Fires `callback` when a mousedown event lands outside `ref`. Attach the ref
// to the root container of the popup/dropdown. Pass `active=false` to skip the
// listener entirely (avoids adding/removing on every render).
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
  active = true,
) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ref, callback]);
}
