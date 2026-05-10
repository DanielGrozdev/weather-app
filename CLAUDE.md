# CLAUDE.md

## App Overview

Interactive weather map application built with:

- React / Next.js
- TypeScript
- MapLibre GL
- Weather raster tile layers
- Realtime weather overlays
- Time slider + animated weather data

Primary UX goal:

- Smooth, seamless map interaction similar to Windy/Breezy
- No visible empty tiles during drag/zoom
- Fast overlay updates
- Minimal CPU/GPU/network usage

---

# Engineering Priorities

Priority order:

1. Smooth map rendering
2. Eliminate tile flickering/loading gaps
3. Reduce rerenders
4. Minimize network requests
5. Keep code simple
6. Preserve mobile performance

Avoid:

- Large refactors
- New heavy dependencies
- Complex abstractions
- Recreating map sources/layers unnecessarily

---

# MapLibre Rules

## Rendering

- Keep previous raster tiles visible until new ones load
- Never clear weather layers during updates
- Avoid visible flashes/flickers
- Prefer incremental updates over full source replacement
- Use lightweight transitions only

## Performance

- Memoize expensive computations
- Avoid React state updates during map movement
- Throttle/debounce move handlers
- Use requestAnimationFrame for visual updates
- Avoid unnecessary layer/source recreation
- Prefer direct map instance mutations where possible

## Tile Loading

Focus heavily on:

- raster-fade-duration
- tile cache behavior
- preloading neighboring tiles
- minimizing blank tiles during pan
- preserving already-loaded tiles
- reducing duplicate tile requests

Prefer:

- persistent raster sources
- stable tile URLs
- minimal source invalidation

---

# UI Guidelines

UI style:

- Glassmorphism
- Minimal
- Dark weather-map aesthetic
- Smooth animations only when cheap

Avoid:

- Heavy shadows
- Expensive blur effects on large areas
- Excessive animations
- Layout thrashing

---

# Time Slider

- Time slider must feel instant
- Avoid full weather layer reloads if possible
- Reuse existing source/layer structures
- Minimize tile refreshes during scrubbing

---

# Code Style

- TypeScript strict mode
- Functional React components
- Keep files readable
- Prefer small targeted diffs
- Avoid premature abstractions

When editing:

- Explain root cause briefly
- Implement smallest effective fix
- Preserve existing behavior
- Mention tradeoffs shortly

---

# Output Expectations

For code suggestions:

- Show only relevant snippets/diffs
- Keep explanations concise
- Optimize for production UX
- Focus on real-world rendering performance

---

# Important Files

High-impact files:

- /src/components/Map.tsx
- weather layer utilities
- tile source configuration
- time slider logic
- animation/frame update logic

Changes in these files must prioritize rendering smoothness and tile stability.
