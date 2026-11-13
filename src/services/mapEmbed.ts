// set VITE_MAP_URL, or drop the map in public/data for local testing
export const MAP_URL: string =
  import.meta.env.VITE_MAP_URL ?? `${import.meta.env.BASE_URL}data/new_roots_map.html`
