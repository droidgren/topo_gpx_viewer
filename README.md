# Topo GPX Viewer

A lightweight, browser-based tool for viewing and exploring GPX routes on topographic maps. Built as a Progressive Web App (PWA) — works on desktop and mobile, no installation required.

🌐 **Live demo:** https://droidgren.github.io/topo_gpx_viewer/app/index.html

Also check out **Elevation Finder**, a tool for checking ground elevation on the map by clicking a location or searching for a place: [Live page](https://droidgren.github.io/elevation_finder/) | [GitHub repository](https://github.com/droidgren/elevation_finder)

## Features

- **Multiple map layers** — OpenTopo, Lantmäteriet, ThunderForest Outdoors, Tracetrack Topo, OSM, and Satellite (ESRI)
- **GPX file support** — Load GPX files to display tracks, routes, and waypoints
- **Track styling** — Customizable track color and width
- **Distance labels** — Toggle kilometer/mile markers along the track
- **Slope coloring** — Visualize uphills and downhills with gradient coloring
- **Elevation stats** — Track length, elevation gain/loss, min/max elevation
- **Elevation profile** — Interactive bottom bar showing the track elevation profile with cursor tracking and optional map sync
- **Min/Max markers** — Show highest and lowest points on the track
- **Waypoint display** — Toggle GPX waypoints with labels
- **Map rotation** — Ctrl+drag on desktop, two-finger rotate on touch devices
- **Location search** — Search by place name or coordinates
- **Geolocation** — Jump to your current GPS position with a live position marker
- **Center crosshair** — Toggle a map-center crosshair on/off from settings
- **Share map view** — Copy a link containing zoom, center, and selected map layer
- **Backend-backed GPX sharing** — In self-hosted mode, upload GPX files, reopen them from the server, and share them with an unlisted link
- **PWA** — Install as an app on mobile or desktop
- **Bilingual** — English and Swedish

## Getting Started

1. Open the [live demo](https://droidgren.github.io/topo_gpx_viewer/app/index.html)) or serve the files locally
2. Click **📂 Load GPX track** to load a GPX file
3. Explore the track with distance labels, slope coloring, and elevation stats

## Run With FastAPI Backend

### Local Python Run
- Install dependencies with `pip install -r requirements.txt`
- Start the backend with `uvicorn main:app --host 0.0.0.0 --port 8000`
- Open `http://localhost:8000/`
- In `app/script.js`, set `BACKEND_AVAILABLE` to `true` when serving the frontend with the FastAPI backend

### Docker Run
- Build the image with `docker build -t topo-gpx-viewer .`
- Run it with persistent storage using `docker run -p 8000:8000 -v topo-gpx-data:/app/gpx-files topo-gpx-viewer`
- Put NPM in front of the container and route the public site to the same FastAPI service

### Backend Environment Variables
- `GPX_APP_DIR` — optional override for the frontend asset directory. Default: `app`
- `GPX_UPLOAD_DIR` — optional override for the GPX file storage directory
- `GPX_INDEX_PATH` — optional override for the metadata index JSON file
- `GPX_MAX_UPLOAD_BYTES` — maximum upload size in bytes. Default: `10485760`

### Frontend Backend Toggle
- `app/script.js` contains a `BACKEND_AVAILABLE` flag for deployments without the FastAPI backend
- Set `BACKEND_AVAILABLE = false` for static/local-only deployments: GPX files open directly in the browser and Share copies only the current map view
- Set `BACKEND_AVAILABLE = true` for backend-backed deployments: local GPX files are uploaded, listed, reopenable, and shareable with `?gpx=<id>` links

## Repo Layout

- `app/` — frontend assets (`index.html`, `script.js`, `style.css`, `manifest.json`, `service-worker.js`, `icon.svg`)
- `app/lang/` — language files
- `gpx-files/` — uploaded GPX files and `gpx-index.json`
- `main.py` — FastAPI backend entrypoint

## Usage

### Map Controls
- **Zoom** — Scroll wheel or pinch gesture
- **Rotate** — Hold Ctrl and drag (desktop) or two-finger rotate (touch). Click the compass icon to reset north.
- **Layers** — Select a map layer from the dropdown

### GPX Tracks
- Load a `.gpx` file containing tracks, routes, or waypoints
- Customize track color and width
- Toggle distance markers, slope coloring, waypoints, and min/max elevation markers
- View track statistics: length, elevation gain/loss, min/max elevation

### Share Map View
- Click **🔗 Share Map View** to copy a URL with your current map state
- Map-only shared links use hash format: `#map=zoom/lat/lng/layer`
- If `BACKEND_AVAILABLE` is `true` and a backend-stored GPX route is active, the shared link also includes `?gpx=<id>`
- If `BACKEND_AVAILABLE` is `false`, locally opened GPX routes stay local and the shared link remains map-only
- Opening a shared link restores the same map zoom, center, layer, and shared GPX route

### Self-Hosted GPX Uploads
- A self-hosted FastAPI backend can expose `/api/upload`, `/api/files`, and `/api/files/{id}/raw`
- Uploaded GPX files can be listed in the app and reopened later from the server
- For persistent storage, mount a disk volume into the FastAPI container so GPX files survive restarts and redeploys
- Uploads reuse the same opaque ID when the same filename is uploaded again, so existing share links keep working

### Search
- Type a place name or coordinates (e.g. `59.33, 18.07`) in the search box
- Click the GPS button to center on your current location

## Changelog

### v0.3
- Added a **Share Map View** button to copy map-state links
- Added map-state restore from URL hash using `#map=zoom/lat/lng/layer`
- Added a dedicated tutorial spotlight step for Share Map View
- Started self-hosted GPX upload and shared-route integration for FastAPI-backed deployments

### v0.21
- Added a toggleable center crosshair setting
- Added a live GPS position marker that updates continuously while geolocation is active
- Updated the center/GPS marker styling to match the elevation_finder lock-radius marker design

### v0.2
- Elevation profile bar with interactive cursor tracking and map marker
- Drag or hover along the profile to follow the route on the map
- Arrow key stepping: ← → to walk the dot along the track, Shift for bigger steps, Escape to clear
- Map sync: optionally center the map on the current profile position
- Toggle elevation profile on/off from the control panel
- Minimize/expand the profile bar

### v0.1
- Initial release
- GPX track loading with customizable styling
- Distance labels and slope coloring
- Multiple map layers
- Location search and geolocation
- PWA support
- English and Swedish language support

## License

MIT
