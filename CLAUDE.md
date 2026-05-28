# Breezy

## Goal

Wind/weather map UI (MapLibre). Priority = smooth rendering > everything else.

---

## Core Rules

### Map

- Never recreate map sources/layers unless required
- Never clear weather layers during updates
- Prefer mutation over React re-render
- Preserve previous tiles until new load completes
- Avoid flicker / blank tiles at all costs

### Performance

- No state updates during map movement
- Throttle/debounce all pointer/move events
- Use memo + refs for derived map state
- Avoid unnecessary React renders
- Prefer requestAnimationFrame for visual sync

### Network

- Minimize tile refetching
- Reuse sources whenever possible
- Avoid URL churn / source replacement
- Cache-first behavior always

---

## UI

- Minimal dark glass UI
- Cheap animations only
- No heavy blur/shadows over large areas

---

## Time Slider

- Must feel instant
- No full layer reload on scrub
- Prefer index-based control over time arrays
- Avoid time-derived state loops

---

## Code Style

- Small diffs only
- No large refactors
- Keep logic local to component
- Prefer refs over state for fast-changing values

---

## Anti-patterns

- rebuilding map sources per render
- storing derived time arrays in state
- syncing state inside effects without guards
- unthrottled map event handlers
