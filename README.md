# Topo GPX Viewer

A lightweight, browser-based tool for viewing and exploring GPX routes on topographic maps. Built as a Progressive Web App (PWA) — works on desktop and mobile, no installation required.

🌐 **Live demo:** [https://droidgren.github.io/topo_gpx_viewer/](https://droidgren.github.io/topo_gpx_viewer/)

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
- **PWA** — Install as an app on mobile or desktop
- **Bilingual** — English and Swedish

## Getting Started

1. Open the [live demo](https://droidgren.github.io/topo_gpx_viewer/) or serve the files locally
2. Click **📂 Load GPX track** to load a GPX file
3. Explore the track with distance labels, slope coloring, and elevation stats

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
- Shared links use hash format: `#map=zoom/lat/lng/layer`
- Opening a shared link restores the same map zoom, center, and layer

### Search
- Type a place name or coordinates (e.g. `59.33, 18.07`) in the search box
- Click the GPS button to center on your current location

## Changelog

### v0.3
- Added a **Share Map View** button to copy map-state links
- Added map-state restore from URL hash using `#map=zoom/lat/lng/layer`
- Added a dedicated tutorial spotlight step for Share Map View

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
