import L from "leaflet";

export type WeatherTileCoords = {
  x: number;
  y: number;
  z: number;
};

export type WeatherLayerOptions = L.GridLayerOptions & {
  getTileUrl: (coords: WeatherTileCoords) => string;
};

export type WeatherLayer = L.GridLayer & {
  options: WeatherLayerOptions;
  redraw: () => void;
  setTileUrl: (getTileUrl: (coords: WeatherTileCoords) => string) => void;
};

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker(new URL("../weatherTile.worker", import.meta.url), {
  type: "module",
});

let requestId = 0;

/**
 * Single message listener — O(1) dispatch via Map lookup.
 * Replaces the old pattern of attaching one addEventListener per tile, which
 * kept O(n) live closures and caused a small but real memory/CPU leak when
 * tiles were pruned faster than the listener fired.
 */
const pendingCallbacks = new Map<number, (bitmap: ImageBitmap | null) => void>();

worker.addEventListener("message", (e: MessageEvent) => {
  const { id, bitmap } = e.data as { id: number; bitmap: ImageBitmap | null };
  const cb = pendingCallbacks.get(id);
  if (cb) {
    pendingCallbacks.delete(id);
    cb(bitmap ?? null);
  }
});

// ─── Layer ────────────────────────────────────────────────────────────────────

export const WebGLWeatherLayer = L.GridLayer.extend({
  createTile(this: WeatherLayer, coords: WeatherTileCoords) {
    const tile = document.createElement("canvas");
    const ctx = tile.getContext("2d")!;
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const url = this.options.getTileUrl(coords);
    const id = requestId++;
    let cancelled = false;

    pendingCallbacks.set(id, (bitmap) => {
      if (bitmap && !cancelled) {
        ctx.clearRect(0, 0, size.x, size.y);
        ctx.drawImage(bitmap, 0, 0);
      }
    });

    worker.postMessage({ id, url, width: size.x, height: size.y, coords });

    /**
     * Leaflet calls tile.remove() when the tile is pruned or the layer redraws.
     * Mark cancelled so we skip the draw, and remove the callback so the id
     * slot is freed immediately (worker reply is still received but dropped).
     */
    (tile as HTMLCanvasElement & { remove(): void }).remove = () => {
      cancelled = true;
      pendingCallbacks.delete(id);
    };

    return tile;
  },

  /**
   * Update the tile URL function without destroying/recreating the layer.
   * Leaflet retains its internal tile buffer and WebGL context across this call —
   * only the visible tiles are re-requested with the new URL.
   */
  setTileUrl(
    this: WeatherLayer,
    getTileUrl: (coords: WeatherTileCoords) => string,
  ) {
    // Cancel all pending callbacks — their URLs are now stale.
    pendingCallbacks.clear();
    this.options.getTileUrl = getTileUrl;
    this.redraw();
  },
});
