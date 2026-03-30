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
- **Min/Max markers** — Show highest and lowest points on the track
- **Waypoint display** — Toggle GPX waypoints with labels
- **Map rotation** — Ctrl+drag on desktop, two-finger rotate on touch devices
- **Location search** — Search by place name or coordinates
- **Geolocation** — Jump to your current GPS position
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

### Search
- Type a place name or coordinates (e.g. `59.33, 18.07`) in the search box
- Click the GPS button to center on your current location

## Changelog

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
