// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const APP_VERSION = "0.22";

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
        if (document.getElementById('gpx-clear-btn')) document.getElementById('gpx-clear-btn').textContent = t.btn_gpx_clear;
        if (document.getElementById('lbl-track-color')) document.getElementById('lbl-track-color').textContent = t.lbl_track_color;
        if (document.getElementById('lbl-track-width')) document.getElementById('lbl-track-width').textContent = t.lbl_track_width;
        if (document.getElementById('lbl-km-labels')) document.getElementById('lbl-km-labels').textContent = t.lbl_km_labels;
        if (document.getElementById('lbl-color-slope')) document.getElementById('lbl-color-slope').textContent = t.lbl_color_slope;
        if (document.getElementById('lbl-show-waypoints')) document.getElementById('lbl-show-waypoints').textContent = t.lbl_show_waypoints;
        if (document.getElementById('lbl-show-minmax')) document.getElementById('lbl-show-minmax').textContent = t.lbl_show_minmax;
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

        // Edit mode strings
        const sectionEditTitle = document.getElementById('section-edit-title');
        if (sectionEditTitle) sectionEditTitle.textContent = t.section_edit_title;
        const newRouteBtn = document.getElementById('new-route-btn');
        if (newRouteBtn) newRouteBtn.textContent = t.btn_new_route;
        const gpxEditBtn = document.getElementById('gpx-edit-btn');
        if (gpxEditBtn) gpxEditBtn.textContent = t.btn_edit;
        const doneEditBtn = document.getElementById('done-edit-btn');
        if (doneEditBtn) doneEditBtn.textContent = t.btn_done_edit;
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) cancelEditBtn.textContent = t.btn_cancel_edit;
        const saveGpxBtn = document.getElementById('save-gpx-btn');
        if (saveGpxBtn) saveGpxBtn.textContent = t.btn_save_gpx;
        const addWpBtn = document.getElementById('add-waypoint-btn');
        if (addWpBtn) addWpBtn.textContent = t.btn_add_waypoint;
        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) undoBtn.textContent = t.btn_undo;
        const redoBtn = document.getElementById('redo-btn');
        if (redoBtn) redoBtn.textContent = t.btn_redo;
        const lblGpxName = document.getElementById('lbl-gpx-name');
        if (lblGpxName) lblGpxName.textContent = t.lbl_gpx_name;
        const lblActivity = document.getElementById('lbl-activity');
        if (lblActivity) lblActivity.textContent = t.lbl_activity;
        const lblRouting = document.getElementById('lbl-routing');
        if (lblRouting) lblRouting.textContent = t.lbl_routing;
        const gpxNameInput = document.getElementById('gpx-name-input');
        if (gpxNameInput) gpxNameInput.placeholder = t.ph_gpx_name;
        const optHiking = document.getElementById('opt-hiking');
        if (optHiking) optHiking.textContent = t.opt_hiking;
        const optCycling = document.getElementById('opt-cycling');
        if (optCycling) optCycling.textContent = t.opt_cycling;
        const optRunning = document.getElementById('opt-running');
        if (optRunning) optRunning.textContent = t.opt_running;
        const optDriving = document.getElementById('opt-driving');
        if (optDriving) optDriving.textContent = t.opt_driving;
        const lblSavedRoutes = document.getElementById('lbl-saved-routes');
        if (lblSavedRoutes) lblSavedRoutes.textContent = t.lbl_saved_routes;
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

window.clearGpxRoute = function () {
    if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
    gpxTrackData = null;
    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    const editBtn = document.getElementById('gpx-edit-btn');
    if (editBtn) editBtn.style.display = 'none';
    const infoDiv = document.getElementById('gpx-track-info');
    if (infoDiv) { infoDiv.style.display = 'none'; infoDiv.innerHTML = ''; }
    hideElevationProfile();
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

function updateGpxTrackInfo() {
    const infoDiv = document.getElementById('gpx-track-info');
    if (!infoDiv || !gpxTrackData) return;
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
    let html = `<span>${t.gpx_info_length}:</span> ${lengthStr}`;
    if (d.gain > 0 || d.loss > 0) {
        html += `<br><span>${t.gpx_info_gain}:</span> +${Math.round(d.gain)} m`;
        html += `<br><span>${t.gpx_info_loss}:</span> -${Math.round(d.loss)} m`;
    }
    if (d.minElev !== null) {
        html += `<br><span>${t.gpx_info_min_elev}:</span> ${Math.round(d.minElev)} m`;
        html += `<br><span>${t.gpx_info_max_elev}:</span> ${Math.round(d.maxElev)} m`;
    }
    infoDiv.innerHTML = html;
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

function rebuildGpxLayer() {
    if (!gpxTrackData) return;
    if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }

    const color = getGpxTrackColor();
    const weight = getGpxTrackWidth();
    const showKm = getGpxShowKmLabels();
    const colorBySlope = getGpxColorBySlope();
    const showWaypoints = getGpxShowWaypoints();
    const showMinMax = getGpxShowMinMax();
    const mapLayers = [];
    const t = translations[currentLang];

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
        for (const wp of gpxTrackData.waypoints) {
            const label = wp.name || '•';
            const icon = L.divIcon({ className: 'gpx-waypoint-label', html: label, iconSize: null });
            mapLayers.push(L.marker([wp.lat, wp.lon], { icon, interactive: false }));
        }
    }

    // Start / End markers
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

    // Min / Max elevation labels
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

    if (mapLayers.length > 0) {
        gpxLayer = L.layerGroup(mapLayers).addTo(map);
    }
}

document.getElementById('gpx-file-input').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const t = translations[currentLang];
    const reader = new FileReader();
    reader.onload = function (evt) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(evt.target.result, 'application/xml');
            if (doc.querySelector('parsererror')) {
                statusDiv.textContent = t.status_gpx_error;
                return;
            }

            if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }

            const allSegments = [];
            const waypoints = [];
            let totalPoints = 0;

            doc.querySelectorAll('trk').forEach(trk => {
                trk.querySelectorAll('trkseg').forEach(seg => {
                    const pts = [];
                    seg.querySelectorAll('trkpt').forEach(pt => {
                        const lat = parseFloat(pt.getAttribute('lat'));
                        const lon = parseFloat(pt.getAttribute('lon'));
                        const eleEl = pt.querySelector('ele');
                        const ele = eleEl ? parseFloat(eleEl.textContent) : null;
                        if (!isNaN(lat) && !isNaN(lon)) pts.push({ lat, lon, ele: isNaN(ele) ? null : ele });
                    });
                    if (pts.length > 0) {
                        allSegments.push(pts);
                        totalPoints += pts.length;
                    }
                });
            });

            doc.querySelectorAll('rte').forEach(rte => {
                const pts = [];
                rte.querySelectorAll('rtept').forEach(pt => {
                    const lat = parseFloat(pt.getAttribute('lat'));
                    const lon = parseFloat(pt.getAttribute('lon'));
                    const eleEl = pt.querySelector('ele');
                    const ele = eleEl ? parseFloat(eleEl.textContent) : null;
                    if (!isNaN(lat) && !isNaN(lon)) pts.push({ lat, lon, ele: isNaN(ele) ? null : ele });
                });
                if (pts.length > 0) {
                    allSegments.push(pts);
                    totalPoints += pts.length;
                }
            });

            doc.querySelectorAll('wpt').forEach(pt => {
                const lat = parseFloat(pt.getAttribute('lat'));
                const lon = parseFloat(pt.getAttribute('lon'));
                if (!isNaN(lat) && !isNaN(lon)) {
                    const nameEl = pt.querySelector('name');
                    const name = nameEl ? nameEl.textContent : '';
                    waypoints.push({ lat, lon, name });
                    totalPoints++;
                }
            });

            if (allSegments.length === 0 && waypoints.length === 0) {
                statusDiv.textContent = t.status_gpx_empty;
                return;
            }

            const stats = computeTrackStats(allSegments);
            gpxTrackData = { segments: allSegments, waypoints, ...stats };

            // Extract GPX name from metadata for edit mode
            const metaName = doc.querySelector('metadata > name') || doc.querySelector('trk > name');
            if (metaName) gpxTrackData._gpxName = metaName.textContent.trim();
            const trkType = doc.querySelector('trk > type');
            if (trkType) gpxTrackData._gpxType = trkType.textContent.trim();

            rebuildGpxLayer();
            updateGpxTrackInfo();
            showElevationProfile();

            if (gpxLayer) {
                const allCoords = [];
                allSegments.forEach(s => s.forEach(p => allCoords.push([p.lat, p.lon])));
                waypoints.forEach(w => allCoords.push([w.lat, w.lon]));
                if (allCoords.length > 0) {
                    map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
                }
            }

            const clearBtn = document.getElementById('gpx-clear-btn');
            if (clearBtn) clearBtn.style.display = 'block';
            const editBtn = document.getElementById('gpx-edit-btn');
            if (editBtn) editBtn.style.display = 'block';

            statusDiv.textContent = t.status_gpx_loaded.replace('{n}', totalPoints);
        } catch (err) {
            statusDiv.textContent = t.status_gpx_error;
        }
    };
    reader.onerror = function () {
        statusDiv.textContent = translations[currentLang].status_gpx_error;
    };
    reader.readAsText(file);
    e.target.value = '';
});

// Live-update track when settings change
document.getElementById('gpxTrackColor').addEventListener('input', function () {
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
});
document.getElementById('gpxTrackWidth').addEventListener('input', function () {
    document.getElementById('gpxTrackWidthVal').textContent = this.value;
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
});
document.getElementById('gpxShowKmLabels').addEventListener('change', function () {
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
});
document.getElementById('gpxColorBySlope').addEventListener('change', function () {
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
});
document.getElementById('gpxShowWaypoints').addEventListener('change', function () {
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
});
document.getElementById('gpxShowMinMax').addEventListener('change', function () {
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
});
document.getElementById('gpxShowElevProfile').addEventListener('change', function () {
    if (this.checked) { showElevationProfile(); } else { hideElevationProfile(); }
});
document.getElementById('distanceUnit').addEventListener('change', function () {
    localStorage.setItem('gpxv_distance_unit', this.value);
    if (editState.enabled) rebuildEditLayer(); else rebuildGpxLayer();
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
// 5d. ROUTE EDITOR — STATE & ORS INTEGRATION
// ==========================================

let editState = {
    enabled: false,
    routingEnabled: true,
    activityType: 'hiking',
    gpxName: '',
    anchors: [],          // [{id, lat, lon, ele, importance}]
    segments: [],         // [{fromId, toId, points: [{lat,lon,ele}], routed: bool}]
    waypoints: [],        // [{id, lat, lon, name, desc}]
    undoStack: [],
    redoStack: [],
    originalGpxData: null,
    waypointMode: false,
    routeCache: new Map(),
};

let editLayer = null;
let editAnchorMarkers = [];
let editGhostMarker = null;
let editWaypointMarkers = [];
let _editIdCounter = 0;

function generateEditId() { return ++_editIdCounter; }

// ORS service config (reuses lockedServices pattern for key modal)
const ORS_STORAGE_KEY = 'gpxv_ors_key';
const ORS_LINK = 'https://openrouteservice.org/dev/#/signup';

function getOrsApiKey() { return localStorage.getItem(ORS_STORAGE_KEY) || ''; }

function showOrsKeyModal() {
    const t = translations[currentLang];
    pendingServiceKey = '_ors';
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const modalLink = document.getElementById('modal-link');
    const keyInput = document.getElementById('api-key-input');
    modalTitle.textContent = t.modal_ors_title;
    modalText.textContent = t.modal_ors_text;
    modalLink.href = ORS_LINK;
    modalLink.textContent = ORS_LINK;
    keyInput.value = getOrsApiKey();
    document.getElementById('key-modal').style.display = 'flex';
}

// Patch saveApiKey to handle ORS
const _origSaveApiKey = saveApiKey;
saveApiKey = function () {
    if (pendingServiceKey === '_ors') {
        const t = translations[currentLang];
        const keyInput = document.getElementById('api-key-input');
        const key = keyInput.value.trim();
        if (!key) { alert(t.msg_api_alert); return; }
        localStorage.setItem(ORS_STORAGE_KEY, key);
        document.getElementById('key-modal').style.display = 'none';
        pendingServiceKey = null;
        return;
    }
    _origSaveApiKey();
};

// ORS profile mapping
function getOrsProfile(activityType) {
    const profiles = {
        hiking: 'foot-hiking',
        cycling: 'cycling-regular',
        running: 'foot-walking',
        driving: 'driving-car'
    };
    return profiles[activityType] || 'foot-hiking';
}

// Route a segment between two points via ORS
async function routeSegmentORS(fromLat, fromLon, toLat, toLon) {
    const key = getOrsApiKey();
    if (!key) throw new Error('No ORS key');
    const profile = getOrsProfile(editState.activityType);
    const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${encodeURIComponent(key)}&start=${fromLon},${fromLat}&end=${toLon},${toLat}&elevation=true`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`ORS ${resp.status}`);
    const data = await resp.json();
    const coords = data.features[0].geometry.coordinates;
    return coords.map(c => ({ lat: c[1], lon: c[0], ele: c.length > 2 ? c[2] : null }));
}

// Route or straight line between two anchors
async function computeSegment(fromAnchor, toAnchor) {
    if (!editState.routingEnabled) {
        return {
            fromId: fromAnchor.id, toId: toAnchor.id,
            points: [
                { lat: fromAnchor.lat, lon: fromAnchor.lon, ele: fromAnchor.ele || null },
                { lat: toAnchor.lat, lon: toAnchor.lon, ele: toAnchor.ele || null }
            ],
            routed: false
        };
    }
    const cacheKey = `${fromAnchor.lat},${fromAnchor.lon}-${toAnchor.lat},${toAnchor.lon}-${editState.activityType}`;
    if (editState.routeCache.has(cacheKey)) {
        const pts = editState.routeCache.get(cacheKey);
        return { fromId: fromAnchor.id, toId: toAnchor.id, points: pts, routed: true };
    }
    try {
        const pts = await routeSegmentORS(fromAnchor.lat, fromAnchor.lon, toAnchor.lat, toAnchor.lon);
        editState.routeCache.set(cacheKey, pts);
        return { fromId: fromAnchor.id, toId: toAnchor.id, points: pts, routed: true };
    } catch (e) {
        statusDiv.textContent = translations[currentLang].status_route_error;
        return {
            fromId: fromAnchor.id, toId: toAnchor.id,
            points: [
                { lat: fromAnchor.lat, lon: fromAnchor.lon, ele: fromAnchor.ele || null },
                { lat: toAnchor.lat, lon: toAnchor.lon, ele: toAnchor.ele || null }
            ],
            routed: false
        };
    }
}

// Batch re-route all segments with throttling
async function rerouteAllSegments() {
    const t = translations[currentLang];
    statusDiv.textContent = t.status_rerouting;
    editState.routeCache.clear();
    const newSegments = [];
    for (let i = 0; i < editState.anchors.length - 1; i++) {
        const seg = await computeSegment(editState.anchors[i], editState.anchors[i + 1]);
        newSegments.push(seg);
        if (i % 5 === 4) await new Promise(r => setTimeout(r, 200)); // throttle
    }
    editState.segments = newSegments;
    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = t.status_edit_mode;
}

// ==========================================
// 5e. UNDO / REDO
// ==========================================

function cloneEditSnapshot() {
    return {
        anchors: JSON.parse(JSON.stringify(editState.anchors)),
        segments: JSON.parse(JSON.stringify(editState.segments)),
        waypoints: JSON.parse(JSON.stringify(editState.waypoints)),
    };
}

function restoreEditSnapshot(snap) {
    editState.anchors = snap.anchors;
    editState.segments = snap.segments;
    editState.waypoints = snap.waypoints;
}

function pushUndo() {
    editState.undoStack.push(cloneEditSnapshot());
    if (editState.undoStack.length > 50) editState.undoStack.shift();
    editState.redoStack = [];
    updateUndoRedoButtons();
}

window.editUndo = function () {
    if (editState.undoStack.length === 0) return;
    editState.redoStack.push(cloneEditSnapshot());
    restoreEditSnapshot(editState.undoStack.pop());
    syncEditToGpxData();
    rebuildEditLayer();
    updateUndoRedoButtons();
};

window.editRedo = function () {
    if (editState.redoStack.length === 0) return;
    editState.undoStack.push(cloneEditSnapshot());
    restoreEditSnapshot(editState.redoStack.pop());
    syncEditToGpxData();
    rebuildEditLayer();
    updateUndoRedoButtons();
};

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = editState.undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = editState.redoStack.length === 0;
}

// Ctrl+Z / Ctrl+Y keyboard shortcuts
document.addEventListener('keydown', function (e) {
    if (!editState.enabled) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); editUndo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); editRedo(); }
});

// ==========================================
// 5f. DOUGLAS-PEUCKER WITH IMPORTANCE
// ==========================================

function douglasPeuckerWithImportance(points) {
    if (points.length <= 2) {
        return points.map((p, i) => ({ ...p, importance: 1.0 }));
    }

    const n = points.length;
    const importance = new Float64Array(n);
    importance[0] = 1.0;
    importance[n - 1] = 1.0;

    // Perpendicular distance from point to line (start, end)
    function perpDist(idx, startIdx, endIdx) {
        const A = points[startIdx], B = points[endIdx], P = points[idx];
        const dx = B.lon - A.lon, dy = B.lat - A.lat;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return haversineDistance(P.lat, P.lon, A.lat, A.lon);
        const t = Math.max(0, Math.min(1, ((P.lon - A.lon) * dx + (P.lat - A.lat) * dy) / lenSq));
        const projLat = A.lat + t * dy, projLon = A.lon + t * dx;
        return haversineDistance(P.lat, P.lon, projLat, projLon);
    }

    // Iterative DP using a stack
    const stack = [[0, n - 1]];
    let maxDeviation = 0;
    // First pass: find global max deviation for normalization
    const deviations = new Float64Array(n);
    const dpStack = [[0, n - 1]];
    while (dpStack.length > 0) {
        const [start, end] = dpStack.pop();
        if (end - start < 2) continue;
        let maxDist = 0, maxIdx = start;
        for (let i = start + 1; i < end; i++) {
            const d = perpDist(i, start, end);
            if (d > maxDist) { maxDist = d; maxIdx = i; }
        }
        if (maxDist > 0) {
            deviations[maxIdx] = maxDist;
            if (maxDist > maxDeviation) maxDeviation = maxDist;
            dpStack.push([start, maxIdx]);
            dpStack.push([maxIdx, end]);
        }
    }

    // Assign importance: higher deviation → higher importance
    if (maxDeviation > 0) {
        for (let i = 1; i < n - 1; i++) {
            importance[i] = Math.min(1.0, deviations[i] / maxDeviation);
        }
    }

    return points.map((p, i) => ({ ...p, importance: importance[i] }));
}

function getImportanceThreshold(zoom) {
    // More zoom → lower threshold → more anchors visible
    if (zoom >= 18) return 0;
    if (zoom >= 16) return 0.02;
    if (zoom >= 14) return 0.05;
    if (zoom >= 12) return 0.1;
    if (zoom >= 10) return 0.2;
    if (zoom >= 8) return 0.4;
    return 0.6;
}

function getVisibleAnchors() {
    const threshold = getImportanceThreshold(map.getZoom());
    return editState.anchors.filter(a => a.importance >= threshold);
}

// ==========================================
// 5g. GENERATE ANCHORS FROM GPX
// ==========================================

function generateAnchorsFromGpx() {
    if (!gpxTrackData || !gpxTrackData.segments) return;

    // Flatten all segments into a single point array
    const allPts = [];
    for (const seg of gpxTrackData.segments) {
        for (const p of seg) {
            allPts.push({ lat: p.lat, lon: p.lon, ele: p.ele });
        }
    }
    if (allPts.length === 0) return;

    const withImportance = douglasPeuckerWithImportance(allPts);
    editState.anchors = withImportance.map(p => ({
        id: generateEditId(),
        lat: p.lat, lon: p.lon, ele: p.ele,
        importance: p.importance
    }));

    // Build segments between consecutive anchors using original GPX geometry
    editState.segments = [];
    for (let i = 0; i < editState.anchors.length - 1; i++) {
        // Find original points between these two anchor positions
        const from = editState.anchors[i];
        const to = editState.anchors[i + 1];
        // For initial load, use the original track points between anchor indices
        const fromIdx = withImportance.indexOf(withImportance.find(p => p.lat === from.lat && p.lon === from.lon));
        const toIdx = withImportance.indexOf(withImportance.find(p => p.lat === to.lat && p.lon === to.lon));
        const segPts = [];
        for (let j = fromIdx; j <= toIdx; j++) {
            segPts.push({ lat: allPts[j].lat, lon: allPts[j].lon, ele: allPts[j].ele });
        }
        editState.segments.push({
            fromId: from.id, toId: to.id,
            points: segPts.length >= 2 ? segPts : [
                { lat: from.lat, lon: from.lon, ele: from.ele },
                { lat: to.lat, lon: to.lon, ele: to.ele }
            ],
            routed: false
        });
    }

    // Copy waypoints
    editState.waypoints = (gpxTrackData.waypoints || []).map(w => ({
        id: generateEditId(),
        lat: w.lat, lon: w.lon,
        name: w.name || '', desc: w.desc || ''
    }));

    // Try to extract GPX name from metadata
    editState.gpxName = editState.gpxName || '';
}

// ==========================================
// 5h. EDIT LAYER RENDERING
// ==========================================

function rebuildEditLayer() {
    if (!editState.enabled) return;

    // Remove old layer
    if (editLayer) { map.removeLayer(editLayer); editLayer = null; }
    editAnchorMarkers = [];
    if (editGhostMarker) { map.removeLayer(editGhostMarker); editGhostMarker = null; }

    const color = getGpxTrackColor();
    const weight = getGpxTrackWidth();
    const colorBySlope = getGpxColorBySlope();
    const mapLayers = [];

    // Draw segments
    for (let si = 0; si < editState.segments.length; si++) {
        const seg = editState.segments[si];
        if (!seg.points || seg.points.length < 2) continue;
        if (colorBySlope) {
            mapLayers.push(...buildSlopeColoredTrack(seg.points, weight, color));
        } else {
            const coords = seg.points.map(p => [p.lat, p.lon]);
            mapLayers.push(L.polyline(coords, { color, weight, opacity: 0.85 }));
        }
    }

    // Segment polylines for ghost anchor insertion
    for (let si = 0; si < editState.segments.length; si++) {
        const seg = editState.segments[si];
        if (!seg.points || seg.points.length < 2) continue;
        const coords = seg.points.map(p => [p.lat, p.lon]);
        const hitLine = L.polyline(coords, { color: 'transparent', weight: Math.max(weight + 10, 20), opacity: 0 });
        hitLine._segIndex = si;
        hitLine.on('mouseover', onSegmentMouseOver);
        hitLine.on('mousemove', onSegmentMouseMove);
        hitLine.on('mouseout', onSegmentMouseOut);
        hitLine.on('click', onSegmentClick);
        mapLayers.push(hitLine);
    }

    // Draw visible anchors
    const visibleAnchors = getVisibleAnchors();
    for (const anchor of visibleAnchors) {
        const icon = L.divIcon({ className: 'anchor-marker', iconSize: [14, 14], iconAnchor: [7, 7] });
        const marker = L.marker([anchor.lat, anchor.lon], { icon, draggable: true, _anchorId: anchor.id });
        marker.on('dragstart', onAnchorDragStart);
        marker.on('drag', onAnchorDrag);
        marker.on('dragend', onAnchorDragEnd);
        marker.on('contextmenu', onAnchorRightClick);

        // Long press for mobile delete
        let longPressTimer = null;
        marker.on('mousedown', () => { longPressTimer = setTimeout(() => onAnchorDelete(anchor.id), 500); });
        marker.on('mouseup', () => { clearTimeout(longPressTimer); });
        marker.on('dragstart', () => { clearTimeout(longPressTimer); });

        editAnchorMarkers.push(marker);
        mapLayers.push(marker);
    }

    // Draw waypoints
    for (const wp of editState.waypoints) {
        const label = wp.name || '📍';
        const icon = L.divIcon({ className: 'gpx-waypoint-label waypoint-edit-marker', html: label, iconSize: null });
        const marker = L.marker([wp.lat, wp.lon], { icon, draggable: true, _wpId: wp.id });
        marker.on('dragend', function () {
            pushUndo();
            const latlng = this.getLatLng();
            const w = editState.waypoints.find(x => x.id === wp.id);
            if (w) { w.lat = latlng.lat; w.lon = latlng.lng; }
            syncEditToGpxData();
            rebuildEditLayer();
        });
        marker.on('click', function () { openWaypointPopup(wp.id, this); });
        editWaypointMarkers.push(marker);
        mapLayers.push(marker);
    }

    // Show km labels if enabled
    if (getGpxShowKmLabels() && editState.segments.length > 0) {
        const allSegPts = editState.segments.map(s => s.points);
        const kmLabels = buildKmLabels(allSegPts);
        mapLayers.push(...kmLabels);
    }

    // Start/End markers
    if (editState.anchors.length > 0) {
        const t = translations[currentLang];
        const startA = editState.anchors[0];
        const endA = editState.anchors[editState.anchors.length - 1];
        const OVERLAP = 50;
        const overlap = editState.anchors.length > 1 && haversineDistance(startA.lat, startA.lon, endA.lat, endA.lon) < OVERLAP;
        if (overlap) {
            const lbl = `⏵ ${t.gpx_start || 'Start'} / ${t.gpx_end || 'End'}`;
            mapLayers.push(L.marker([startA.lat, startA.lon], { icon: L.divIcon({ className: 'gpx-start-end-label', html: lbl, iconSize: null }), interactive: false }));
        } else {
            mapLayers.push(L.marker([startA.lat, startA.lon], { icon: L.divIcon({ className: 'gpx-start-end-label', html: `▶ ${t.gpx_start || 'Start'}`, iconSize: null }), interactive: false }));
            if (editState.anchors.length > 1) {
                mapLayers.push(L.marker([endA.lat, endA.lon], { icon: L.divIcon({ className: 'gpx-start-end-label', html: `⏹ ${t.gpx_end || 'End'}`, iconSize: null }), interactive: false }));
            }
        }
    }

    // Min/Max elevation
    if (getGpxShowMinMax() && editState.segments.length > 0) {
        const allSegPts = editState.segments.map(s => s.points);
        const { minPt, maxPt } = findMinMaxElevPoints(allSegPts);
        if (maxPt) {
            mapLayers.push(L.marker([maxPt.lat, maxPt.lon], { icon: L.divIcon({ className: 'gpx-elev-label', html: `▲ ${Math.round(maxPt.ele)} m`, iconSize: null }), interactive: false }));
        }
        if (minPt) {
            mapLayers.push(L.marker([minPt.lat, minPt.lon], { icon: L.divIcon({ className: 'gpx-elev-label min-elev', html: `▼ ${Math.round(minPt.ele)} m`, iconSize: null }), interactive: false }));
        }
    }

    if (mapLayers.length > 0) {
        editLayer = L.layerGroup(mapLayers).addTo(map);
    }

    // Update stats
    syncEditToGpxData();
    updateGpxTrackInfo();
    showElevationProfile();
}

// Sync edit state to gpxTrackData for stats/elevation
function syncEditToGpxData() {
    const allSegPts = editState.segments.map(s => s.points);
    const stats = computeTrackStats(allSegPts);
    gpxTrackData = {
        segments: allSegPts,
        waypoints: editState.waypoints.map(w => ({ lat: w.lat, lon: w.lon, name: w.name })),
        ...stats
    };
}

// ==========================================
// 5i. ANCHOR INTERACTION HANDLERS
// ==========================================

function onAnchorDragStart(e) {
    pushUndo();
}

function onAnchorDrag(e) {
    // Real-time preview: update anchor position and show straight-line preview
    const marker = e.target;
    const anchorId = marker.options._anchorId;
    const latlng = marker.getLatLng();
    const anchor = editState.anchors.find(a => a.id === anchorId);
    if (anchor) {
        anchor.lat = latlng.lat;
        anchor.lon = latlng.lng;
    }
}

async function onAnchorDragEnd(e) {
    const marker = e.target;
    const anchorId = marker.options._anchorId;
    const latlng = marker.getLatLng();
    const anchor = editState.anchors.find(a => a.id === anchorId);
    if (!anchor) return;
    anchor.lat = latlng.lat;
    anchor.lon = latlng.lng;

    const idx = editState.anchors.indexOf(anchor);
    const t = translations[currentLang];
    statusDiv.textContent = t.status_routing;

    // Recompute adjacent segments
    if (idx > 0) {
        editState.segments[idx - 1] = await computeSegment(editState.anchors[idx - 1], anchor);
    }
    if (idx < editState.anchors.length - 1) {
        editState.segments[idx] = await computeSegment(anchor, editState.anchors[idx + 1]);
    }

    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = t.status_edit_mode;
}

function onAnchorRightClick(e) {
    L.DomEvent.preventDefault(e);
    const anchorId = e.target.options._anchorId;
    onAnchorDelete(anchorId);
}

async function onAnchorDelete(anchorId) {
    const idx = editState.anchors.findIndex(a => a.id === anchorId);
    if (idx === -1) return;
    if (editState.anchors.length <= 1) return; // Keep at least one anchor

    pushUndo();
    const t = translations[currentLang];

    editState.anchors.splice(idx, 1);

    // Rebuild segments around deleted anchor
    if (idx === 0) {
        // Removed first anchor, remove first segment
        editState.segments.shift();
    } else if (idx >= editState.anchors.length) {
        // Removed last anchor, remove last segment
        editState.segments.pop();
    } else {
        // Removed middle anchor, merge two segments into one
        statusDiv.textContent = t.status_routing;
        const newSeg = await computeSegment(editState.anchors[idx - 1], editState.anchors[idx]);
        editState.segments.splice(idx - 1, 2, newSeg);
    }

    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = t.status_anchor_deleted;
}

// Ghost anchor on segment hover
function onSegmentMouseOver(e) {
    if (editGhostMarker) return;
    showGhostAnchor(e);
}

function onSegmentMouseMove(e) {
    if (!editGhostMarker) {
        showGhostAnchor(e);
        return;
    }
    editGhostMarker.setLatLng(e.latlng);
}

function onSegmentMouseOut(e) {
    removeGhostAnchor();
}

function showGhostAnchor(e) {
    if (editGhostMarker) return;
    const icon = L.divIcon({ className: 'anchor-marker ghost', iconSize: [14, 14], iconAnchor: [7, 7] });
    editGhostMarker = L.marker(e.latlng, { icon, draggable: true });
    editGhostMarker._segIndex = e.target._segIndex;
    editGhostMarker.addTo(map);
    editGhostMarker.on('dragstart', onGhostDragStart);
    editGhostMarker.on('dragend', onGhostDragEnd);
}

function removeGhostAnchor() {
    if (editGhostMarker) {
        map.removeLayer(editGhostMarker);
        editGhostMarker = null;
    }
}

function onGhostDragStart(e) {
    pushUndo();
}

async function onGhostDragEnd(e) {
    const latlng = e.target.getLatLng();
    const segIdx = e.target._segIndex;
    removeGhostAnchor();

    if (segIdx === undefined || segIdx < 0 || segIdx >= editState.segments.length) return;
    const t = translations[currentLang];
    statusDiv.textContent = t.status_routing;

    // Insert new anchor between anchors[segIdx] and anchors[segIdx+1]
    const newAnchor = {
        id: generateEditId(),
        lat: latlng.lat, lon: latlng.lng, ele: null,
        importance: 0.5
    };
    editState.anchors.splice(segIdx + 1, 0, newAnchor);

    // Replace old segment with two new segments
    const seg1 = await computeSegment(editState.anchors[segIdx], newAnchor);
    const seg2 = await computeSegment(newAnchor, editState.anchors[segIdx + 2]);
    editState.segments.splice(segIdx, 1, seg1, seg2);

    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = t.status_edit_mode;
}

// Segment tap on touch to insert anchor
async function onSegmentClick(e) {
    if (!('ontouchstart' in window)) return; // Only for touch devices
    L.DomEvent.stopPropagation(e);
    const segIdx = e.target._segIndex;
    if (segIdx === undefined) return;

    pushUndo();
    const t = translations[currentLang];
    statusDiv.textContent = t.status_routing;

    const newAnchor = {
        id: generateEditId(),
        lat: e.latlng.lat, lon: e.latlng.lng, ele: null,
        importance: 0.5
    };
    editState.anchors.splice(segIdx + 1, 0, newAnchor);

    const seg1 = await computeSegment(editState.anchors[segIdx], newAnchor);
    const seg2 = await computeSegment(newAnchor, editState.anchors[segIdx + 2]);
    editState.segments.splice(segIdx, 1, seg1, seg2);

    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = t.status_edit_mode;
}

// Map click handler for adding new anchors
async function onEditMapClick(e) {
    if (editState.waypointMode) {
        onWaypointMapClick(e);
        return;
    }

    pushUndo();
    const t = translations[currentLang];

    const newAnchor = {
        id: generateEditId(),
        lat: e.latlng.lat, lon: e.latlng.lng, ele: null,
        importance: 1.0
    };
    editState.anchors.push(newAnchor);

    if (editState.anchors.length > 1) {
        statusDiv.textContent = t.status_routing;
        const prevAnchor = editState.anchors[editState.anchors.length - 2];
        const seg = await computeSegment(prevAnchor, newAnchor);
        editState.segments.push(seg);
    }

    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = t.status_edit_mode;
}

// ==========================================
// 5j. WAYPOINT EDITING
// ==========================================

window.toggleWaypointMode = function () {
    const t = translations[currentLang];
    editState.waypointMode = !editState.waypointMode;
    const btn = document.getElementById('add-waypoint-btn');
    if (editState.waypointMode) {
        btn.style.outline = '2px solid #1976D2';
        statusDiv.textContent = t.status_waypoint_mode;
    } else {
        btn.style.outline = '';
        statusDiv.textContent = t.status_edit_mode;
    }
};

function onWaypointMapClick(e) {
    pushUndo();
    const wp = {
        id: generateEditId(),
        lat: e.latlng.lat, lon: e.latlng.lng,
        name: '', desc: ''
    };
    editState.waypoints.push(wp);
    editState.waypointMode = false;
    const btn = document.getElementById('add-waypoint-btn');
    if (btn) btn.style.outline = '';
    syncEditToGpxData();
    rebuildEditLayer();

    // Find the newly created marker and open popup
    setTimeout(() => {
        const marker = editWaypointMarkers.find(m => m.options._wpId === wp.id);
        if (marker) openWaypointPopup(wp.id, marker);
    }, 100);
}

function openWaypointPopup(wpId, marker) {
    const wp = editState.waypoints.find(w => w.id === wpId);
    if (!wp) return;
    const t = translations[currentLang];

    const html = `
        <div>
            <input type="text" class="wp-name-input" value="${wp.name.replace(/"/g, '&quot;')}" placeholder="${t.ph_waypoint_name}">
            <input type="text" class="wp-desc-input" value="${(wp.desc || '').replace(/"/g, '&quot;')}" placeholder="${t.ph_waypoint_desc}">
            <div class="wp-popup-btns">
                <button class="wp-save-btn" onclick="saveWaypointFromPopup(${wpId})">${t.btn_wp_save}</button>
                <button class="wp-delete-btn" onclick="deleteWaypoint(${wpId})">${t.btn_wp_delete}</button>
            </div>
        </div>
    `;
    marker.unbindPopup();
    marker.bindPopup(html, { className: 'waypoint-edit-popup', closeButton: true, minWidth: 180 }).openPopup();
}

window.saveWaypointFromPopup = function (wpId) {
    const wp = editState.waypoints.find(w => w.id === wpId);
    if (!wp) return;
    const popup = document.querySelector('.waypoint-edit-popup');
    if (!popup) return;
    const nameInput = popup.querySelector('.wp-name-input');
    const descInput = popup.querySelector('.wp-desc-input');
    if (nameInput) wp.name = nameInput.value.trim();
    if (descInput) wp.desc = descInput.value.trim();
    map.closePopup();
    syncEditToGpxData();
    rebuildEditLayer();
};

window.deleteWaypoint = function (wpId) {
    pushUndo();
    editState.waypoints = editState.waypoints.filter(w => w.id !== wpId);
    map.closePopup();
    syncEditToGpxData();
    rebuildEditLayer();
};

// ==========================================
// 5k. ENTER / EXIT EDIT MODE
// ==========================================

window.enterEditMode = function (isNewRoute) {
    const t = translations[currentLang];

    // Check ORS key if routing enabled
    if (document.getElementById('routing-toggle').checked && !getOrsApiKey()) {
        showOrsKeyModal();
        // After key saved, try again
        const origPending = pendingServiceKey;
        const checkInterval = setInterval(() => {
            if (document.getElementById('key-modal').style.display === 'none') {
                clearInterval(checkInterval);
                if (getOrsApiKey()) {
                    _doEnterEditMode(isNewRoute);
                }
            }
        }, 200);
        return;
    }
    _doEnterEditMode(isNewRoute);
};

function _doEnterEditMode(isNewRoute) {
    const t = translations[currentLang];
    editState.enabled = true;
    editState.routingEnabled = document.getElementById('routing-toggle').checked;
    editState.undoStack = [];
    editState.redoStack = [];
    editState.routeCache.clear();
    editState.waypointMode = false;
    _editIdCounter = 0;

    if (isNewRoute) {
        // New route: empty state
        editState.anchors = [];
        editState.segments = [];
        editState.waypoints = [];
        editState.gpxName = '';
        editState.activityType = 'hiking';
        // Clear existing GPX display
        if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
        gpxTrackData = null;
    } else {
        // Edit existing GPX
        editState.originalGpxData = gpxTrackData ? JSON.parse(JSON.stringify(gpxTrackData)) : null;
        editState.gpxName = (gpxTrackData && gpxTrackData._gpxName) || '';
        editState.activityType = (gpxTrackData && gpxTrackData._gpxType) || document.getElementById('activity-select').value || 'hiking';
        generateAnchorsFromGpx();
        // Remove the view-mode layer
        if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
    }

    // Show edit toolbar, hide view-mode buttons
    document.getElementById('edit-toolbar').classList.remove('hidden');
    document.getElementById('gpx-btn').style.display = 'none';
    document.getElementById('new-route-btn').style.display = 'none';
    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    const editBtn = document.getElementById('gpx-edit-btn');
    if (editBtn) editBtn.style.display = 'none';

    // Set UI values
    document.getElementById('gpx-name-input').value = editState.gpxName;
    document.getElementById('activity-select').value = editState.activityType;
    document.getElementById('routing-toggle').checked = editState.routingEnabled;

    // Add crosshair cursor to map
    map.getContainer().classList.add('edit-mode-cursor');

    // Register map click handler
    map.on('click', onEditMapClick);

    updateUndoRedoButtons();
    rebuildEditLayer();
    renderSavedRoutesList();
    statusDiv.textContent = t.status_edit_mode;
}

window.exitEditMode = function (discard) {
    const t = translations[currentLang];

    if (discard && editState.undoStack.length > 0) {
        if (!confirm(t.confirm_cancel_edit)) return;
    }

    // Remove edit layers
    if (editLayer) { map.removeLayer(editLayer); editLayer = null; }
    removeGhostAnchor();

    editState.enabled = false;
    editState.waypointMode = false;
    map.getContainer().classList.remove('edit-mode-cursor');
    map.off('click', onEditMapClick);

    if (discard) {
        // Restore original data
        gpxTrackData = editState.originalGpxData;
    } else {
        // Keep edited data — already synced via syncEditToGpxData
        syncEditToGpxData();
    }

    // Hide edit toolbar, show view-mode buttons
    document.getElementById('edit-toolbar').classList.add('hidden');
    document.getElementById('gpx-btn').style.display = '';
    document.getElementById('new-route-btn').style.display = '';

    if (gpxTrackData && (gpxTrackData.segments.length > 0 || gpxTrackData.waypoints.length > 0)) {
        const clearBtn = document.getElementById('gpx-clear-btn');
        if (clearBtn) clearBtn.style.display = 'block';
        const editBtn = document.getElementById('gpx-edit-btn');
        if (editBtn) editBtn.style.display = 'block';
        rebuildGpxLayer();
        updateGpxTrackInfo();
        showElevationProfile();
    } else {
        hideElevationProfile();
        const infoDiv = document.getElementById('gpx-track-info');
        if (infoDiv) { infoDiv.style.display = 'none'; infoDiv.innerHTML = ''; }
    }

    // Clean up edit state
    editState.anchors = [];
    editState.segments = [];
    editState.waypoints = [];
    editState.undoStack = [];
    editState.redoStack = [];
    editState.originalGpxData = null;
    editAnchorMarkers = [];
    editWaypointMarkers = [];

    statusDiv.textContent = t.status_ready;
};

// ==========================================
// 5l. GPX EXPORT & LOCALSTORAGE SAVE
// ==========================================

function generateGpxXml() {
    const name = editState.gpxName || 'Route';
    const activity = editState.activityType || 'hiking';
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<gpx version="1.1" creator="Topo GPX Viewer"\n`;
    xml += `  xmlns="http://www.topografix.com/GPX/1/1"\n`;
    xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
    xml += `  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n`;
    xml += `  <metadata>\n    <name>${escapeXml(name)}</name>\n    <time>${new Date().toISOString()}</time>\n  </metadata>\n`;

    // Waypoints
    for (const wp of editState.waypoints) {
        xml += `  <wpt lat="${wp.lat}" lon="${wp.lon}">\n`;
        if (wp.name) xml += `    <name>${escapeXml(wp.name)}</name>\n`;
        if (wp.desc) xml += `    <desc>${escapeXml(wp.desc)}</desc>\n`;
        xml += `  </wpt>\n`;
    }

    // Track
    xml += `  <trk>\n    <name>${escapeXml(name)}</name>\n    <type>${escapeXml(activity)}</type>\n    <trkseg>\n`;
    for (const seg of editState.segments) {
        for (const p of seg.points) {
            xml += `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">`;
            if (p.ele !== null && p.ele !== undefined) xml += `<ele>${p.ele.toFixed(1)}</ele>`;
            xml += `</trkpt>\n`;
        }
    }
    xml += `    </trkseg>\n  </trk>\n</gpx>\n`;
    return xml;
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function exportGpxFile() {
    const xml = generateGpxXml();
    const blob = new Blob([xml], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (editState.gpxName || 'route').replace(/[^a-zA-Z0-9_\-\s]/g, '') + '.gpx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function saveRouteToStorage() {
    const t = translations[currentLang];
    const route = {
        gpxName: editState.gpxName || 'Unnamed Route',
        activityType: editState.activityType,
        anchors: editState.anchors,
        segments: editState.segments,
        waypoints: editState.waypoints,
        timestamp: Date.now()
    };
    try {
        const saved = JSON.parse(localStorage.getItem('gpxv_saved_routes') || '[]');
        saved.push(route);
        // Cap at 10 routes
        while (saved.length > 10) saved.shift();
        localStorage.setItem('gpxv_saved_routes', JSON.stringify(saved));
    } catch (e) {
        statusDiv.textContent = t.status_save_storage_full;
        return false;
    }
    return true;
}

window.saveAndExportGpx = function () {
    const t = translations[currentLang];
    // Update name/activity from UI
    editState.gpxName = document.getElementById('gpx-name-input').value.trim();
    editState.activityType = document.getElementById('activity-select').value;

    exportGpxFile();
    saveRouteToStorage();
    renderSavedRoutesList();
    statusDiv.textContent = t.status_route_exported;
};

function getSavedRoutes() {
    try {
        return JSON.parse(localStorage.getItem('gpxv_saved_routes') || '[]');
    } catch { return []; }
}

function renderSavedRoutesList() {
    const container = document.getElementById('saved-routes-list');
    if (!container) return;
    const routes = getSavedRoutes();
    const t = translations[currentLang];
    if (routes.length === 0) {
        container.innerHTML = `<div style="font-size:11px;color:#999;padding:4px;">${t.no_saved_routes}</div>`;
        return;
    }
    let html = '';
    routes.forEach((r, i) => {
        const name = r.gpxName || 'Unnamed';
        const date = new Date(r.timestamp).toLocaleDateString();
        html += `<div class="saved-route-item">
            <span class="saved-route-name" title="${escapeXml(name)} (${date})">${escapeXml(name)}</span>
            <button class="btn-undo-redo" onclick="loadSavedRoute(${i})">${t.btn_load_saved}</button>
            <button class="btn-undo-redo" onclick="deleteSavedRoute(${i})" style="color:#dc3545;">${t.btn_delete_saved}</button>
        </div>`;
    });
    container.innerHTML = html;
}

window.loadSavedRoute = function (index) {
    const routes = getSavedRoutes();
    if (index < 0 || index >= routes.length) return;
    const route = routes[index];

    // Ensure we're in edit mode
    if (!editState.enabled) {
        _doEnterEditMode(true);
    }

    pushUndo();
    editState.gpxName = route.gpxName || '';
    editState.activityType = route.activityType || 'hiking';
    editState.anchors = route.anchors || [];
    editState.segments = route.segments || [];
    editState.waypoints = route.waypoints || [];

    document.getElementById('gpx-name-input').value = editState.gpxName;
    document.getElementById('activity-select').value = editState.activityType;

    // Fix IDs to avoid collisions
    _editIdCounter = 0;
    editState.anchors.forEach(a => { a.id = generateEditId(); });
    editState.waypoints.forEach(w => { w.id = generateEditId(); });
    // Rebuild segment fromId/toId
    for (let i = 0; i < editState.segments.length; i++) {
        if (editState.anchors[i]) editState.segments[i].fromId = editState.anchors[i].id;
        if (editState.anchors[i + 1]) editState.segments[i].toId = editState.anchors[i + 1].id;
    }

    syncEditToGpxData();
    rebuildEditLayer();
    statusDiv.textContent = translations[currentLang].status_edit_mode;
};

window.deleteSavedRoute = function (index) {
    const routes = getSavedRoutes();
    if (index < 0 || index >= routes.length) return;
    routes.splice(index, 1);
    localStorage.setItem('gpxv_saved_routes', JSON.stringify(routes));
    renderSavedRoutesList();
};

// ==========================================
// 5m. EDIT MODE — EVENT LISTENERS
// ==========================================

// Routing toggle listener
document.getElementById('routing-toggle').addEventListener('change', function () {
    editState.routingEnabled = this.checked;
    if (editState.enabled && editState.anchors.length > 1) {
        rerouteAllSegments();
    }
});

// Activity type change listener
document.getElementById('activity-select').addEventListener('change', function () {
    editState.activityType = this.value;
    if (editState.enabled && editState.routingEnabled && editState.anchors.length > 1) {
        pushUndo();
        rerouteAllSegments();
    }
});

// GPX name input listener
document.getElementById('gpx-name-input').addEventListener('input', function () {
    editState.gpxName = this.value.trim();
});

// ==========================================
// 6. START LOGIC (Event Listeners & Init)
// ==========================================

if (searchInput) searchInput.addEventListener("keypress", (e) => { if (e.key === "Enter") searchLocation(); });

// Map Events
map.on('zoomend', () => {
    updateUI();
    if (editState.enabled) { rebuildEditLayer(); }
    else { rebuildGpxLayer(); }
});
map.on('move', () => { updateUI(); });
map.on('moveend', () => {
    const center = map.getCenter();
    localStorage.setItem('gpxv_lat', center.lat);
    localStorage.setItem('gpxv_lng', center.lng);
    localStorage.setItem('gpxv_zoom', map.getZoom());
});

// Minimize controls on mobile when clicking the map (only when not in edit mode)
map.on('click', (e) => {
    if (editState.enabled) return; // handled by onEditMapClick
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
handleLayerChange(savedLayer);
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
