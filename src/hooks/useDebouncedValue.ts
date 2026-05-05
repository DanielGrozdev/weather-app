import { useEffect, useState } from "react";

/**
 * Returns a value that updates only after `delay` ms have passed without
 * further changes. Useful for keeping fast-changing inputs (search boxes,
 * sliders) from triggering downstream work on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
