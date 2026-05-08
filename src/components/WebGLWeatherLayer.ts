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
};

export const WebGLWeatherLayer = L.GridLayer.extend({
  createTile(this: WeatherLayer, coords: WeatherTileCoords) {
    const tile = document.createElement("canvas");
    const ctx = tile.getContext("2d")!;

    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const url = this.options.getTileUrl(coords);

    const img = new Image();
    let alpha = 0;

    img.onload = () => {
      const draw = () => {
        ctx.clearRect(0, 0, size.x, size.y);

        ctx.globalAlpha = alpha;
        ctx.drawImage(img, 0, 0, size.x, size.y);

        if (alpha < 1) {
          alpha += 0.1;
          requestAnimationFrame(draw);
        }
      };

      draw();
    };

    img.src = url;

    return tile;
  },
});
