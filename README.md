# Topo GPX Viewer

A lightweight, browser-based tool for viewing, editing, and exporting GPX routes on topographic maps. Built as a Progressive Web App (PWA) — works on desktop and mobile, no installation required.

🌐 **Live demo:** [https://droidgren.github.io/topo_gpx_viewer/](https://droidgren.github.io/topo_gpx_viewer/)

## Features

- **Multiple map layers** — OpenTopo, Lantmäteriet, ThunderForest Outdoors, Tracetrack Topo, OSM, and Satellite (ESRI)
- **GPX file support** — Load GPX files to display and edit tracks, routes, and waypoints
- **Route editing** — Edit tracks with anchor points, routed road-network geometry, or straight-line segments
- **Zoom-aware anchors** — Imported GPX files generate anchor points automatically, with more detail revealed as you zoom in
- **GPX metadata editing** — Rename the GPX and edit its activity/type before export
- **Waypoint editing** — Add, move, rename, and delete points of interest directly on the map
- **GPX export** — Download the edited result as a new GPX file
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
- **PWA** — Install as an app on mobile or desktop
- **Bilingual** — English and Swedish

## Getting Started

1. Open the [live demo](https://droidgren.github.io/topo_gpx_viewer/) or serve the files locally
2. Click **📂 Load GPX Route** to load a GPX file, or **✏ New Route** to start from an empty route
3. Explore or edit the track with distance labels, slope coloring, elevation stats, anchors, and waypoint tools

## Usage

### Map Controls
- **Zoom** — Scroll wheel or pinch gesture
- **Rotate** — Hold Ctrl and drag (desktop) or two-finger rotate (touch). Click the compass icon to reset north.
- **Layers** — Select a map layer from the dropdown

### GPX Tracks
- Load a `.gpx` file containing tracks, routes, or waypoints
- Enter edit mode to place anchors, drag anchors, and insert anchors along segments
- Toggle routing off to connect anchors with straight lines, or keep routing on to use an OSRM-compatible road network
- Edit the GPX name and activity/type from the route editor panel
- Add and edit waypoints directly on the map
- Export the edited result as a new `.gpx` file
- Customize track color and width
- Toggle distance markers, slope coloring, waypoints, and min/max elevation markers
- View track statistics: length, elevation gain/loss, min/max elevation

### Editing Notes
- Imported multi-segment GPX files keep their segment structure; the first editor release lets you edit one active segment at a time
- Edited routed geometry fetches elevation from an OpenTopoData-compatible service so the elevation profile and gain/loss remain available
- The default build uses public OSRM-compatible and OpenTopoData-compatible endpoints. For production use, point these constants at your own services if you need stronger availability or quotas

### Search
- Type a place name or coordinates (e.g. `59.33, 18.07`) in the search box
- Click the GPS button to center on your current location

## Changelog

### v0.30
- Added GPX edit mode with anchor-based route editing
- Added routed versus straight-line editing toggle
- Added automatic anchor generation for imported GPX files with zoom-based visibility
- Added waypoint creation, moving, renaming, and deletion
- Added GPX name/activity editing and GPX export
- Added elevation refresh for edited geometry

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
