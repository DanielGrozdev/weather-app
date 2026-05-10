import { Clock, LoaderCircle, MapPin, Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
// (clamp activeIndex in render rather than syncing via useEffect)
import { cityKey, type CityResult } from "../../types";
import { useCitySearch } from "../../hooks/useCitySearch";
import { useRecentCities } from "../../hooks/useRecentCities";
import { HighlightMatch } from "./HighlightMatch";
import { useTranslation } from "react-i18next";

type Props = {
  selectedCity: CityResult | null;
  onSelect: (city: CityResult) => void;
  className?: string;
};

function formatCity(city: CityResult | null): string {
  if (!city) return "";
  return [city.name, city.state, city.country].filter(Boolean).join(", ");
}

export default function CitySearch({
  selectedCity,
  onSelect,
  className,
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [isActive, setActive] = useState(false);
  // Stored activeIndex may briefly be out of range when items change. We clamp
  // it during render (`activeIndex` below) and inside keyboard handlers, so we
  // don't need an effect to keep it in sync.
  const [activeIndexRaw, setActiveIndex] = useState(-1);

  const { t } = useTranslation();
  const { data, isFetching, isError, isSearching, isMinLength } =
    useCitySearch(query);
  const { recents, add: rememberCity, clear: clearRecents } = useRecentCities();

  // What populates the dropdown:
  //   - typed query (>= 2 chars) → search results
  //   - empty query → recent picks
  const items = useMemo<CityResult[]>(() => {
    if (isMinLength) return data ?? [];
    return recents;
  }, [data, recents, isMinLength]);

  const showRecentsHeader = !isMinLength && recents.length > 0;
  const showEmptyState =
    isActive && isMinLength && !isFetching && (data?.length ?? 0) === 0;

  // The visible value: typed query while focused/active, otherwise the picked city.
  const inputValue = isActive ? query : formatCity(selectedCity);

  // Clamp the stored highlight index to the current items array. If items
  // shrink between renders, this hides the stale highlight without needing
  // an effect to reset the underlying state.
  const activeIndex =
    activeIndexRaw >= 0 && activeIndexRaw < items.length ? activeIndexRaw : -1;

  // Click-outside closes the dropdown without committing.
  useEffect(() => {
    if (!isActive) return;
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setActive(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isActive]);

  const commitSelection = useCallback(
    (city: CityResult) => {
      rememberCity(city);
      onSelect(city);
      setActive(false);
      setQuery("");
      setActiveIndex(-1);
      inputRef.current?.blur();
    },
    [onSelect, rememberCity],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isActive) setActive(true);
      setActiveIndex((raw) => {
        if (items.length === 0) return -1;
        const cur = raw >= 0 && raw < items.length ? raw : -1;
        return (cur + 1) % items.length;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isActive) setActive(true);
      setActiveIndex((raw) => {
        if (items.length === 0) return -1;
        const cur = raw >= 0 && raw < items.length ? raw : 0;
        return cur <= 0 ? items.length - 1 : cur - 1;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target =
        activeIndex >= 0 && activeIndex < items.length
          ? items[activeIndex]
          : items[0];
      if (target) commitSelection(target);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setActive(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const dropdownOpen =
    isActive && (items.length > 0 || isSearching || showEmptyState || isError);

  return (
    <div
      ref={rootRef}
      className={["relative", className].filter(Boolean).join(" ")}
    >
      {/* INPUT */}
      <div
        className={[
          "group flex items-center gap-2 h-10 px-3 rounded-full",
          "bg-card/50 backdrop-blur-md border border-border",
          "transition-all duration-200",
          isActive
            ? "border-ring ring-3 ring-ring/30 bg-card"
            : "hover:border-border/80",
        ].join(" ")}
      >
        <Search
          className={[
            "size-4 shrink-0 transition-colors",
            isActive ? "text-foreground" : "text-muted-foreground",
          ].join(" ")}
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={dropdownOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && items[activeIndex]
              ? `${listboxId}-${cityKey(items[activeIndex])}`
              : undefined
          }
          placeholder={t("search.placeholder")}
          value={inputValue}
          onChange={(e) => {
            setActive(true);
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={(e) => {
            setActive(true);
            // Pre-select the displayed city name so typing replaces it.
            e.target.select();
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70 min-w-0"
        />
        {isSearching ? (
          <LoaderCircle className="size-4 shrink-0 text-muted-foreground animate-spin" />
        ) : isActive && query.length > 0 ? (
          <button
            type="button"
            aria-label={t("search.clearSearch")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="size-5 rounded-full grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* DROPDOWN */}
      {dropdownOpen && (
        <div
          className={[
            "absolute left-0 right-0 mt-2 z-1001",
            "rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl",
            "overflow-hidden",
            "animate-in fade-in-0 slide-in-from-top-1 duration-150",
          ].join(" ")}
          role="listbox"
          id={listboxId}
        >
          {showRecentsHeader && (
            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                <Clock className="size-3" />
                {t("search.recent")}
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  clearRecents();
                  setActiveIndex(-1);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("search.clear")}
              </button>
            </div>
          )}

          {isFetching && items.length === 0 && (
            <div className="px-3 py-2 space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-8 rounded-md bg-muted/40 animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </div>
          )}

          {isError && (
            <div className="px-3 py-4 text-sm text-destructive text-center">
              {t("search.error")}
            </div>
          )}

          {showEmptyState && (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              {t("search.noResults", { query: query.trim() })}
            </div>
          )}

          {items.length > 0 && (
            <ul className="max-h-72 overflow-y-auto py-1">
              {items.map((city, idx) => {
                const id = `${listboxId}-${cityKey(city)}`;
                const isActiveItem = idx === activeIndex;
                const isSelected =
                  selectedCity != null &&
                  cityKey(selectedCity) === cityKey(city);
                return (
                  <li
                    key={cityKey(city)}
                    role="option"
                    id={id}
                    aria-selected={isActiveItem}
                  >
                    <button
                      type="button"
                      // Don't blur the input when clicking an item.
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => commitSelection(city)}
                      className={[
                        "w-full flex items-center gap-3 px-3 py-2 text-left",
                        "transition-colors",
                        isActiveItem ? "bg-muted/60" : "hover:bg-muted/40",
                      ].join(" ")}
                    >
                      <MapPin
                        className={[
                          "size-4 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        ].join(" ")}
                      />
                      <div className="flex-1 min-w-0 flex items-baseline gap-2">
                        <span className="text-sm text-muted-foreground truncate">
                          <HighlightMatch text={city.name} query={query} />
                        </span>
                        <span className="text-xs text-muted-foreground/70 truncate">
                          {[city.state, city.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
