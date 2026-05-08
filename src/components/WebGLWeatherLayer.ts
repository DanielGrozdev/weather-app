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

const worker = new Worker(new URL("../weatherTile.worker", import.meta.url), {
  type: "module",
});

let requestId = 0;

export const WebGLWeatherLayer = L.GridLayer.extend({
  createTile(this: WeatherLayer, coords) {
    const tile = document.createElement("canvas");
    const ctx = tile.getContext("2d")!;

    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const url = this.options.getTileUrl(coords);

    const id = requestId++;

    worker.postMessage({
      id,
      url,
      width: size.x,
      height: size.y,
      coords,
    });

    const handler = (e: MessageEvent) => {
      const { bitmap, id: resId } = e.data;

      // ignore old/outdated responses
      if (resId !== id) return;

      ctx.clearRect(0, 0, size.x, size.y);
      ctx.drawImage(bitmap, 0, 0);

      worker.removeEventListener("message", handler);
    };

    worker.addEventListener("message", handler);

    return tile;
  },
});
