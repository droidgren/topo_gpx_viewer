// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const APP_VERSION = "0.30";

// Base64 flags
const FLAG_SE = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNiAxMCI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjEwIiBmaWxsPSIjMDA2YWE3Ii8+PHJlY3QgeD0iNSIgd2lkdGg9IjIiIGhlaWdodD0iMTAiIGZpbGw9IiNmZWNjMDAiLz48cmVjdCB5PSI0IiB3aWR0aD0iMTYiIGhlaWdodD0iMiIgZmlsbD0iI2ZlY2MwMCIvPjwvc3ZnPg==";
const FLAG_GB = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MCAzMCI+PHBhdGggZmlsbD0iIzAxMjE2OSIgZD0iTTAgMGg2MHYzMEgwVjB6Ii8+PHBhdGggc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjYiIGQ9Ik0wIDAgNjAgMzBNNjAgMCAwIDMwIi8+PHBhdGggc3Ryb2tlPSIjQzgxMDJFIiBzdHJva2Utd2lkdGg9IjQiIGQ9Ik0wIDAgNjAgMzBNNjAgMCAwIDMwIi8+PHBhdGggc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEwIiBkPSJNMzAgMHYzME0wIDE1aDYwIi8+PHBhdGggc3Ryb2tlPSIjQzgxMDJFIiBzdHJva2Utd2lkdGg9IjYiIGQ9Ik0zMCAwdjMwTTAgMTVoNjAiLz48L3N2Zz4=";

// Services requiring API keys
const lockedServices = {
    'tracetrack': {
        name: 'Tracetrack Topo',
        storageKey: 'tracetrack_key',
        link: 'https://www.tracestrack.com/',
        urlTemplate: 'https://tile.tracestrack.com/topo_sv/{z}/{x}/{y}.webp?key={key}'
    },
    'thunderforest': {
        name: 'ThunderForest Outdoors',
        storageKey: 'thunderforest_key',
        link: 'https://www.thunderforest.com/',
        urlTemplate: 'https://tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey={key}'
    }
};

// Map URLs
const OPENTOPO_URL = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const WORKER_URL = "https://lm.clackspark.workers.dev";
const ROUTING_SERVICE_URL = "https://router.project-osrm.org/route/v1";
const ROUTING_PROFILE = "foot";
const ELEVATION_SERVICE_URL = "https://api.opentopodata.org/v1/srtm90m";
const ELEVATION_BATCH_SIZE = 80;
const EDIT_SIMPLIFY_LEVELS = [
    { minZoom: 0, toleranceMeters: 2200 },
    { minZoom: 10, toleranceMeters: 900 },
    { minZoom: 12, toleranceMeters: 300 },
    { minZoom: 14, toleranceMeters: 120 },
    { minZoom: 16, toleranceMeters: 40 },
    { minZoom: 17, toleranceMeters: 14 }
];

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const controls = document.getElementById('controls');
const searchInput = document.getElementById('searchInput');
const statusDiv = document.getElementById('status');
const layerSelect = document.getElementById('layerSelect');
const editKeyBtn = document.getElementById('edit-key-btn');
const zoomLabel = document.getElementById('zoom-level');

// ==========================================
// 3. LANGUAGE & TRANSLATIONS
// ==========================================
const translations = {
    sv: LANG_SV,
    en: LANG_EN
};

let currentLang = localStorage.getItem('gpxv_lang') || 'en';

// ==========================================
// 4. MAP & VARIABLE INITIALIZATION
// ==========================================

const layers = {
    "opentopo": L.tileLayer(OPENTOPO_URL, { attribution: 'OpenTopoMap', maxZoom: 17 }),
    "tracetrack": L.tileLayer('', { attribution: 'Tracetrack', maxZoom: 19 }),
    "thunderforest": L.tileLayer('', { attribution: 'ThunderForest', maxZoom: 22 }),
    "lm_map": L.tileLayer(`${WORKER_URL}/{z}/{x}/{y}`, {
        attribution: '&copy; <a href="https://www.lantmateriet.se/">Lantmäteriet</a> - CC BY 4.0',
        maxZoom: 19
    }),
    "osm": L.tileLayer(OSM_URL, { attribution: 'OpenStreetMap', maxZoom: 19 }),
    "satellite": L.tileLayer(SATELLITE_URL, { attribution: 'Esri', maxZoom: 19 })
};

let gpxLayer = null;
let gpxTrackData = null;
let isControlsMinimized = false;
let currentLayer = null;
let previousLayerValue = "opentopo";
let pendingServiceKey = null;
let deferredInstallPrompt = null;
let gpsMarker = null;
let gpsWatchId = null;
let isElevationCursorActive = false;
let editorIdCounter = 1;
let editorState = createEmptyEditorState();

// Load saved position
const savedLat = parseFloat(localStorage.getItem('gpxv_lat')) || 67.89;
const savedLng = parseFloat(localStorage.getItem('gpxv_lng')) || 18.52;
const savedZoom = parseInt(localStorage.getItem('gpxv_zoom')) || 11;
let savedLayer = localStorage.getItem('gpxv_layer') || "opentopo";

if (!layers[savedLayer]) {
    savedLayer = "opentopo";
}

// Create the map
const map = L.map('map', {
    zoomControl: false,
    boxZoom: false,
    rotate: true,
    touchRotate: true,
    rotateControl: false,
    bearing: 0
}).setView([savedLat, savedLng], savedZoom);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Reset-north compass control
const ResetNorthControl = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function (map) {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control reset-north-control');
        const btn = L.DomUtil.create('a', 'reset-north-btn', container);
        btn.href = '#';
        btn.title = 'Reset North';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Reset North');
        btn.innerHTML = '<svg class="compass-icon" viewBox="0 0 24 24" width="18" height="18"><polygon points="12,2 15,14 12,12 9,14" fill="#e53935"/><polygon points="12,22 9,14 12,12 15,14" fill="#999"/></svg>';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(btn, 'click', function (e) {
            L.DomEvent.preventDefault(e);
            map.setBearing(0);
        });
        this._btn = btn;
        map.on('rotate', this._onRotate, this);
        return container;
    },
    onRemove: function (map) {
        map.off('rotate', this._onRotate, this);
    },
    _onRotate: function (e) {
        const bearing = e.target.getBearing();
        this._btn.querySelector('.compass-icon').style.transform = 'rotate(' + (-bearing) + 'deg)';
        this._btn.closest('.reset-north-control').style.display = bearing === 0 ? 'none' : 'block';
    }
});
new ResetNorthControl().addTo(map);

// Ctrl+drag rotation handler (desktop)
(function () {
    const mapContainer = map.getContainer();
    let rotating = false;
    let startAngle = 0;
    let startBearing = 0;

    function getAngleFromCenter(e) {
        const rect = mapContainer.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    }

    mapContainer.addEventListener('mousedown', function (e) {
        if (e.ctrlKey && e.button === 0) {
            e.preventDefault();
            rotating = true;
            startAngle = getAngleFromCenter(e);
            startBearing = map.getBearing();
            mapContainer.style.cursor = 'grabbing';
            map.dragging.disable();
        }
    });

    window.addEventListener('mousemove', function (e) {
        if (!rotating) return;
        const delta = getAngleFromCenter(e) - startAngle;
        map.setBearing(startBearing + delta);
    });

    window.addEventListener('mouseup', function (e) {
        if (!rotating) return;
        rotating = false;
        mapContainer.style.cursor = '';
        map.dragging.enable();
    });

    mapContainer.addEventListener('contextmenu', function (e) {
        if (e.ctrlKey) e.preventDefault();
    });
})();

// ==========================================
// 5. FUNCTIONS
// ==========================================

function updateLanguage() {
    const t = translations[currentLang];
    const isEn = currentLang === 'en';

    const flagImg = document.getElementById('flag-icon');
    if (flagImg) flagImg.src = isEn ? FLAG_GB : FLAG_SE;

    if (document.getElementById('app-title')) {
        document.getElementById('app-title').textContent = t.title;
        document.title = t.title;
        document.getElementById('lbl-layers').textContent = t.lbl_layers;

        document.getElementById('searchInput').placeholder = t.input_search_ph;
        document.getElementById('status').textContent = t.status_ready;

        document.getElementById('info-title').textContent = t.info_title;
        document.getElementById('info-desc').innerHTML = t.info_desc;

        const tutBtn = document.getElementById('start-tutorial-btn');
        if (tutBtn) tutBtn.textContent = t.btn_tutorial;

        document.getElementById('info-creator').textContent = t.info_creator;
        document.getElementById('lbl-version').textContent = t.lbl_version;
        document.getElementById('app-version').textContent = APP_VERSION;
        if (document.getElementById('info-changelog-title')) document.getElementById('info-changelog-title').textContent = t.info_changelog_title;
        document.getElementById('info-privacy').textContent = t.info_privacy;

        if (document.getElementById('section-routes-title')) document.getElementById('section-routes-title').textContent = t.section_routes_title;
        if (document.getElementById('gpx-btn')) document.getElementById('gpx-btn').textContent = t.btn_gpx;
        if (document.getElementById('gpx-new-btn')) document.getElementById('gpx-new-btn').textContent = t.btn_gpx_new;
        if (document.getElementById('gpx-clear-btn')) document.getElementById('gpx-clear-btn').textContent = t.btn_gpx_clear;
        if (document.getElementById('gpx-export-btn')) document.getElementById('gpx-export-btn').textContent = t.btn_gpx_export;
        if (document.getElementById('lbl-track-color')) document.getElementById('lbl-track-color').textContent = t.lbl_track_color;
        if (document.getElementById('lbl-track-width')) document.getElementById('lbl-track-width').textContent = t.lbl_track_width;
        if (document.getElementById('lbl-km-labels')) document.getElementById('lbl-km-labels').textContent = t.lbl_km_labels;
        if (document.getElementById('lbl-color-slope')) document.getElementById('lbl-color-slope').textContent = t.lbl_color_slope;
        if (document.getElementById('lbl-show-waypoints')) document.getElementById('lbl-show-waypoints').textContent = t.lbl_show_waypoints;
        if (document.getElementById('lbl-show-minmax')) document.getElementById('lbl-show-minmax').textContent = t.lbl_show_minmax;
        if (document.getElementById('lbl-route-name')) document.getElementById('lbl-route-name').textContent = t.lbl_route_name;
        if (document.getElementById('lbl-route-activity')) document.getElementById('lbl-route-activity').textContent = t.lbl_route_activity;
        if (document.getElementById('lbl-route-segment')) document.getElementById('lbl-route-segment').textContent = t.lbl_route_segment;
        if (document.getElementById('lbl-routing-enabled')) document.getElementById('lbl-routing-enabled').textContent = t.lbl_routing_enabled;
        if (document.getElementById('gpx-add-waypoint-btn')) document.getElementById('gpx-add-waypoint-btn').textContent = t.btn_add_waypoint;
        if (document.getElementById('opt-unit-km')) document.getElementById('opt-unit-km').textContent = t.unit_km;
        if (document.getElementById('opt-unit-mi')) document.getElementById('opt-unit-mi').textContent = t.unit_mi;
        updateGpxTrackInfo();

        document.getElementById('info-close').textContent = t.btn_close;

        document.getElementById('modal-save').textContent = t.btn_save;
        document.getElementById('modal-cancel').textContent = t.btn_cancel;
        document.getElementById('api-key-input').placeholder = t.input_api_ph;

        if (layerSelect) {
            for (let i = 0; i < layerSelect.options.length; i++) {
                const val = layerSelect.options[i].value;
                if (val === 'lm_map') layerSelect.options[i].text = t.layer_lm_map;
                else if (val === 'satellite') layerSelect.options[i].text = t.layer_satellite + " (ESRI)";
            }
        }

        // Update notification text if visible
        const updateSnackbar = document.getElementById('update-notification');
        if (updateSnackbar) {
            document.getElementById('update-msg').textContent = t.update_available;
            document.getElementById('update-btn').textContent = t.update_btn;
        }

        // Install button and mobile install bar
        const installBtn = document.getElementById('install-app-btn');
        if (installBtn) installBtn.textContent = t.btn_install_app;
        const installMsg = document.getElementById('mobile-install-msg');
        if (installMsg) installMsg.textContent = t.mobile_install_msg;
        const mobileInstallBtn = document.getElementById('mobile-install-btn');
        if (mobileInstallBtn) mobileInstallBtn.textContent = t.btn_install;

        // Elevation profile
        const epTitle = document.getElementById('elevation-profile-title');
        if (epTitle) epTitle.textContent = t.elevation_profile;
        const lblElevProfile = document.getElementById('lbl-show-elev-profile');
        if (lblElevProfile) lblElevProfile.textContent = t.lbl_show_elev_profile;
        const lblElevMapSync = document.getElementById('lbl-elev-map-sync');
        if (lblElevMapSync) lblElevMapSync.textContent = t.lbl_elev_map_sync;
        const lblCrosshair = document.getElementById('lbl-show-crosshair');
        if (lblCrosshair) lblCrosshair.textContent = t.lbl_show_crosshair;

        const waypointModalTitle = document.getElementById('waypoint-modal-title');
        if (waypointModalTitle) waypointModalTitle.textContent = t.modal_waypoint_title;
        const waypointNameInput = document.getElementById('waypoint-name-input');
        if (waypointNameInput) waypointNameInput.placeholder = t.input_waypoint_name_ph;
        const waypointSaveBtn = document.getElementById('waypoint-save-btn');
        if (waypointSaveBtn) waypointSaveBtn.textContent = t.btn_save;
        const waypointDeleteBtn = document.getElementById('waypoint-delete-btn');
        if (waypointDeleteBtn) waypointDeleteBtn.textContent = t.btn_delete;
        const waypointCancelBtn = document.getElementById('waypoint-cancel-btn');
        if (waypointCancelBtn) waypointCancelBtn.textContent = t.btn_cancel;

        syncEditorUI();
    }
}

function syncCrosshairVisibility() {
    const crosshairEl = document.getElementById('crosshair');
    const checkbox = document.getElementById('showCrosshair');
    if (!crosshairEl || !checkbox) return;
    crosshairEl.classList.toggle('hidden', !checkbox.checked || isElevationCursorActive);
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'sv' : 'en';
    localStorage.setItem('gpxv_lang', currentLang);
    updateLanguage();
}

function handleLayerChange(layerKey) {
    const service = lockedServices[layerKey];
    if (service) {
        const savedKey = localStorage.getItem(service.storageKey);
        if (savedKey) {
            loadLockedLayer(layerKey, savedKey);
        } else {
            showKeyModal(layerKey);
            return;
        }
    } else {
        switchLayerTo(layerKey);
    }
    previousLayerValue = layerKey;
    localStorage.setItem('gpxv_layer', layerKey);
    if (editKeyBtn) editKeyBtn.style.display = lockedServices[layerKey] ? 'block' : 'none';
}

function switchLayerTo(layerKey) {
    if (currentLayer) map.removeLayer(currentLayer);
    currentLayer = layers[layerKey];
    if (currentLayer) currentLayer.addTo(map);
}

function loadLockedLayer(layerKey, key) {
    const service = lockedServices[layerKey];
    if (!service) return;
    const url = service.urlTemplate.replace('{key}', key);
    layers[layerKey].setUrl(url);
    switchLayerTo(layerKey);
}

function showKeyModal(layerKey) {
    const t = translations[currentLang];
    const service = lockedServices[layerKey];
    if (!service) return;
    pendingServiceKey = layerKey;
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalLink = document.getElementById('modal-link');
    const keyInput = document.getElementById('api-key-input');
    modalTitle.textContent = t.modal_api_title.replace('{service}', service.name);
    modalText.textContent = t.modal_api_text.replace('{service}', service.name);
    modalLink.href = service.link;
    modalLink.textContent = service.link;
    keyInput.value = localStorage.getItem(service.storageKey) || '';
    document.getElementById('key-modal').style.display = 'flex';
}

function openCurrentKeyModal() {
    const currentVal = layerSelect ? layerSelect.value : null;
    if (currentVal && lockedServices[currentVal]) {
        showKeyModal(currentVal);
    }
}

function saveApiKey() {
    const t = translations[currentLang];
    const keyInput = document.getElementById('api-key-input');
    const key = keyInput.value.trim();
    if (!key) { alert(t.msg_api_alert); return; }
    if (pendingServiceKey) {
        const service = lockedServices[pendingServiceKey];
        if (service) {
            localStorage.setItem(service.storageKey, key);
            loadLockedLayer(pendingServiceKey, key);
            if (layerSelect) layerSelect.value = pendingServiceKey;
            localStorage.setItem('gpxv_layer', pendingServiceKey);
            if (editKeyBtn) editKeyBtn.style.display = 'block';
            previousLayerValue = pendingServiceKey;
        }
    }
    document.getElementById('key-modal').style.display = 'none';
    pendingServiceKey = null;
}

function cancelApiKey() {
    document.getElementById('key-modal').style.display = 'none';
    if (pendingServiceKey) {
        if (layerSelect) layerSelect.value = previousLayerValue;
        pendingServiceKey = null;
    }
}

function showInfo() { document.getElementById('info-modal').style.display = 'flex'; }
function closeInfo() { document.getElementById('info-modal').style.display = 'none'; }

function toggleControls() {
    const btn = document.querySelector('.toggle-btn');
    isControlsMinimized = !isControlsMinimized;
    if (isControlsMinimized) {
        controls.classList.add('minimized');
        btn.textContent = '➕';
    } else {
        controls.classList.remove('minimized');
        btn.textContent = '➖';
    }
}

async function searchLocation() {
    const t = translations[currentLang];
    const query = searchInput.value.trim();
    if (!query) return;
    statusDiv.textContent = t.status_searching;
    const coordMatch = query.match(/^([-+]?\d{1,2}[.]?\d*)[,\s]+([-+]?\d{1,3}[.]?\d*)$/);
    if (coordMatch) {
        map.setView([parseFloat(coordMatch[1]), parseFloat(coordMatch[2])], 12);
        statusDiv.textContent = t.status_done; return;
    }
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 12);
            statusDiv.textContent = `${data[0].display_name.split(',')[0]}`;
        } else { statusDiv.textContent = t.status_no_match; }
    } catch (error) { console.error(error); }
}

function locateUser() {
    const t = translations[currentLang];
    if (!navigator.geolocation) { statusDiv.textContent = t.status_gps_missing; return; }
    statusDiv.textContent = t.status_gps_fetch;

    function updateGpsMarker(pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (gpsMarker) {
            gpsMarker.setLatLng([lat, lng]);
        } else {
            gpsMarker = L.circleMarker([lat, lng], {
                radius: 5,
                color: '#ffffff',
                fillColor: '#007bff',
                fillOpacity: 1,
                weight: 2,
                interactive: false
            }).addTo(map);
        }
    }

    // Initial position — center the map
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            map.setView([pos.coords.latitude, pos.coords.longitude], 13);
            updateGpsMarker(pos);
            statusDiv.textContent = t.status_done;
        },
        () => statusDiv.textContent = t.status_gps_error,
        { enableHighAccuracy: true }
    );

    // Continuous updates — only move the marker, don't pan
    if (gpsWatchId !== null) {
        navigator.geolocation.clearWatch(gpsWatchId);
    }
    gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => updateGpsMarker(pos),
        () => {},
        { enableHighAccuracy: true }
    );
}

function createEmptyEditorDocument() {
    return {
        name: '',
        activity: '',
        segments: [],
        waypoints: []
    };
}

function createEmptyEditorState() {
    return {
        isEditing: false,
        routingEnabled: localStorage.getItem('gpxv_routing') !== 'false',
        routeProfile: ROUTING_PROFILE,
        activeSegmentIndex: 0,
        addWaypointArmed: false,
        doc: createEmptyEditorDocument(),
        pending: {
            controller: null,
            token: 0
        },
        insertionHandle: null,
        insertionHideTimer: null,
        waypointModalIndex: null
    };
}

function generateEditorId(prefix) {
    return `${prefix}-${editorIdCounter++}`;
}

function createEmptySegment() {
    return {
        id: generateEditorId('segment'),
        anchors: [],
        links: [],
        geometry: []
    };
}

function copyPoint(point) {
    return {
        lat: point.lat,
        lon: point.lon,
        ele: point.ele ?? null
    };
}

function pointFromAnchor(anchor) {
    return {
        lat: anchor.lat,
        lon: anchor.lon,
        ele: anchor.ele ?? null
    };
}

function createAnchor(point, options = {}) {
    return {
        id: generateEditorId('anchor'),
        lat: point.lat,
        lon: point.lon,
        ele: point.ele ?? null,
        minZoom: options.minZoom ?? 0,
        userAdded: Boolean(options.userAdded),
        sourceIndex: Number.isInteger(options.sourceIndex) ? options.sourceIndex : null
    };
}

function createWaypoint(point) {
    return {
        id: generateEditorId('waypoint'),
        lat: point.lat,
        lon: point.lon,
        ele: point.ele ?? null,
        name: point.name || ''
    };
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeXml(value) {
    return escapeHtml(value);
}

function sanitizeFileName(name) {
    const sanitized = String(name || 'route').replace(/[<>:"/\\|?*]+/g, '-').trim();
    return sanitized || 'route';
}

function hasEditorDocument() {
    return Boolean(
        editorState.doc.segments.length ||
        editorState.doc.waypoints.length ||
        editorState.doc.name.trim() ||
        editorState.doc.activity.trim()
    );
}

function cancelPendingGeometryOperation() {
    if (editorState.pending.controller) {
        editorState.pending.controller.abort();
    }
    editorState.pending.controller = null;
    editorState.pending.token = 0;
}

function getActiveSegment() {
    if (!editorState.doc.segments.length) return null;
    if (editorState.activeSegmentIndex < 0 || editorState.activeSegmentIndex >= editorState.doc.segments.length) {
        editorState.activeSegmentIndex = 0;
    }
    return editorState.doc.segments[editorState.activeSegmentIndex] || null;
}

function projectPointToMeters(point, referenceLat) {
    const scaleX = Math.cos(referenceLat * Math.PI / 180) * 111320;
    return {
        x: point.lon * scaleX,
        y: point.lat * 110540
    };
}

function pointToSegmentDistanceMeters(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) {
        const px = point.x - start.x;
        const py = point.y - start.y;
        return Math.sqrt(px * px + py * py);
    }
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const diffX = point.x - projX;
    const diffY = point.y - projY;
    return Math.sqrt(diffX * diffX + diffY * diffY);
}

function simplifyGeometryIndices(points, toleranceMeters) {
    if (points.length <= 2) {
        return points.map((_, index) => index);
    }

    const referenceLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const projected = points.map((point) => projectPointToMeters(point, referenceLat));
    const keep = new Set([0, points.length - 1]);

    function recurse(startIndex, endIndex) {
        let maxDistance = 0;
        let maxIndex = -1;

        for (let index = startIndex + 1; index < endIndex; index++) {
            const distance = pointToSegmentDistanceMeters(projected[index], projected[startIndex], projected[endIndex]);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = index;
            }
        }

        if (maxIndex !== -1 && maxDistance > toleranceMeters) {
            keep.add(maxIndex);
            recurse(startIndex, maxIndex);
            recurse(maxIndex, endIndex);
        }
    }

    recurse(0, points.length - 1);
    return Array.from(keep).sort((left, right) => left - right);
}

function buildAnchorsFromGeometry(points) {
    if (!points.length) return [];
    if (points.length === 1) {
        return [createAnchor(points[0], { minZoom: 0, sourceIndex: 0 })];
    }

    const indexToMinZoom = new Map();
    indexToMinZoom.set(0, 0);
    indexToMinZoom.set(points.length - 1, 0);

    EDIT_SIMPLIFY_LEVELS.forEach((level) => {
        const indices = simplifyGeometryIndices(points, level.toleranceMeters);
        indices.forEach((index) => {
            const previous = indexToMinZoom.get(index);
            if (previous === undefined || level.minZoom < previous) {
                indexToMinZoom.set(index, level.minZoom);
            }
        });
    });

    return Array.from(indexToMinZoom.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([index, minZoom]) => createAnchor(points[index], {
            minZoom,
            sourceIndex: index
        }));
}

function ensureLinkEndpoints(points, startAnchor, endAnchor) {
    const nextPoints = (points && points.length ? points : [pointFromAnchor(startAnchor), pointFromAnchor(endAnchor)]).map(copyPoint);
    if (!nextPoints.length) {
        nextPoints.push(pointFromAnchor(startAnchor), pointFromAnchor(endAnchor));
    }
    nextPoints[0] = pointFromAnchor(startAnchor);
    if (nextPoints.length === 1) {
        nextPoints.push(pointFromAnchor(endAnchor));
    } else {
        nextPoints[nextPoints.length - 1] = pointFromAnchor(endAnchor);
    }
    return nextPoints;
}

function buildImportedLinksFromGeometry(points, anchors) {
    if (anchors.length < 2) return [];
    const links = [];
    for (let index = 0; index < anchors.length - 1; index++) {
        const startAnchor = anchors[index];
        const endAnchor = anchors[index + 1];
        const startIndex = Number.isInteger(startAnchor.sourceIndex) ? startAnchor.sourceIndex : 0;
        const endIndex = Number.isInteger(endAnchor.sourceIndex) ? endAnchor.sourceIndex : startIndex + 1;
        const slice = points.slice(startIndex, endIndex + 1).map(copyPoint);
        links.push({
            id: generateEditorId('link'),
            mode: 'imported',
            points: ensureLinkEndpoints(slice, startAnchor, endAnchor)
        });
    }
    return links;
}

function rebuildSegmentGeometry(segment) {
    if (!segment) return [];
    if (!segment.links.length) {
        segment.geometry = segment.anchors.length ? [pointFromAnchor(segment.anchors[0])] : [];
        return segment.geometry;
    }

    const geometry = [];
    segment.links.forEach((link, index) => {
        const startAnchor = segment.anchors[index];
        const endAnchor = segment.anchors[index + 1];
        const points = ensureLinkEndpoints(link.points, startAnchor, endAnchor);
        if (!geometry.length) {
            geometry.push(...points);
        } else {
            geometry.push(...points.slice(1));
        }
    });
    segment.geometry = geometry;
    return geometry;
}

function refreshSegmentAnchorElevations(segment) {
    if (!segment) return;
    segment.anchors.forEach((anchor, index) => {
        const values = [];
        if (index > 0) {
            const previousLink = segment.links[index - 1];
            const previousPoint = previousLink && previousLink.points[previousLink.points.length - 1];
            if (previousPoint && previousPoint.ele !== null) values.push(previousPoint.ele);
        }
        if (index < segment.links.length) {
            const nextLink = segment.links[index];
            const nextPoint = nextLink && nextLink.points[0];
            if (nextPoint && nextPoint.ele !== null) values.push(nextPoint.ele);
        }
        if (values.length) {
            anchor.ele = values.reduce((sum, value) => sum + value, 0) / values.length;
        }
    });
}

function createEditableSegment(points) {
    const normalizedPoints = points.map(copyPoint);
    const anchors = buildAnchorsFromGeometry(normalizedPoints);
    const segment = createEmptySegment();
    segment.anchors = anchors;
    segment.links = buildImportedLinksFromGeometry(normalizedPoints, anchors);
    segment.geometry = normalizedPoints.length ? normalizedPoints : rebuildSegmentGeometry(segment);
    return segment;
}

function createEditorDocumentFromParsedData(parsedData) {
    const doc = createEmptyEditorDocument();
    doc.name = parsedData.name || '';
    doc.activity = parsedData.activity || '';
    doc.segments = parsedData.segments.map((segment) => createEditableSegment(segment));
    doc.waypoints = parsedData.waypoints.map((waypoint) => createWaypoint(waypoint));
    return doc;
}

window.clearGpxRoute = function () {
    cancelPendingGeometryOperation();
    if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
    gpxTrackData = null;
    editorState = createEmptyEditorState();
    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    const infoDiv = document.getElementById('gpx-track-info');
    if (infoDiv) { infoDiv.style.display = 'none'; infoDiv.innerHTML = ''; }
    closeWaypointModal();
    hideElevationProfile();
    syncEditorUI();
    statusDiv.textContent = translations[currentLang].status_gpx_cleared;
};

function getGpxTrackColor() {
    const el = document.getElementById('gpxTrackColor');
    return el ? el.value : '#000000';
}

function getGpxTrackWidth() {
    const el = document.getElementById('gpxTrackWidth');
    return el ? parseInt(el.value) : 4;
}

function getGpxShowKmLabels() {
    const el = document.getElementById('gpxShowKmLabels');
    return el ? el.checked : false;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeTrackStats(allSegments) {
    let totalLength = 0, gain = 0, loss = 0;
    let minElev = Infinity, maxElev = -Infinity;
    let hasElevation = false;

    for (const seg of allSegments) {
        for (let i = 0; i < seg.length; i++) {
            const p = seg[i];
            if (p.ele !== null) {
                hasElevation = true;
                if (p.ele < minElev) minElev = p.ele;
                if (p.ele > maxElev) maxElev = p.ele;
            }
            if (i > 0) {
                totalLength += haversineDistance(seg[i - 1].lat, seg[i - 1].lon, p.lat, p.lon);
                if (seg[i - 1].ele !== null && p.ele !== null) {
                    const diff = p.ele - seg[i - 1].ele;
                    if (diff > 0) gain += diff;
                    else loss += Math.abs(diff);
                }
            }
        }
    }
    return {
        length: totalLength,
        gain, loss,
        minElev: hasElevation ? minElev : null,
        maxElev: hasElevation ? maxElev : null
    };
}

function countEditorPoints(doc) {
    let count = 0;
    doc.segments.forEach((segment) => {
        count += segment.geometry.length;
    });
    count += doc.waypoints.length;
    return count;
}

function syncTrackDataFromEditor(options = {}) {
    const denseSegments = editorState.doc.segments
        .map((segment) => rebuildSegmentGeometry(segment).map(copyPoint))
        .filter((segment) => segment.length > 0);

    if (!denseSegments.length && !editorState.doc.waypoints.length) {
        gpxTrackData = null;
        hideElevationProfile();
    } else {
        const stats = computeTrackStats(denseSegments);
        gpxTrackData = {
            name: editorState.doc.name,
            activity: editorState.doc.activity,
            segments: denseSegments,
            waypoints: editorState.doc.waypoints.map((waypoint) => ({
                lat: waypoint.lat,
                lon: waypoint.lon,
                ele: waypoint.ele ?? null,
                name: waypoint.name || ''
            })),
            ...stats
        };

        if (getGpxShowElevProfile() && denseSegments.some((segment) => segment.length > 1)) {
            showElevationProfile();
        } else {
            hideElevationProfile();
        }
    }

    updateGpxTrackInfo();
    syncEditorUI();
    if (options.redraw !== false) {
        rebuildGpxLayer();
    }
}

function getVisibleAnchorIndices(segment) {
    if (!segment || !editorState.isEditing) return [];
    const zoom = map.getZoom();
    const indices = [];
    segment.anchors.forEach((anchor, index) => {
        const isEndpoint = index === 0 || index === segment.anchors.length - 1;
        if (anchor.userAdded || isEndpoint || zoom >= anchor.minZoom) {
            indices.push(index);
        }
    });
    if (!indices.length && segment.anchors.length) {
        indices.push(0);
    }
    return indices;
}

function getMidpointAlongGeometry(points) {
    if (!points || !points.length) return null;
    if (points.length === 1) {
        return L.latLng(points[0].lat, points[0].lon);
    }

    let totalDistance = 0;
    for (let index = 1; index < points.length; index++) {
        totalDistance += haversineDistance(points[index - 1].lat, points[index - 1].lon, points[index].lat, points[index].lon);
    }
    const targetDistance = totalDistance / 2;

    let accumulated = 0;
    for (let index = 1; index < points.length; index++) {
        const start = points[index - 1];
        const end = points[index];
        const stepDistance = haversineDistance(start.lat, start.lon, end.lat, end.lon);
        if (accumulated + stepDistance >= targetDistance) {
            const fraction = stepDistance === 0 ? 0 : (targetDistance - accumulated) / stepDistance;
            return L.latLng(
                start.lat + (end.lat - start.lat) * fraction,
                start.lon + (end.lon - start.lon) * fraction
            );
        }
        accumulated += stepDistance;
    }

    const lastPoint = points[points.length - 1];
    return L.latLng(lastPoint.lat, lastPoint.lon);
}

function beginGeometryOperation(statusText) {
    cancelPendingGeometryOperation();
    const controller = new AbortController();
    const token = generateEditorId('op');
    editorState.pending.controller = controller;
    editorState.pending.token = token;
    if (statusText) {
        statusDiv.textContent = statusText;
    }
    return { signal: controller.signal, token };
}

function finishGeometryOperation(token, statusText) {
    if (editorState.pending.token !== token) return;
    editorState.pending.controller = null;
    editorState.pending.token = 0;
    if (statusText) {
        statusDiv.textContent = statusText;
    }
}

function clearInsertionHideTimer() {
    if (editorState.insertionHideTimer) {
        window.clearTimeout(editorState.insertionHideTimer);
        editorState.insertionHideTimer = null;
    }
}

function hideInsertionHandle(options = {}) {
    clearInsertionHideTimer();
    if (!editorState.insertionHandle) return;
    editorState.insertionHandle = null;
    if (options.redraw !== false) {
        rebuildGpxLayer();
    }
}

function scheduleHideInsertionHandle() {
    clearInsertionHideTimer();
    editorState.insertionHideTimer = window.setTimeout(() => {
        hideInsertionHandle();
    }, 120);
}

function showInsertionHandle(segmentIndex, linkIndex) {
    if (!editorState.isEditing || editorState.addWaypointArmed) return;
    const segment = editorState.doc.segments[segmentIndex];
    if (!segment || linkIndex < 0 || linkIndex >= segment.links.length) return;
    const latlng = getMidpointAlongGeometry(segment.links[linkIndex].points);
    if (!latlng) return;
    clearInsertionHideTimer();

    if (
        editorState.insertionHandle &&
        editorState.insertionHandle.segmentIndex === segmentIndex &&
        editorState.insertionHandle.linkIndex === linkIndex
    ) {
        return;
    }

    editorState.insertionHandle = {
        segmentIndex,
        linkIndex,
        latlng
    };
    rebuildGpxLayer();
}

function buildStraightLinePoints(startAnchor, endAnchor) {
    const distance = haversineDistance(startAnchor.lat, startAnchor.lon, endAnchor.lat, endAnchor.lon);
    const steps = Math.max(1, Math.min(24, Math.round(distance / 120)));
    const points = [];
    for (let index = 0; index <= steps; index++) {
        const fraction = steps === 0 ? 0 : index / steps;
        points.push({
            lat: startAnchor.lat + (endAnchor.lat - startAnchor.lat) * fraction,
            lon: startAnchor.lon + (endAnchor.lon - startAnchor.lon) * fraction,
            ele: null
        });
    }
    return points;
}

function dedupeConsecutivePoints(points) {
    const deduped = [];
    points.forEach((point) => {
        const previous = deduped[deduped.length - 1];
        if (!previous || previous.lat !== point.lat || previous.lon !== point.lon) {
            deduped.push(point);
        }
    });
    return deduped;
}

async function fetchRouteGeometryPoints(startAnchor, endAnchor, signal) {
    const straightLine = buildStraightLinePoints(startAnchor, endAnchor);
    try {
        const url = `${ROUTING_SERVICE_URL}/${editorState.routeProfile}/${startAnchor.lon},${startAnchor.lat};${endAnchor.lon},${endAnchor.lat}?overview=full&geometries=geojson&steps=false`;
        const response = await fetch(url, { signal });
        if (!response.ok) {
            throw new Error(`Routing request failed: ${response.status}`);
        }
        const data = await response.json();
        const coordinates = data.routes && data.routes[0] && data.routes[0].geometry && data.routes[0].geometry.coordinates;
        if (!coordinates || coordinates.length < 2) {
            throw new Error('No route geometry returned');
        }
        return {
            points: dedupeConsecutivePoints(coordinates.map(([lon, lat]) => ({ lat, lon, ele: null }))),
            fallbackUsed: false
        };
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        console.error(error);
        return {
            points: straightLine,
            fallbackUsed: true
        };
    }
}

async function fetchElevationForPoints(points, signal) {
    const elevatedPoints = points.map(copyPoint);
    let failed = false;

    for (let offset = 0; offset < elevatedPoints.length; offset += ELEVATION_BATCH_SIZE) {
        const batch = elevatedPoints.slice(offset, offset + ELEVATION_BATCH_SIZE);
        const locations = batch.map((point) => `${point.lat},${point.lon}`).join('|');
        try {
            const response = await fetch(`${ELEVATION_SERVICE_URL}?locations=${encodeURIComponent(locations)}`, { signal });
            if (!response.ok) {
                throw new Error(`Elevation request failed: ${response.status}`);
            }
            const data = await response.json();
            const results = data.results || [];
            batch.forEach((point, index) => {
                const result = results[index];
                point.ele = result && typeof result.elevation === 'number' ? result.elevation : null;
            });
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.error(error);
            failed = true;
            batch.forEach((point) => {
                point.ele = point.ele ?? null;
            });
        }
    }

    return {
        points: elevatedPoints,
        failed
    };
}

async function buildLinkPoints(startAnchor, endAnchor, signal) {
    const routeResult = editorState.routingEnabled
        ? await fetchRouteGeometryPoints(startAnchor, endAnchor, signal)
        : { points: buildStraightLinePoints(startAnchor, endAnchor), fallbackUsed: false };
    const pointsWithEndpoints = ensureLinkEndpoints(routeResult.points, startAnchor, endAnchor);
    const elevationResult = await fetchElevationForPoints(pointsWithEndpoints, signal);
    return {
        points: ensureLinkEndpoints(elevationResult.points, startAnchor, endAnchor),
        fallbackUsed: routeResult.fallbackUsed,
        elevationFailed: elevationResult.failed
    };
}

async function recalcSegmentLinks(segment, linkIndices, statusText) {
    if (!segment) return;
    const t = translations[currentLang];
    const uniqueIndices = Array.from(new Set(linkIndices.filter((index) => index >= 0 && index < segment.links.length)));
    if (!uniqueIndices.length) {
        rebuildSegmentGeometry(segment);
        refreshSegmentAnchorElevations(segment);
        syncTrackDataFromEditor();
        return;
    }

    const operation = beginGeometryOperation(statusText || t.status_route_rebuilding);
    let fallbackUsed = false;
    let elevationFailed = false;

    try {
        for (const linkIndex of uniqueIndices) {
            const startAnchor = segment.anchors[linkIndex];
            const endAnchor = segment.anchors[linkIndex + 1];
            if (!startAnchor || !endAnchor) continue;
            const result = await buildLinkPoints(startAnchor, endAnchor, operation.signal);
            segment.links[linkIndex] = {
                id: segment.links[linkIndex] && segment.links[linkIndex].id ? segment.links[linkIndex].id : generateEditorId('link'),
                mode: editorState.routingEnabled ? 'routed' : 'straight',
                points: result.points
            };
            fallbackUsed = fallbackUsed || result.fallbackUsed;
            elevationFailed = elevationFailed || result.elevationFailed;
        }

        rebuildSegmentGeometry(segment);
        refreshSegmentAnchorElevations(segment);
        syncTrackDataFromEditor();

        if (fallbackUsed) {
            finishGeometryOperation(operation.token, t.status_route_fallback);
        } else if (elevationFailed) {
            finishGeometryOperation(operation.token, t.status_elevation_warning);
        } else {
            finishGeometryOperation(operation.token, t.status_route_updated);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return;
        }
        console.error(error);
        finishGeometryOperation(operation.token, t.status_route_error);
        syncTrackDataFromEditor();
    }
}

async function rebuildActiveSegmentAllLinks() {
    const segment = getActiveSegment();
    if (!segment || segment.links.length === 0) return;
    await recalcSegmentLinks(segment, segment.links.map((_, index) => index));
}

async function updateAnchorPosition(segmentIndex, anchorIndex, latlng) {
    const segment = editorState.doc.segments[segmentIndex];
    if (!segment || !segment.anchors[anchorIndex]) return;
    const anchor = segment.anchors[anchorIndex];
    anchor.lat = latlng.lat;
    anchor.lon = latlng.lng;
    anchor.ele = null;
    anchor.sourceIndex = null;

    if (!segment.links.length) {
        rebuildSegmentGeometry(segment);
        syncTrackDataFromEditor();
        return;
    }

    const linksToUpdate = [];
    if (anchorIndex > 0) linksToUpdate.push(anchorIndex - 1);
    if (anchorIndex < segment.anchors.length - 1) linksToUpdate.push(anchorIndex);
    await recalcSegmentLinks(segment, linksToUpdate);
}

async function appendAnchorToActiveSegment(latlng) {
    const t = translations[currentLang];
    let segment = getActiveSegment();
    if (!segment) {
        segment = createEmptySegment();
        editorState.doc.segments.push(segment);
        editorState.activeSegmentIndex = editorState.doc.segments.length - 1;
    }

    const newAnchor = createAnchor({ lat: latlng.lat, lon: latlng.lng, ele: null }, {
        minZoom: 0,
        userAdded: true
    });
    segment.anchors.push(newAnchor);

    if (segment.anchors.length === 1) {
        rebuildSegmentGeometry(segment);
        syncTrackDataFromEditor();
        statusDiv.textContent = t.status_anchor_added;
        return;
    }

    const previousAnchor = segment.anchors[segment.anchors.length - 2];
    segment.links.push({
        id: generateEditorId('link'),
        mode: 'pending',
        points: [pointFromAnchor(previousAnchor), pointFromAnchor(newAnchor)]
    });

    syncTrackDataFromEditor();
    await recalcSegmentLinks(segment, [segment.links.length - 1]);
}

async function insertAnchorAtLink(segmentIndex, linkIndex, latlng) {
    const segment = editorState.doc.segments[segmentIndex];
    if (!segment || linkIndex < 0 || linkIndex >= segment.links.length) return;

    const newAnchor = createAnchor({ lat: latlng.lat, lon: latlng.lng, ele: null }, {
        minZoom: 0,
        userAdded: true
    });

    segment.anchors.splice(linkIndex + 1, 0, newAnchor);
    segment.links.splice(
        linkIndex,
        1,
        {
            id: generateEditorId('link'),
            mode: 'pending',
            points: [pointFromAnchor(segment.anchors[linkIndex]), pointFromAnchor(newAnchor)]
        },
        {
            id: generateEditorId('link'),
            mode: 'pending',
            points: [pointFromAnchor(newAnchor), pointFromAnchor(segment.anchors[linkIndex + 2])]
        }
    );

    hideInsertionHandle({ redraw: false });
    syncTrackDataFromEditor();
    await recalcSegmentLinks(segment, [linkIndex, linkIndex + 1]);
}

function updateEditorMetadataFromInputs() {
    const nameInput = document.getElementById('gpxNameInput');
    const activityInput = document.getElementById('gpxActivityInput');
    if (!nameInput || !activityInput) return;
    editorState.doc.name = nameInput.value.trim();
    editorState.doc.activity = activityInput.value.trim();
    if (gpxTrackData) {
        gpxTrackData.name = editorState.doc.name;
        gpxTrackData.activity = editorState.doc.activity;
    }
    updateGpxTrackInfo();
    syncEditorUI();
}

function setActiveSegmentIndex(index) {
    const normalizedIndex = Math.max(0, Math.min(editorState.doc.segments.length - 1, Number(index) || 0));
    editorState.activeSegmentIndex = normalizedIndex;
    hideInsertionHandle({ redraw: false });
    syncEditorUI();
    rebuildGpxLayer();
}

function startEditMode(createIfMissing = false) {
    const t = translations[currentLang];
    if (!hasEditorDocument() && createIfMissing) {
        editorState.doc.segments = [createEmptySegment()];
    }
    if (!hasEditorDocument() && !editorState.doc.segments.length) {
        editorState.doc.segments = [createEmptySegment()];
    }
    editorState.isEditing = true;
    editorState.addWaypointArmed = false;
    syncEditorUI();
    rebuildGpxLayer();
    statusDiv.textContent = t.status_edit_mode_on;
}

function stopEditMode() {
    const t = translations[currentLang];
    editorState.isEditing = false;
    editorState.addWaypointArmed = false;
    hideInsertionHandle({ redraw: false });
    closeWaypointModal();
    syncEditorUI();
    rebuildGpxLayer();
    statusDiv.textContent = t.status_edit_mode_off;
}

function toggleEditMode() {
    if (editorState.isEditing) {
        stopEditMode();
    } else {
        startEditMode(false);
    }
}

function createNewRoute() {
    const t = translations[currentLang];
    if (hasEditorDocument() && !window.confirm(t.confirm_new_route)) {
        return;
    }
    cancelPendingGeometryOperation();
    editorState = createEmptyEditorState();
    editorState.isEditing = true;
    editorState.doc.segments = [createEmptySegment()];
    syncTrackDataFromEditor();
    statusDiv.textContent = t.status_edit_new_route;
}

async function handleRoutingToggle(checked) {
    editorState.routingEnabled = checked;
    localStorage.setItem('gpxv_routing', checked ? 'true' : 'false');
    syncEditorUI();
    const segment = getActiveSegment();
    if (editorState.isEditing && segment && segment.links.length) {
        await rebuildActiveSegmentAllLinks();
    } else {
        rebuildGpxLayer();
    }
}

function toggleWaypointPlacement() {
    if (!editorState.isEditing) return;
    const t = translations[currentLang];
    editorState.addWaypointArmed = !editorState.addWaypointArmed;
    if (editorState.addWaypointArmed) {
        hideInsertionHandle({ redraw: false });
        closeWaypointModal();
        statusDiv.textContent = t.status_waypoint_arm;
    } else {
        statusDiv.textContent = t.status_edit_mode_on;
    }
    syncEditorUI();
    rebuildGpxLayer();
}

function openWaypointModal(index) {
    const waypoint = editorState.doc.waypoints[index];
    const modal = document.getElementById('waypoint-modal');
    const input = document.getElementById('waypoint-name-input');
    if (!waypoint || !modal || !input) return;
    editorState.waypointModalIndex = index;
    input.value = waypoint.name || '';
    modal.style.display = 'flex';
    input.focus();
    input.select();
}

function closeWaypointModal() {
    const modal = document.getElementById('waypoint-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    editorState.waypointModalIndex = null;
}

function saveWaypointModal() {
    const t = translations[currentLang];
    const input = document.getElementById('waypoint-name-input');
    const index = editorState.waypointModalIndex;
    if (!input || index === null || !editorState.doc.waypoints[index]) return;
    editorState.doc.waypoints[index].name = input.value.trim();
    closeWaypointModal();
    syncTrackDataFromEditor();
    statusDiv.textContent = t.status_waypoint_saved;
}

function deleteWaypointFromModal() {
    const t = translations[currentLang];
    const index = editorState.waypointModalIndex;
    if (index === null || !editorState.doc.waypoints[index]) return;
    editorState.doc.waypoints.splice(index, 1);
    closeWaypointModal();
    syncTrackDataFromEditor();
    statusDiv.textContent = t.status_waypoint_deleted;
}

function addWaypointAtLatLng(latlng) {
    const t = translations[currentLang];
    const waypoint = createWaypoint({ lat: latlng.lat, lon: latlng.lng, ele: null, name: '' });
    editorState.doc.waypoints.push(waypoint);
    editorState.addWaypointArmed = false;
    syncTrackDataFromEditor();
    openWaypointModal(editorState.doc.waypoints.length - 1);
    statusDiv.textContent = t.status_waypoint_created;
}

function syncEditorUI() {
    const t = translations[currentLang];
    const hasDoc = hasEditorDocument() || editorState.isEditing;
    const exportable = Boolean(gpxTrackData && (gpxTrackData.segments.length || gpxTrackData.waypoints.length));

    const editorPanel = document.getElementById('gpx-editor-panel');
    if (editorPanel) editorPanel.style.display = hasDoc ? 'block' : 'none';

    const editBtn = document.getElementById('gpx-edit-btn');
    if (editBtn) {
        editBtn.textContent = editorState.isEditing ? t.btn_gpx_done : t.btn_gpx_edit;
        editBtn.disabled = !hasDoc && !editorState.isEditing;
    }

    const exportBtn = document.getElementById('gpx-export-btn');
    if (exportBtn) exportBtn.disabled = !exportable;

    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = hasDoc ? 'block' : 'none';

    const nameInput = document.getElementById('gpxNameInput');
    if (nameInput) {
        nameInput.disabled = !hasDoc;
        if (nameInput.value !== editorState.doc.name) nameInput.value = editorState.doc.name;
    }

    const activityInput = document.getElementById('gpxActivityInput');
    if (activityInput) {
        activityInput.disabled = !hasDoc;
        if (activityInput.value !== editorState.doc.activity) activityInput.value = editorState.doc.activity;
    }

    const routingCheckbox = document.getElementById('gpxRoutingEnabled');
    if (routingCheckbox) {
        routingCheckbox.checked = editorState.routingEnabled;
        routingCheckbox.disabled = !editorState.isEditing;
    }

    const addWaypointBtn = document.getElementById('gpx-add-waypoint-btn');
    if (addWaypointBtn) {
        addWaypointBtn.disabled = !editorState.isEditing;
        addWaypointBtn.classList.toggle('active', editorState.addWaypointArmed);
    }

    const segmentRow = document.getElementById('gpx-segment-row');
    const segmentSelect = document.getElementById('gpxSegmentSelect');
    if (segmentRow && segmentSelect) {
        if (editorState.doc.segments.length > 1) {
            segmentRow.style.display = 'block';
            segmentSelect.innerHTML = '';
            editorState.doc.segments.forEach((_, index) => {
                const option = document.createElement('option');
                option.value = String(index);
                option.textContent = t.gpx_segment_label.replace('{n}', index + 1);
                if (index === editorState.activeSegmentIndex) option.selected = true;
                segmentSelect.appendChild(option);
            });
            segmentSelect.disabled = !editorState.isEditing;
        } else {
            segmentRow.style.display = 'none';
            segmentSelect.innerHTML = '';
        }
    }

    const help = document.getElementById('gpx-editor-help');
    if (help) {
        if (!editorState.isEditing) {
            help.textContent = hasDoc ? t.editor_help_idle : '';
        } else if (editorState.addWaypointArmed) {
            help.textContent = t.editor_help_waypoint;
        } else if (editorState.routingEnabled) {
            help.textContent = t.editor_help_routing;
        } else {
            help.textContent = t.editor_help_straight;
        }
    }
}

function exportCurrentGpx() {
    const t = translations[currentLang];
    if (!hasEditorDocument()) {
        statusDiv.textContent = t.status_export_empty;
        return;
    }

    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<gpx version="1.1" creator="Topo GPX Viewer v${APP_VERSION}" xmlns="http://www.topografix.com/GPX/1/1">`
    ];

    if (editorState.doc.name) {
        lines.push('  <metadata>');
        lines.push(`    <name>${escapeXml(editorState.doc.name)}</name>`);
        lines.push('  </metadata>');
    }

    editorState.doc.waypoints.forEach((waypoint) => {
        lines.push(`  <wpt lat="${waypoint.lat}" lon="${waypoint.lon}">`);
        if (waypoint.ele !== null) lines.push(`    <ele>${waypoint.ele}</ele>`);
        if (waypoint.name) lines.push(`    <name>${escapeXml(waypoint.name)}</name>`);
        lines.push('  </wpt>');
    });

    if (editorState.doc.segments.length) {
        lines.push('  <trk>');
        if (editorState.doc.name) lines.push(`    <name>${escapeXml(editorState.doc.name)}</name>`);
        if (editorState.doc.activity) lines.push(`    <type>${escapeXml(editorState.doc.activity)}</type>`);
        editorState.doc.segments.forEach((segment) => {
            const geometry = rebuildSegmentGeometry(segment);
            if (!geometry.length) return;
            lines.push('    <trkseg>');
            geometry.forEach((point) => {
                lines.push(`      <trkpt lat="${point.lat}" lon="${point.lon}">`);
                if (point.ele !== null) lines.push(`        <ele>${point.ele}</ele>`);
                lines.push('      </trkpt>');
            });
            lines.push('    </trkseg>');
        });
        lines.push('  </trk>');
    }

    lines.push('</gpx>');

    const blob = new Blob([lines.join('\n')], { type: 'application/gpx+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(editorState.doc.name || 'route')}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    statusDiv.textContent = t.status_export_done;
}

function updateGpxTrackInfo() {
    const infoDiv = document.getElementById('gpx-track-info');
    if (!infoDiv) return;
    if (!gpxTrackData) {
        infoDiv.style.display = 'none';
        infoDiv.innerHTML = '';
        return;
    }
    const t = translations[currentLang];
    const d = gpxTrackData;
    const unit = getDistanceUnit();
    let lengthStr;
    if (unit === 'mi') {
        const miles = d.length / 1609.344;
        lengthStr = miles >= 1 ? miles.toFixed(2) + ' mi' : (d.length * 3.28084).toFixed(0) + ' ft';
    } else {
        lengthStr = d.length >= 1000 ? (d.length / 1000).toFixed(2) + ' km' : Math.round(d.length) + ' m';
    }
    const lines = [];
    if (d.name) {
        lines.push(`<span>${t.gpx_info_name}:</span> ${escapeHtml(d.name)}`);
    }
    if (d.activity) {
        lines.push(`<span>${t.gpx_info_activity}:</span> ${escapeHtml(d.activity)}`);
    }
    lines.push(`<span>${t.gpx_info_length}:</span> ${lengthStr}`);
    if (d.gain > 0 || d.loss > 0) {
        lines.push(`<span>${t.gpx_info_gain}:</span> +${Math.round(d.gain)} m`);
        lines.push(`<span>${t.gpx_info_loss}:</span> -${Math.round(d.loss)} m`);
    }
    if (d.minElev !== null) {
        lines.push(`<span>${t.gpx_info_min_elev}:</span> ${Math.round(d.minElev)} m`);
        lines.push(`<span>${t.gpx_info_max_elev}:</span> ${Math.round(d.maxElev)} m`);
    }
    infoDiv.innerHTML = lines.join('<br>');
    infoDiv.style.display = 'block';
}

function getDistanceUnit() {
    const el = document.getElementById('distanceUnit');
    return el ? el.value : 'km';
}

function computeVisibleTrackLength(allSegments) {
    const bounds = map.getBounds();
    let visible = 0;
    for (const seg of allSegments) {
        for (let i = 1; i < seg.length; i++) {
            const p1 = L.latLng(seg[i - 1].lat, seg[i - 1].lon);
            const p2 = L.latLng(seg[i].lat, seg[i].lon);
            if (bounds.contains(p1) || bounds.contains(p2)) {
                visible += haversineDistance(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
            }
        }
    }
    return visible;
}

function computeDynamicStep(totalLengthMeters, visibleLengthMeters) {
    const unit = getDistanceUnit();
    const unitMeters = unit === 'mi' ? 1609.344 : 1000;
    const refLength = visibleLengthMeters > 0 ? visibleLengthMeters : totalLengthMeters;
    const refUnits = refLength / unitMeters;
    const vw = window.innerWidth || 1024;
    const TARGET_LABELS = vw < 600 ? 6 : vw < 900 ? 8 : 12;
    const niceSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    let rawStep = refUnits / TARGET_LABELS;
    if (rawStep < 0.1) rawStep = 0.1;
    let step = niceSteps[niceSteps.length - 1];
    for (const s of niceSteps) {
        if (s >= rawStep) { step = s; break; }
    }
    if (totalLengthMeters / unitMeters > 20 && step < 1) step = 1;
    return { step, unitMeters, unitLabel: unit === 'mi' ? 'mi' : 'km' };
}

function buildKmLabels(allSegments) {
    const labels = [];
    let totalLength = 0;
    for (const seg of allSegments) {
        for (let i = 1; i < seg.length; i++) {
            totalLength += haversineDistance(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
        }
    }
    const visibleLength = computeVisibleTrackLength(allSegments);
    const { step, unitMeters, unitLabel } = computeDynamicStep(totalLength, visibleLength);
    let cumDist = 0;
    let nextMark = step;
    for (const seg of allSegments) {
        for (let i = 1; i < seg.length; i++) {
            const d = haversineDistance(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
            const prevCum = cumDist;
            cumDist += d;
            while (cumDist >= nextMark * unitMeters) {
                const frac = (nextMark * unitMeters - prevCum) / d;
                const lat = seg[i - 1].lat + frac * (seg[i].lat - seg[i - 1].lat);
                const lon = seg[i - 1].lon + frac * (seg[i].lon - seg[i - 1].lon);
                const displayVal = Number.isInteger(nextMark) ? nextMark : nextMark.toFixed(1);
                const icon = L.divIcon({ className: 'gpx-km-label', html: `${displayVal} ${unitLabel}`, iconSize: null });
                labels.push(L.marker([lat, lon], { icon, interactive: false }));
                nextMark += step;
            }
        }
    }
    return labels;
}

function getGpxColorBySlope() {
    const el = document.getElementById('gpxColorBySlope');
    return el ? el.checked : false;
}

function slopeToColor(slopeDeg, baseColor) {
    const s = Math.min(Math.abs(slopeDeg), 20);
    const t = s / 20;
    const bc = parseInt(baseColor.replace('#', ''), 16);
    const br = (bc >> 16) & 255, bg = (bc >> 8) & 255, bb = bc & 255;
    let r, g, b;
    if (slopeDeg >= 0) {
        if (t <= 0.5) {
            const f = t / 0.5;
            r = br + f * (255 - br);
            g = bg + f * (200 - bg);
            b = bb + f * (0 - bb);
        } else {
            const f = (t - 0.5) / 0.5;
            r = 255 + f * (220 - 255);
            g = 200 + f * (30 - 200);
            b = 0 + f * (30 - 0);
        }
    } else {
        if (t <= 0.5) {
            const f = t / 0.5;
            r = br + f * (0 - br);
            g = bg + f * (180 - bg);
            b = bb + f * (60 - bb);
        } else {
            const f = (t - 0.5) / 0.5;
            r = 0 + f * (30 - 0);
            g = 180 + f * (80 - 180);
            b = 60 + f * (220 - 60);
        }
    }
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function buildSlopeColoredTrack(seg, weight, baseColor) {
    const lines = [];
    for (let i = 1; i < seg.length; i++) {
        const p0 = seg[i - 1], p1 = seg[i];
        const dist = haversineDistance(p0.lat, p0.lon, p1.lat, p1.lon);
        let slopeDeg = 0;
        if (dist > 0 && p0.ele !== null && p1.ele !== null) {
            slopeDeg = Math.atan2(p1.ele - p0.ele, dist) * (180 / Math.PI);
        }
        lines.push(L.polyline([[p0.lat, p0.lon], [p1.lat, p1.lon]], {
            color: slopeToColor(slopeDeg, baseColor), weight, opacity: 0.9
        }));
    }
    return lines;
}

function findMinMaxElevPoints(allSegments) {
    let minPt = null, maxPt = null;
    let minElev = Infinity, maxElev = -Infinity;
    for (const seg of allSegments) {
        for (const p of seg) {
            if (p.ele === null) continue;
            if (p.ele < minElev) { minElev = p.ele; minPt = p; }
            if (p.ele > maxElev) { maxElev = p.ele; maxPt = p; }
        }
    }
    return { minPt, maxPt };
}

function getTrackEndpoints(allSegments) {
    let startPt = null, endPt = null;
    for (const seg of allSegments) {
        if (seg.length > 0) {
            if (!startPt) startPt = seg[0];
            endPt = seg[seg.length - 1];
        }
    }
    return { startPt, endPt };
}

function getGpxShowWaypoints() {
    const el = document.getElementById('gpxShowWaypoints');
    return el ? el.checked : true;
}

function getGpxShowElevProfile() {
    const el = document.getElementById('gpxShowElevProfile');
    return el ? el.checked : true;
}

function getElevMapSync() {
    const el = document.getElementById('gpxElevMapSync');
    return el ? el.checked : true;
}

function getGpxShowMinMax() {
    const el = document.getElementById('gpxShowMinMax');
    return el ? el.checked : true;
}

function createAnchorIcon(isEndpoint, isActive) {
    const classes = ['gpx-anchor-icon'];
    if (isEndpoint) classes.push('endpoint');
    if (isActive) classes.push('active');
    return L.divIcon({
        className: 'gpx-anchor-marker',
        html: `<span class="${classes.join(' ')}"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
}

function createInsertHandleIcon() {
    return L.divIcon({
        className: 'gpx-insert-marker',
        html: '<span class="gpx-insert-icon"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });
}

function createWaypointIcon(waypoint, editing) {
    const label = escapeHtml(waypoint.name || 'POI');
    const extraClass = editing ? ' is-editing' : '';
    return L.divIcon({
        className: 'gpx-waypoint-editor-marker',
        html: `<span class="gpx-waypoint-editor${extraClass}"><span class="gpx-waypoint-dot"></span><span>${label}</span></span>`,
        iconSize: null,
        iconAnchor: [10, 10]
    });
}

function rebuildGpxLayer() {
    if (!gpxTrackData && !editorState.isEditing) {
        if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
        return;
    }
    if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }

    const color = getGpxTrackColor();
    const weight = getGpxTrackWidth();
    const showKm = getGpxShowKmLabels();
    const colorBySlope = getGpxColorBySlope();
    const showWaypoints = editorState.isEditing ? true : getGpxShowWaypoints();
    const showMinMax = getGpxShowMinMax();
    const mapLayers = [];
    const t = translations[currentLang];

    if (gpxTrackData) {
        for (const seg of gpxTrackData.segments) {
            if (seg.length < 2) continue;
            if (colorBySlope) {
                mapLayers.push(...buildSlopeColoredTrack(seg, weight, color));
            } else {
                const coords = seg.map(p => [p.lat, p.lon]);
                mapLayers.push(L.polyline(coords, { color, weight, opacity: 0.85 }));
            }
        }

        if (showWaypoints) {
            const sourceWaypoints = editorState.isEditing ? editorState.doc.waypoints : gpxTrackData.waypoints;
            sourceWaypoints.forEach((wp, waypointIndex) => {
                const icon = editorState.isEditing
                    ? createWaypointIcon(wp, true)
                    : L.divIcon({ className: 'gpx-waypoint-label', html: escapeHtml(wp.name || 'POI'), iconSize: null });
                const marker = L.marker([wp.lat, wp.lon], {
                    icon,
                    interactive: editorState.isEditing,
                    draggable: editorState.isEditing,
                    autoPan: editorState.isEditing,
                    bubblingMouseEvents: false
                });

                if (editorState.isEditing) {
                    marker.on('dragstart', () => {
                        map.dragging.disable();
                        hideInsertionHandle({ redraw: false });
                    });
                    marker.on('dragend', (event) => {
                        const latlng = event.target.getLatLng();
                        wp.lat = latlng.lat;
                        wp.lon = latlng.lng;
                        map.dragging.enable();
                        syncTrackDataFromEditor();
                        statusDiv.textContent = t.status_waypoint_saved;
                    });
                    marker.on('click', (event) => {
                        if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
                        openWaypointModal(waypointIndex);
                    });
                }

                mapLayers.push(marker);
            });
        }

        const { startPt, endPt } = getTrackEndpoints(gpxTrackData.segments);
        const OVERLAP_THRESHOLD = 50;
        const startEndOverlap = startPt && endPt &&
            haversineDistance(startPt.lat, startPt.lon, endPt.lat, endPt.lon) < OVERLAP_THRESHOLD;

        if (startEndOverlap) {
            const label = `⏵ ${t.gpx_start || 'Start'} / ${t.gpx_end || 'End'}`;
            const icon = L.divIcon({ className: 'gpx-start-end-label', html: label, iconSize: null });
            mapLayers.push(L.marker([startPt.lat, startPt.lon], { icon, interactive: false }));
        } else {
            if (startPt) {
                const icon = L.divIcon({ className: 'gpx-start-end-label', html: `▶ ${t.gpx_start || 'Start'}`, iconSize: null });
                mapLayers.push(L.marker([startPt.lat, startPt.lon], { icon, interactive: false }));
            }
            if (endPt) {
                const icon = L.divIcon({ className: 'gpx-start-end-label', html: `⏹ ${t.gpx_end || 'End'}`, iconSize: null });
                mapLayers.push(L.marker([endPt.lat, endPt.lon], { icon, interactive: false }));
            }
        }

        if (showMinMax) {
            const { minPt, maxPt } = findMinMaxElevPoints(gpxTrackData.segments);
            if (maxPt) {
                const icon = L.divIcon({ className: 'gpx-elev-label', html: `▲ ${Math.round(maxPt.ele)} m`, iconSize: null });
                mapLayers.push(L.marker([maxPt.lat, maxPt.lon], { icon, interactive: false }));
            }
            if (minPt) {
                const icon = L.divIcon({ className: 'gpx-elev-label min-elev', html: `▼ ${Math.round(minPt.ele)} m`, iconSize: null });
                mapLayers.push(L.marker([minPt.lat, minPt.lon], { icon, interactive: false }));
            }
        }

        if (showKm) {
            const kmLabels = buildKmLabels(gpxTrackData.segments);
            mapLayers.push(...kmLabels);
        }
    }

    if (editorState.isEditing) {
        const activeSegment = getActiveSegment();
        if (activeSegment) {
            activeSegment.links.forEach((link, linkIndex) => {
                const hitCoords = link.points.map((point) => [point.lat, point.lon]);
                const hitLine = L.polyline(hitCoords, {
                    color: '#000000',
                    weight: 20,
                    opacity: 0,
                    interactive: true,
                    bubblingMouseEvents: false
                });

                hitLine.on('mouseover', () => showInsertionHandle(editorState.activeSegmentIndex, linkIndex));
                hitLine.on('mouseout', () => scheduleHideInsertionHandle());
                hitLine.on('click', (event) => {
                    if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
                    if (L.Browser.touch || 'ontouchstart' in window) {
                        insertAnchorAtLink(editorState.activeSegmentIndex, linkIndex, event.latlng);
                    }
                });
                mapLayers.push(hitLine);
            });

            getVisibleAnchorIndices(activeSegment).forEach((anchorIndex) => {
                const anchor = activeSegment.anchors[anchorIndex];
                const isEndpoint = anchorIndex === 0 || anchorIndex === activeSegment.anchors.length - 1;
                const marker = L.marker([anchor.lat, anchor.lon], {
                    icon: createAnchorIcon(isEndpoint, true),
                    draggable: true,
                    autoPan: true,
                    bubblingMouseEvents: false
                });

                marker.on('dragstart', () => {
                    map.dragging.disable();
                    hideInsertionHandle({ redraw: false });
                });
                marker.on('dragend', async (event) => {
                    map.dragging.enable();
                    await updateAnchorPosition(editorState.activeSegmentIndex, anchorIndex, event.target.getLatLng());
                });
                marker.on('click', (event) => {
                    if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
                });
                mapLayers.push(marker);
            });

            if (editorState.insertionHandle && editorState.insertionHandle.segmentIndex === editorState.activeSegmentIndex) {
                const handleMarker = L.marker(editorState.insertionHandle.latlng, {
                    icon: createInsertHandleIcon(),
                    draggable: true,
                    autoPan: true,
                    bubblingMouseEvents: false
                });

                handleMarker.on('mouseover', () => clearInsertionHideTimer());
                handleMarker.on('mouseout', () => scheduleHideInsertionHandle());
                handleMarker.on('dragstart', () => {
                    clearInsertionHideTimer();
                    map.dragging.disable();
                });
                handleMarker.on('dragend', async (event) => {
                    map.dragging.enable();
                    const handle = editorState.insertionHandle;
                    if (!handle) return;
                    await insertAnchorAtLink(handle.segmentIndex, handle.linkIndex, event.target.getLatLng());
                });

                mapLayers.push(handleMarker);
            }
        }
    }

    if (mapLayers.length > 0) {
        gpxLayer = L.layerGroup(mapLayers).addTo(map);
    }
}

function getDirectChildText(parent, tagName) {
    if (!parent) return '';
    const match = Array.from(parent.children).find((child) => child.tagName && child.tagName.toLowerCase() === tagName.toLowerCase());
    return match ? match.textContent.trim() : '';
}

function parseGpxPoint(node) {
    const lat = parseFloat(node.getAttribute('lat'));
    const lon = parseFloat(node.getAttribute('lon'));
    const eleText = getDirectChildText(node, 'ele');
    const ele = eleText ? parseFloat(eleText) : null;
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return {
        lat,
        lon,
        ele: Number.isNaN(ele) ? null : ele
    };
}

function parseGpxDocument(doc) {
    const parsed = {
        name: getDirectChildText(doc.querySelector('metadata'), 'name'),
        activity: '',
        segments: [],
        waypoints: [],
        totalPoints: 0
    };

    doc.querySelectorAll('trk').forEach((track) => {
        if (!parsed.name) parsed.name = getDirectChildText(track, 'name');
        if (!parsed.activity) parsed.activity = getDirectChildText(track, 'type');
        track.querySelectorAll('trkseg').forEach((segmentNode) => {
            const points = Array.from(segmentNode.querySelectorAll('trkpt'))
                .map(parseGpxPoint)
                .filter(Boolean);
            if (points.length) {
                parsed.segments.push(points);
                parsed.totalPoints += points.length;
            }
        });
    });

    doc.querySelectorAll('rte').forEach((route) => {
        if (!parsed.name) parsed.name = getDirectChildText(route, 'name');
        if (!parsed.activity) parsed.activity = getDirectChildText(route, 'type');
        const points = Array.from(route.querySelectorAll('rtept'))
            .map(parseGpxPoint)
            .filter(Boolean);
        if (points.length) {
            parsed.segments.push(points);
            parsed.totalPoints += points.length;
        }
    });

    doc.querySelectorAll('wpt').forEach((waypointNode) => {
        const point = parseGpxPoint(waypointNode);
        if (!point) return;
        point.name = getDirectChildText(waypointNode, 'name');
        parsed.waypoints.push(point);
        parsed.totalPoints++;
    });

    return parsed;
}

function fitMapToEditorDocument() {
    const allCoords = [];
    editorState.doc.segments.forEach((segment) => {
        rebuildSegmentGeometry(segment).forEach((point) => {
            allCoords.push([point.lat, point.lon]);
        });
    });
    editorState.doc.waypoints.forEach((waypoint) => {
        allCoords.push([waypoint.lat, waypoint.lon]);
    });

    if (!allCoords.length) return;
    const bounds = L.latLngBounds(allCoords);
    if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.1));
    }
}

function loadEditorDocument(doc, statusText) {
    cancelPendingGeometryOperation();
    closeWaypointModal();
    editorState.doc = doc;
    editorState.activeSegmentIndex = 0;
    editorState.isEditing = false;
    editorState.addWaypointArmed = false;
    hideInsertionHandle({ redraw: false });
    syncTrackDataFromEditor();
    fitMapToEditorDocument();
    if (statusText) {
        statusDiv.textContent = statusText;
    }
}

function loadGpxText(text) {
    const t = translations[currentLang];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');
        if (doc.querySelector('parsererror')) {
            statusDiv.textContent = t.status_gpx_error;
            return;
        }

        const parsed = parseGpxDocument(doc);
        if (!parsed.segments.length && !parsed.waypoints.length) {
            statusDiv.textContent = t.status_gpx_empty;
            return;
        }

        const editorDoc = createEditorDocumentFromParsedData(parsed);
        loadEditorDocument(editorDoc, t.status_gpx_loaded.replace('{n}', parsed.totalPoints));
    } catch (error) {
        console.error(error);
        statusDiv.textContent = t.status_gpx_error;
    }
}

document.getElementById('gpx-file-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
        loadGpxText(evt.target.result);
    };
    reader.onerror = function () {
        statusDiv.textContent = translations[currentLang].status_gpx_error;
    };
    reader.readAsText(file);
    e.target.value = '';
});

document.getElementById('gpx-btn').addEventListener('click', function () {
    document.getElementById('gpx-file-input').click();
});

document.getElementById('gpx-new-btn').addEventListener('click', function () {
    createNewRoute();
});

document.getElementById('gpx-edit-btn').addEventListener('click', function () {
    toggleEditMode();
});

document.getElementById('gpx-export-btn').addEventListener('click', function () {
    exportCurrentGpx();
});

document.getElementById('gpxNameInput').addEventListener('input', function () {
    updateEditorMetadataFromInputs();
});

document.getElementById('gpxActivityInput').addEventListener('input', function () {
    updateEditorMetadataFromInputs();
});

document.getElementById('gpxRoutingEnabled').addEventListener('change', function () {
    handleRoutingToggle(this.checked);
});

document.getElementById('gpx-add-waypoint-btn').addEventListener('click', function () {
    toggleWaypointPlacement();
});

document.getElementById('gpxSegmentSelect').addEventListener('change', function () {
    setActiveSegmentIndex(this.value);
});

document.getElementById('waypoint-save-btn').addEventListener('click', function () {
    saveWaypointModal();
});

document.getElementById('waypoint-delete-btn').addEventListener('click', function () {
    deleteWaypointFromModal();
});

document.getElementById('waypoint-cancel-btn').addEventListener('click', function () {
    closeWaypointModal();
});

document.getElementById('waypoint-name-input').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        saveWaypointModal();
    }
});

document.getElementById('waypoint-modal').addEventListener('click', function (event) {
    if (event.target === this) {
        closeWaypointModal();
    }
});

// Live-update track when settings change
document.getElementById('gpxTrackColor').addEventListener('input', function () { rebuildGpxLayer(); });
document.getElementById('gpxTrackWidth').addEventListener('input', function () {
    document.getElementById('gpxTrackWidthVal').textContent = this.value;
    rebuildGpxLayer();
});
document.getElementById('gpxShowKmLabels').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxColorBySlope').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxShowWaypoints').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxShowMinMax').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxShowElevProfile').addEventListener('change', function () {
    if (this.checked) { showElevationProfile(); } else { hideElevationProfile(); }
});
document.getElementById('distanceUnit').addEventListener('change', function () {
    localStorage.setItem('gpxv_distance_unit', this.value);
    rebuildGpxLayer();
    updateGpxTrackInfo();
    if (elevationProfileData && !elevationProfileMinimized) drawElevationProfile();
});

function updateUI() {
    if (!zoomLabel) return;
    const zoom = map.getZoom();
    const displayZoom = Number.isInteger(zoom) ? zoom.toString() : zoom.toFixed(1);
    zoomLabel.innerText = 'Zoom: ' + displayZoom;
}

// ==========================================
// 5.1 SERVICE WORKER & UPDATES
// ==========================================
let newWorker;
function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./service-worker.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateNotification();
                }
            });
        });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
    });
}

function showUpdateNotification() {
    const t = translations[currentLang];
    const snackbar = document.getElementById('update-notification');
    const msg = document.getElementById('update-msg');
    const btn = document.getElementById('update-btn');

    if (snackbar && msg && btn) {
        msg.textContent = t.update_available;
        btn.textContent = t.update_btn;
        snackbar.classList.add('show');

        btn.onclick = () => {
            if (newWorker) {
                newWorker.postMessage({ action: 'skipWaiting' });
            }
        };
    }
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (window.innerWidth <= 600 && 'ontouchstart' in window);
}

function triggerInstallPrompt() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
        deferredInstallPrompt = null;
        const installBtn = document.getElementById('install-app-btn');
        if (installBtn) installBtn.style.display = 'none';
        const mobileBar = document.getElementById('mobile-install-bar');
        if (mobileBar) mobileBar.classList.remove('show');
    });
}

function dismissInstallBar() {
    localStorage.setItem('gpxv_install_dismissed', '1');
    const mobileBar = document.getElementById('mobile-install-bar');
    if (mobileBar) mobileBar.classList.remove('show');
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const installBtn = document.getElementById('install-app-btn');
    if (installBtn) installBtn.style.display = 'block';
    if (isMobileDevice() && !localStorage.getItem('gpxv_install_dismissed')) {
        setTimeout(() => {
            const mobileBar = document.getElementById('mobile-install-bar');
            if (mobileBar) mobileBar.classList.add('show');
        }, 1500);
    }
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const installBtn = document.getElementById('install-app-btn');
    if (installBtn) installBtn.style.display = 'none';
    const mobileBar = document.getElementById('mobile-install-bar');
    if (mobileBar) mobileBar.classList.remove('show');
});

// ==========================================
// 5b. TUTORIAL ENGINE
// ==========================================

let tutorialStep = 0;
let _tutorialOverlayClickHandler = null;

const tutorialSteps = [
    { targetSelector: null, titleKey: 'tutorial_welcome_title', textKey: 'tutorial_welcome_text' },
    { targetSelector: '.circle-btn:not(.info-btn)', titleKey: 'tutorial_language_title', textKey: 'tutorial_language_text' },
    { targetSelector: '.info-btn', titleKey: 'tutorial_info_title', textKey: 'tutorial_info_text' },
    { targetSelector: '.toggle-btn', titleKey: 'tutorial_minimize_title', textKey: 'tutorial_minimize_text' },
    { targetSelector: '#layerSelect', titleKey: 'tutorial_layers_title', textKey: 'tutorial_layers_text' },
    { targetSelector: '.search-group', titleKey: 'tutorial_search_title', textKey: 'tutorial_search_text' },
    { targetSelector: '#routes-section', titleKey: 'tutorial_routes_title', textKey: 'tutorial_routes_text' },
    { targetSelector: null, titleKey: 'tutorial_tips_title', textKey: 'tutorial_tips_text' }
];

function startTutorial() {
    if (controls && controls.classList.contains('minimized')) {
        toggleControls();
    }
    tutorialStep = 0;
    const overlay = document.getElementById('tutorial-overlay');
    overlay.style.display = 'block';
    overlay.style.pointerEvents = 'auto';
    renderTutorialStep();

    if (_tutorialOverlayClickHandler) {
        overlay.removeEventListener('click', _tutorialOverlayClickHandler);
    }
    _tutorialOverlayClickHandler = function(e) {
        if (e.target === overlay) finishTutorial();
    };
    overlay.addEventListener('click', _tutorialOverlayClickHandler);
}

function renderTutorialStep() {
    const t = translations[currentLang];
    const step = tutorialSteps[tutorialStep];
    const overlay = document.getElementById('tutorial-overlay');
    const spotlight = document.getElementById('tutorial-spotlight');
    const tooltip = document.getElementById('tutorial-tooltip');
    const titleEl = document.getElementById('tutorial-title');
    const textEl = document.getElementById('tutorial-text');
    const prevBtn = document.getElementById('tutorial-prev');
    const nextBtn = document.getElementById('tutorial-next');
    const progressEl = document.getElementById('tutorial-progress');

    titleEl.textContent = t[step.titleKey] || '';
    textEl.textContent = t[step.textKey] || '';
    progressEl.textContent = (tutorialStep + 1) + ' / ' + tutorialSteps.length;

    prevBtn.textContent = t.tutorial_btn_prev || 'Back';
    nextBtn.textContent = tutorialStep === tutorialSteps.length - 1 ? (t.tutorial_btn_finish || 'Finish') : (t.tutorial_btn_next || 'Next');
    prevBtn.style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';

    const PAD = 8;
    if (step.targetSelector) {
        const el = document.querySelector(step.targetSelector);
        if (el) {
            const rect = el.getBoundingClientRect();
            spotlight.style.display = 'block';
            spotlight.style.left = (rect.left - PAD) + 'px';
            spotlight.style.top = (rect.top - PAD) + 'px';
            spotlight.style.width = (rect.width + PAD * 2) + 'px';
            spotlight.style.height = (rect.height + PAD * 2) + 'px';

            const margin = 10;
            const tooltipW = tooltip.offsetWidth || 320;
            const tooltipH = tooltip.offsetHeight || 200;
            const spaceBelow = window.innerHeight - rect.bottom;
            let leftPos = Math.max(margin, Math.min(rect.left, window.innerWidth - tooltipW - margin));
            let topPos;
            if (spaceBelow >= tooltipH + 20) {
                topPos = rect.bottom + 14;
            } else {
                topPos = rect.top - tooltipH - 14;
            }
            topPos = Math.max(margin, Math.min(topPos, window.innerHeight - tooltipH - margin));
            tooltip.style.left = leftPos + 'px';
            tooltip.style.top = topPos + 'px';
        } else {
            centerTutorialTooltip(spotlight, tooltip);
        }
    } else {
        centerTutorialTooltip(spotlight, tooltip);
    }
}

function centerTutorialTooltip(spotlight, tooltip) {
    spotlight.style.display = 'block';
    spotlight.style.width = '0';
    spotlight.style.height = '0';
    spotlight.style.left = (window.innerWidth / 2) + 'px';
    spotlight.style.top = (window.innerHeight / 2) + 'px';
    tooltip.style.left = '50%';
    tooltip.style.top = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
}

function tutorialNext() {
    if (tutorialStep < tutorialSteps.length - 1) {
        document.getElementById('tutorial-tooltip').style.transform = '';
        tutorialStep++;
        renderTutorialStep();
    } else {
        finishTutorial();
    }
}

function tutorialPrev() {
    if (tutorialStep > 0) {
        document.getElementById('tutorial-tooltip').style.transform = '';
        tutorialStep--;
        renderTutorialStep();
    }
}

function finishTutorial() {
    localStorage.setItem('gpxv_tutorial_done', '1');
    const overlay = document.getElementById('tutorial-overlay');
    if (_tutorialOverlayClickHandler) {
        overlay.removeEventListener('click', _tutorialOverlayClickHandler);
        _tutorialOverlayClickHandler = null;
    }
    overlay.style.display = 'none';
    overlay.style.pointerEvents = 'none';
}

// ==========================================
// 5c. ELEVATION PROFILE
// ==========================================

let elevationProfileData = null; // [{dist, ele, lat, lon}, ...]
let elevationProfileMinimized = false;
let elevationProfileMarker = null;

function buildElevationProfileData(allSegments) {
    const points = [];
    let cumDist = 0;
    for (const seg of allSegments) {
        for (let i = 0; i < seg.length; i++) {
            if (i > 0) {
                cumDist += haversineDistance(seg[i - 1].lat, seg[i - 1].lon, seg[i].lat, seg[i].lon);
            }
            points.push({
                dist: cumDist,
                ele: seg[i].ele !== null ? seg[i].ele : 0,
                lat: seg[i].lat,
                lon: seg[i].lon
            });
        }
    }
    return points;
}

function getElevationBarHeight() {
    if (!elevationProfileData) return 0;
    const container = document.getElementById('elevation-profile');
    if (!container || container.style.display === 'none') return 0;
    if (elevationProfileMinimized) return 26;
    return window.innerWidth >= 600 ? 150 : 130;
}

function adjustMapControlsForElevation() {
    const h = getElevationBarHeight();
    const bottomRight = document.querySelector('.leaflet-bottom.leaflet-right');
    if (bottomRight) bottomRight.style.bottom = h + 'px';
}

function showElevationProfile() {
    if (!getGpxShowElevProfile()) { hideElevationProfile(); return; }
    if (!gpxTrackData || !gpxTrackData.segments || gpxTrackData.segments.length === 0) return;
    elevationProfileData = buildElevationProfileData(gpxTrackData.segments);
    if (elevationProfileData.length < 2) return;

    const container = document.getElementById('elevation-profile');
    container.style.display = '';
    if (elevationProfileMinimized) {
        container.classList.add('minimized');
    } else {
        container.classList.remove('minimized');
    }
    drawElevationProfile();
    updateElevationProfileInfo(null);
    adjustMapControlsForElevation();
}

function hideElevationProfile() {
    const container = document.getElementById('elevation-profile');
    container.style.display = 'none';
    elevationProfileData = null;
    removeElevationMarker();
    adjustMapControlsForElevation();
}

function toggleElevationProfile() {
    const container = document.getElementById('elevation-profile');
    elevationProfileMinimized = !elevationProfileMinimized;
    if (elevationProfileMinimized) {
        container.classList.add('minimized');
    } else {
        container.classList.remove('minimized');
        drawElevationProfile();
    }
    adjustMapControlsForElevation();
}

function drawElevationProfile() {
    const canvas = document.getElementById('elevation-canvas');
    if (!canvas || !elevationProfileData || elevationProfileData.length < 2) return;

    const body = document.getElementById('elevation-profile-body');
    const rect = body.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PAD_LEFT = 48;
    const PAD_RIGHT = 12;
    const PAD_TOP = 12;
    const PAD_BOTTOM = 24;
    const plotW = W - PAD_LEFT - PAD_RIGHT;
    const plotH = H - PAD_TOP - PAD_BOTTOM;

    const data = elevationProfileData;
    const totalDist = data[data.length - 1].dist;
    let minEle = Infinity, maxEle = -Infinity;
    for (const p of data) {
        if (p.ele < minEle) minEle = p.ele;
        if (p.ele > maxEle) maxEle = p.ele;
    }
    // Add some padding to elevation range
    const eleRange = maxEle - minEle || 1;
    const elePad = eleRange * 0.1;
    const eleMin = minEle - elePad;
    const eleMax = maxEle + elePad;

    const xScale = (d) => PAD_LEFT + (d / totalDist) * plotW;
    const yScale = (e) => PAD_TOP + plotH - ((e - eleMin) / (eleMax - eleMin)) * plotH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines - Y axis (elevation)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#888';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const niceEleSteps = [5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000];
    let eleStep = niceEleSteps[niceEleSteps.length - 1];
    const targetYLabels = Math.max(3, Math.floor(plotH / 35));
    for (const s of niceEleSteps) {
        if ((eleMax - eleMin) / s <= targetYLabels + 1) { eleStep = s; break; }
    }
    const eleStart = Math.ceil(eleMin / eleStep) * eleStep;
    for (let e = eleStart; e <= eleMax; e += eleStep) {
        const y = yScale(e);
        if (y < PAD_TOP || y > PAD_TOP + plotH) continue;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(W - PAD_RIGHT, y);
        ctx.stroke();
        ctx.fillText(Math.round(e) + ' m', PAD_LEFT - 4, y);
    }

    // Grid lines - X axis (distance)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const unit = getDistanceUnit();
    const unitMeters = unit === 'mi' ? 1609.344 : 1000;
    const unitLabel = unit === 'mi' ? 'mi' : 'km';
    const totalUnits = totalDist / unitMeters;
    const niceDistSteps = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const targetXLabels = Math.max(3, Math.floor(plotW / 70));
    let distStep = niceDistSteps[niceDistSteps.length - 1];
    for (const s of niceDistSteps) {
        if (totalUnits / s <= targetXLabels + 1) { distStep = s; break; }
    }
    for (let d = 0; d <= totalUnits; d += distStep) {
        const x = xScale(d * unitMeters);
        if (x < PAD_LEFT || x > PAD_LEFT + plotW) continue;
        ctx.beginPath();
        ctx.moveTo(x, PAD_TOP);
        ctx.lineTo(x, PAD_TOP + plotH);
        ctx.stroke();
        const label = Number.isInteger(d) ? d : d.toFixed(1);
        ctx.fillText(label + ' ' + unitLabel, x, PAD_TOP + plotH + 4);
    }

    // Filled area
    ctx.beginPath();
    ctx.moveTo(xScale(data[0].dist), yScale(data[0].ele));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xScale(data[i].dist), yScale(data[i].ele));
    }
    ctx.lineTo(xScale(data[data.length - 1].dist), yScale(eleMin));
    ctx.lineTo(xScale(data[0].dist), yScale(eleMin));
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + plotH);
    gradient.addColorStop(0, 'rgba(100, 181, 246, 0.7)');
    gradient.addColorStop(1, 'rgba(100, 181, 246, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke line on top
    ctx.beginPath();
    ctx.moveTo(xScale(data[0].dist), yScale(data[0].ele));
    for (let i = 1; i < data.length; i++) {
        ctx.lineTo(xScale(data[i].dist), yScale(data[i].ele));
    }
    ctx.strokeStyle = '#42a5f5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Border around plot
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD_LEFT, PAD_TOP, plotW, plotH);

    // Store drawing params for hit-testing
    canvas._epParams = { PAD_LEFT, PAD_RIGHT, PAD_TOP, PAD_BOTTOM, plotW, plotH, totalDist, eleMin, eleMax, W, H };
}

function getElevationPointAtX(canvasX) {
    const canvas = document.getElementById('elevation-canvas');
    if (!canvas || !canvas._epParams || !elevationProfileData) return null;
    const p = canvas._epParams;
    const frac = (canvasX - p.PAD_LEFT) / p.plotW;
    if (frac < 0 || frac > 1) return null;
    const targetDist = frac * p.totalDist;

    // Binary search for closest point
    const data = elevationProfileData;
    let lo = 0, hi = data.length - 1;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (data[mid].dist <= targetDist) lo = mid;
        else hi = mid;
    }
    // Interpolate between lo and hi
    const dRange = data[hi].dist - data[lo].dist;
    if (dRange === 0) return data[lo];
    const t = (targetDist - data[lo].dist) / dRange;
    return {
        dist: targetDist,
        ele: data[lo].ele + t * (data[hi].ele - data[lo].ele),
        lat: data[lo].lat + t * (data[hi].lat - data[lo].lat),
        lon: data[lo].lon + t * (data[hi].lon - data[lo].lon)
    };
}

function updateElevationProfileInfo(point) {
    const infoEl = document.getElementById('elevation-profile-info');
    if (!infoEl) return;
    if (!point) {
        infoEl.textContent = '';
        return;
    }
    const unit = getDistanceUnit();
    const unitMeters = unit === 'mi' ? 1609.344 : 1000;
    const unitLabel = unit === 'mi' ? 'mi' : 'km';
    const distVal = point.dist / unitMeters;
    const distStr = distVal >= 1 ? distVal.toFixed(2) + ' ' + unitLabel : Math.round(point.dist) + ' m';
    infoEl.textContent = distStr + '  •  ' + Math.round(point.ele) + ' m';
}

function drawElevationCursor(canvasX, point) {
    const canvas = document.getElementById('elevation-canvas');
    if (!canvas || !canvas._epParams) return;

    // Redraw base profile then overlay cursor
    drawElevationProfile();
    if (!point) return;

    const p = canvas._epParams;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const x = canvasX;
    const yScale = (e) => p.PAD_TOP + p.plotH - ((e - p.eleMin) / (p.eleMax - p.eleMin)) * p.plotH;
    const y = yScale(point.ele);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(x, p.PAD_TOP);
    ctx.lineTo(x, p.PAD_TOP + p.plotH);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1565C0';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

function showElevationMarker(lat, lon) {
    if (!elevationProfileMarker) {
        elevationProfileMarker = L.circleMarker([lat, lon], {
            radius: 7,
            color: '#1565C0',
            fillColor: '#42a5f5',
            fillOpacity: 1,
            weight: 2
        }).addTo(map);
    } else {
        elevationProfileMarker.setLatLng([lat, lon]);
    }
}

function removeElevationMarker() {
    if (elevationProfileMarker) {
        map.removeLayer(elevationProfileMarker);
        elevationProfileMarker = null;
    }
    isElevationCursorActive = false;
    syncCrosshairVisibility();
}

// Elevation canvas interaction handlers
(function () {
    const canvas = document.getElementById('elevation-canvas');
    if (!canvas) return;
    let dragging = false;
    let cursorFrac = null; // 0..1 fraction along track for keyboard nav

    function distToCanvasX(frac) {
        const p = canvas._epParams;
        if (!p) return 0;
        return p.PAD_LEFT + frac * p.plotW;
    }

    function showAtFrac(frac, syncMap) {
        if (!elevationProfileData || !canvas._epParams) return;
        frac = Math.max(0, Math.min(1, frac));
        cursorFrac = frac;
        isElevationCursorActive = true;
        syncCrosshairVisibility();
        const canvasX = distToCanvasX(frac);
        const point = getElevationPointAtX(canvasX);
        if (point) {
            drawElevationCursor(canvasX, point);
            updateElevationProfileInfo(point);
            showElevationMarker(point.lat, point.lon);
            if (syncMap && getElevMapSync()) {
                map.panTo([point.lat, point.lon], { animate: false });
            }
        }
    }

    function handlePointer(e, syncMap) {
        const rect = canvas.getBoundingClientRect();
        let clientX;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        } else {
            clientX = e.clientX;
        }
        const canvasX = clientX - rect.left;
        const p = canvas._epParams;
        isElevationCursorActive = true;
        syncCrosshairVisibility();
        if (p) cursorFrac = Math.max(0, Math.min(1, (canvasX - p.PAD_LEFT) / p.plotW));
        const point = getElevationPointAtX(canvasX);
        if (point) {
            drawElevationCursor(canvasX, point);
            updateElevationProfileInfo(point);
            showElevationMarker(point.lat, point.lon);
            if (syncMap && getElevMapSync()) {
                map.panTo([point.lat, point.lon], { animate: false });
            }
        }
    }

    canvas.addEventListener('mousedown', (e) => { dragging = true; handlePointer(e, true); });
    canvas.addEventListener('mousemove', (e) => { if (dragging) handlePointer(e, true); });
    window.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            removeElevationMarker();
            drawElevationProfile();
            updateElevationProfileInfo(null);
        }
    });
    canvas.addEventListener('mouseleave', () => {
        if (!dragging) {
            removeElevationMarker();
            drawElevationProfile();
            updateElevationProfileInfo(null);
        }
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); dragging = true; handlePointer(e, true); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (dragging) handlePointer(e, true); }, { passive: false });
    canvas.addEventListener('touchend', () => {
        dragging = false;
        removeElevationMarker();
        drawElevationProfile();
        updateElevationProfileInfo(null);
    });

    // Also support hover (no click required on desktop) for better UX
    canvas.addEventListener('mousemove', (e) => {
        if (!dragging) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const point = getElevationPointAtX(canvasX);
            if (point) {
                drawElevationCursor(canvasX, point);
                updateElevationProfileInfo(point);
                showElevationMarker(point.lat, point.lon);
            }
        }
    });

    // Tap overlay header to toggle on mobile
    const overlay = document.querySelector('.elevation-profile-overlay');
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (window.innerWidth <= 600 && e.target === overlay) {
                toggleElevationProfile();
            }
        });
    }

    // Keyboard arrow key navigation
    document.addEventListener('keydown', (e) => {
        if (!elevationProfileData || elevationProfileMinimized) return;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const container = document.getElementById('elevation-profile');
        if (!container || container.style.display === 'none') return;

        e.preventDefault();
        const step = e.shiftKey ? 0.01 : 0.002; // Shift for bigger steps
        if (cursorFrac === null) cursorFrac = 0;
        if (e.key === 'ArrowRight') cursorFrac = Math.min(1, cursorFrac + step);
        else cursorFrac = Math.max(0, cursorFrac - step);
        showAtFrac(cursorFrac, true);
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Escape' && cursorFrac !== null) {
            cursorFrac = null;
            removeElevationMarker();
            drawElevationProfile();
            updateElevationProfileInfo(null);
        }
    });

    // Redraw on resize
    window.addEventListener('resize', () => {
        if (elevationProfileData && !elevationProfileMinimized) {
            drawElevationProfile();
        }
        adjustMapControlsForElevation();
    });
})();

// ==========================================
// 6. START LOGIC (Event Listeners & Init)
// ==========================================

if (searchInput) searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") searchLocation(); });

// Map Events
map.on('zoomend', () => { updateUI(); rebuildGpxLayer(); });
map.on('move', () => { updateUI(); });
map.on('moveend', () => {
    const center = map.getCenter();
    localStorage.setItem('gpxv_lat', center.lat);
    localStorage.setItem('gpxv_lng', center.lng);
    localStorage.setItem('gpxv_zoom', map.getZoom());
});

map.on('click', async (event) => {
    if (editorState.isEditing) {
        if (editorState.addWaypointArmed) {
            addWaypointAtLatLng(event.latlng);
            return;
        }
        await appendAnchorToActiveSegment(event.latlng);
        return;
    }

    if (window.innerWidth <= 600 && !isControlsMinimized) {
        toggleControls();
    }
});

// Initialize
updateLanguage();
initServiceWorker();
if (layerSelect) {
    layerSelect.value = savedLayer;
}
const savedUnit = localStorage.getItem('gpxv_distance_unit');
if (savedUnit) {
    const unitSel = document.getElementById('distanceUnit');
    if (unitSel) unitSel.value = savedUnit;
}
const savedRouting = localStorage.getItem('gpxv_routing');
if (savedRouting === 'false') {
    editorState.routingEnabled = false;
}
handleLayerChange(savedLayer);
syncEditorUI();
updateUI();

// Crosshair toggle
(function () {
    const crosshairEl = document.getElementById('crosshair');
    const checkbox = document.getElementById('showCrosshair');
    if (!crosshairEl || !checkbox) return;
    const saved = localStorage.getItem('gpxv_crosshair');
    if (saved === 'false') {
        checkbox.checked = false;
    }
    checkbox.addEventListener('change', function () {
        localStorage.setItem('gpxv_crosshair', this.checked);
        syncCrosshairVisibility();
    });
    syncCrosshairVisibility();
})();

// Auto-start tutorial for new visitors
if (!localStorage.getItem('gpxv_tutorial_done')) {
    setTimeout(() => startTutorial(), 1000);
}
