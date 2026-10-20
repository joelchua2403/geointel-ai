# GeoIntel AI — Terminal Dashboard Layout

This is a **frontend-only redesign** based on your uploaded reference screenshot. It preserves your existing FastAPI API contract and Ollama workflow.

## Install

1. Copy `App.tsx` and `App.css` to `frontend/src/`.
2. Copy `WorldMap.tsx` to `frontend/src/components/`.
3. **Keep your existing** `frontend/src/utils/locations.ts` (the expanded file from the previous step).
4. Ensure `frontend/src/index.css` does not impose Vite's default centered `#root`/`body` layout. You can replace it with:
   ```css
   html, body, #root { margin: 0; width: 100%; min-height: 100%; }
   ```
5. From `frontend/`, run `npm install leaflet react-leaflet` and `npm install -D @types/leaflet` if needed, then `npm run dev`.
6. Keep FastAPI and CPU-mode Ollama running for AI briefing generation.

## Functionality

- Full-screen dark intelligence-terminal layout inspired by the screenshot.
- Guardian live news, debounced search, category tabs and refresh.
- React Leaflet global map using working OpenStreetMap tiles, darkened via CSS; no CARTO/Mapbox key.
- Purple markers for locations mentioned in headlines, clickable popups with article links.
- Clicking news headlines flies the map to a matched location.
- Optional reference markers for five strategic maritime areas (not live incidents).
- AI briefing panel with deterministic original-article citation links.
- Responsive narrow-screen layout.

## Notes

- The screenshot's market data, conflict feeds, and threat index require separate real data sources and are deliberately **not fabricated** here.
- Geolocation uses text matching; markers represent geographic mentions, not verified event locations.
- Guardian `GET /api/articles` should return an array or `{ "articles": [...] }`. `POST /api/briefing` should accept `{ "articles": [...] }` and return structured briefing fields.
- If your FastAPI routes or Article fields differ, adjust `API` and the `Article` type in `App.tsx`.
