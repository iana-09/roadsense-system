const cartoKey = import.meta.env.VITE_CARTO_BASEMAP_KEY?.trim();

export const CARTO_TILE_URL =
  `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${cartoKey ? `?key=${encodeURIComponent(cartoKey)}` : ''}`;

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, ' +
  '&copy; <a href="https://carto.com/attribution/">CARTO</a>';
