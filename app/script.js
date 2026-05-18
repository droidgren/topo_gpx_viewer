// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const APP_VERSION = "0.3";

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
const API_BASE = '/api';
// Toggle this when deploying with or without the FastAPI backend.
const BACKEND_AVAILABLE = false;

function isBackendEnabled() {
    return BACKEND_AVAILABLE;
}

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
let currentSharedGpxId = null;
let currentGpxFilename = null;
let currentGpxShareUrl = null;
let uploadedGpxFiles = [];
let uploadedGpxListState = 'idle';

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
        if (document.getElementById('gpx-modal-title')) document.getElementById('gpx-modal-title').textContent = t.modal_gpx_title || t.btn_gpx;
        if (document.getElementById('gpx-modal-desc')) {
            document.getElementById('gpx-modal-desc').textContent = isBackendEnabled()
                ? (t.modal_gpx_desc || '')
                : (t.modal_gpx_desc_local || t.modal_gpx_desc || '');
        }
        if (document.getElementById('gpx-upload-btn')) {
            document.getElementById('gpx-upload-btn').textContent = isBackendEnabled()
                ? (t.btn_upload_gpx || 'Upload')
                : (t.btn_open_local_gpx || t.btn_upload_gpx || 'Open GPX file');
        }
        if (document.getElementById('gpx-modal-close')) document.getElementById('gpx-modal-close').textContent = t.btn_close;
        if (document.getElementById('gpx-clear-btn')) document.getElementById('gpx-clear-btn').textContent = t.btn_gpx_clear;
        const shareMapBtn = document.getElementById('share-map-btn');
        if (shareMapBtn) {
            const shareLabel = t.btn_share_map_title || t.btn_share_map || 'Share Map View';
            shareMapBtn.title = shareLabel;
            shareMapBtn.setAttribute('aria-label', shareLabel);
        }
        if (document.getElementById('uploaded-gpx-title')) {
            document.getElementById('uploaded-gpx-title').textContent = isBackendEnabled()
                ? t.uploaded_gpx_title
                : (t.uploaded_gpx_title_local || t.uploaded_gpx_title);
        }
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

        renderUploadedFiles();
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

function showGpxModal() {
    const modal = document.getElementById('gpx-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    if (isBackendEnabled()) {
        refreshUploadedFiles();
    } else {
        uploadedGpxFiles = [];
        uploadedGpxListState = 'disabled';
        renderUploadedFiles();
    }
}

function closeGpxModal() {
    const modal = document.getElementById('gpx-modal');
    if (modal) modal.style.display = 'none';
}

window.showGpxModal = showGpxModal;
window.closeGpxModal = closeGpxModal;

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
    currentSharedGpxId = null;
    currentGpxFilename = null;
    currentGpxShareUrl = null;
    const params = new URLSearchParams(location.search);
    params.delete('gpx');
    const queryString = params.toString();
    history.replaceState(null, '', location.pathname + (queryString ? '?' + queryString : '') + location.hash);
    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    const infoDiv = document.getElementById('gpx-track-info');
    if (infoDiv) { infoDiv.style.display = 'none'; infoDiv.innerHTML = ''; }
    hideElevationProfile();
    statusDiv.textContent = translations[currentLang].status_gpx_cleared;
};

function getCurrentMapHash() {
    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());
    const lat = center.lat.toFixed(5);
    const lng = center.lng.toFixed(5);
    const currentLayerKey = localStorage.getItem('gpxv_layer') || 'opentopo';
    return '#map=' + zoom + '/' + lat + '/' + lng + '/' + currentLayerKey;
}

function getCurrentShareLink() {
    if (isBackendEnabled() && currentSharedGpxId) {
        const params = new URLSearchParams();
        params.set('gpx', currentSharedGpxId);
        return location.origin + location.pathname + '?' + params.toString();
    }
    return location.origin + location.pathname + getCurrentMapHash();
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);

    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    let didCopy = false;
    try {
        didCopy = document.execCommand('copy');
    } catch (err) {
        didCopy = false;
    }

    document.body.removeChild(textArea);
    if (selection) {
        selection.removeAllRanges();
        if (previousRange) {
            selection.addRange(previousRange);
        }
    }
    return didCopy;
}

async function copyTextToClipboard(text, successMessage, errorMessage) {
    let didCopy = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            didCopy = true;
        } catch (err) {
            didCopy = fallbackCopyTextToClipboard(text);
        }
    } else {
        didCopy = fallbackCopyTextToClipboard(text);
    }

    if (didCopy) {
        statusDiv.textContent = successMessage;
        return;
    }

    window.prompt('Copy this link:', text);
    statusDiv.textContent = errorMessage;
}

window.generateShareLink = function () {
    const t = translations[currentLang];
    const link = getCurrentShareLink();
    const successMessage = isBackendEnabled() && currentSharedGpxId
        ? (t.status_gpx_share_copied || t.status_link_copied || 'Link copied to clipboard.')
        : (t.status_link_copied || 'Link copied to clipboard.');
    copyTextToClipboard(
        link,
        successMessage,
        t.status_clipboard_error || 'Could not copy link.'
    );
};

window.copyUploadedGpxLink = function (gpxId) {
    const t = translations[currentLang];
    if (!isBackendEnabled()) {
        return copyTextToClipboard(
            getCurrentShareLink(),
            t.status_link_copied || 'Link copied to clipboard.',
            t.status_clipboard_error || 'Could not copy link.'
        );
    }
    const params = new URLSearchParams();
    params.set('gpx', gpxId);
    const link = location.origin + location.pathname + '?' + params.toString();
    copyTextToClipboard(
        link,
        t.status_gpx_share_copied || t.status_link_copied || 'Link copied to clipboard.',
        t.status_clipboard_error || 'Could not copy link.'
    );
};

window.deleteUploadedGpx = async function (gpxId) {
    const t = translations[currentLang];
    if (!gpxId) return;
    if (!isBackendEnabled()) {
        statusDiv.textContent = t.status_backend_disabled || 'Backend sharing is disabled in this build.';
        return;
    }

    const fileEntry = uploadedGpxFiles.find(file => file.id === gpxId);
    const filename = fileEntry && fileEntry.filename ? fileEntry.filename : 'GPX file';
    const confirmMessage = (t.confirm_delete_uploaded_gpx || 'Delete "{name}"?').replace('{name}', filename);
    if (!window.confirm(confirmMessage)) {
        return;
    }

    statusDiv.textContent = t.status_deleting_gpx || t.status_loading || 'Loading data...';
    try {
        const response = await fetch(API_BASE + '/files/' + encodeURIComponent(gpxId), {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('Failed to delete GPX');
        }

        if (currentSharedGpxId === gpxId) {
            window.clearGpxRoute();
        }

        await refreshUploadedFiles();
        statusDiv.textContent = (t.status_gpx_deleted || 'GPX file deleted.').replace('{name}', filename);
    } catch (err) {
        statusDiv.textContent = t.status_delete_gpx_error || 'Could not delete the GPX file.';
    }
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

function parseGpxText(gpxText) {
    const t = translations[currentLang];
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxText, 'application/xml');
    if (doc.querySelector('parsererror')) {
        throw new Error(t.status_gpx_error || 'Failed to load GPX file.');
    }

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
        throw new Error(t.status_gpx_empty || 'No track data found in GPX file.');
    }

    return {
        segments: allSegments,
        waypoints,
        totalPoints,
        stats: computeTrackStats(allSegments)
    };
}

function fitGpxBounds(allSegments, waypoints) {
    if (!gpxLayer) return;
    const allCoords = [];
    allSegments.forEach(segment => segment.forEach(point => allCoords.push([point.lat, point.lon])));
    waypoints.forEach(point => allCoords.push([point.lat, point.lon]));
    if (allCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allCoords).pad(0.1));
    }
}

function setActiveGpxSource(source) {
    currentSharedGpxId = isBackendEnabled() && source && source.id ? source.id : null;
    currentGpxFilename = source && source.filename ? source.filename : null;
    currentGpxShareUrl = isBackendEnabled() && source && source.shareUrl ? source.shareUrl : null;

    const params = new URLSearchParams(location.search);
    if (isBackendEnabled() && currentSharedGpxId) {
        params.set('gpx', currentSharedGpxId);
    } else {
        params.delete('gpx');
    }
    const queryString = params.toString();
    history.replaceState(null, '', location.pathname + (queryString ? '?' + queryString : '') + location.hash);
}

function applyParsedGpxData(parsedGpx, options = {}) {
    const t = translations[currentLang];
    if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
    gpxTrackData = {
        segments: parsedGpx.segments,
        waypoints: parsedGpx.waypoints,
        ...parsedGpx.stats
    };
    setActiveGpxSource(options.source || null);

    rebuildGpxLayer();
    updateGpxTrackInfo();
    showElevationProfile();

    if (!options.skipFitBounds) {
        fitGpxBounds(parsedGpx.segments, parsedGpx.waypoints);
    }

    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = 'block';

    const statusMessage = options.statusMessage || t.status_gpx_loaded || 'GPX route loaded ({n} points).';
    statusDiv.textContent = statusMessage.replace('{n}', parsedGpx.totalPoints);
}

function normalizeUploadedFileEntry(fileEntry) {
    if (typeof fileEntry === 'string') {
        return {
            id: fileEntry,
            filename: fileEntry,
            shareUrl: null,
            uploadedAt: null
        };
    }
    return {
        id: fileEntry.id || fileEntry.filename,
        filename: fileEntry.filename || fileEntry.name || fileEntry.id || 'GPX file',
        shareUrl: fileEntry.share_url || fileEntry.shareUrl || null,
        uploadedAt: fileEntry.uploaded_at || fileEntry.uploadedAt || null
    };
}

function renderUploadedFiles() {
    const listEl = document.getElementById('uploaded-gpx-list');
    const emptyEl = document.getElementById('uploaded-gpx-empty');
    if (!listEl || !emptyEl) return;

    const t = translations[currentLang];
    listEl.innerHTML = '';
    if (!isBackendEnabled() || uploadedGpxListState === 'disabled') {
        emptyEl.style.display = '';
        emptyEl.textContent = t.uploaded_gpx_unavailable || 'Backend upload and sharing are disabled in this build.';
        return;
    }

    if (uploadedGpxListState === 'loading') {
        emptyEl.style.display = '';
        emptyEl.textContent = t.uploaded_gpx_loading || 'Loading uploaded GPX files...';
        return;
    }

    if (uploadedGpxListState === 'error') {
        emptyEl.style.display = '';
        emptyEl.textContent = t.uploaded_gpx_error || 'Could not load uploaded GPX files.';
        return;
    }

    if (!uploadedGpxFiles.length) {
        emptyEl.style.display = '';
        emptyEl.textContent = t.uploaded_gpx_empty || 'No uploaded GPX files yet.';
        return;
    }

    emptyEl.style.display = 'none';
    uploadedGpxFiles.forEach(fileEntry => {
        const row = document.createElement('div');
        row.className = 'uploaded-gpx-item';

        const meta = document.createElement('div');
        meta.className = 'uploaded-gpx-meta';

        const name = document.createElement('span');
        name.className = 'uploaded-gpx-name';
        name.textContent = fileEntry.filename;
        meta.appendChild(name);

        if (fileEntry.uploadedAt) {
            const stamp = document.createElement('span');
            stamp.className = 'uploaded-gpx-date';
            const uploadedDate = new Date(fileEntry.uploadedAt);
            stamp.textContent = Number.isNaN(uploadedDate.getTime())
                ? fileEntry.uploadedAt
                : uploadedDate.toLocaleString();
            meta.appendChild(stamp);
        }

        const actions = document.createElement('div');
        actions.className = 'uploaded-gpx-actions';

        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'secondary-btn';
        openBtn.textContent = t.btn_open_uploaded_gpx || 'Open';
        openBtn.addEventListener('click', async () => {
            const didLoad = await loadSharedGpxById(fileEntry.id, { filename: fileEntry.filename });
            if (didLoad) {
                closeGpxModal();
            }
        });
        actions.appendChild(openBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'danger-btn';
        deleteBtn.textContent = t.btn_delete_uploaded_gpx || 'Delete';
        deleteBtn.addEventListener('click', () => {
            window.deleteUploadedGpx(fileEntry.id);
        });
        actions.appendChild(deleteBtn);

        row.appendChild(meta);
        row.appendChild(actions);
        listEl.appendChild(row);
    });
}

async function refreshUploadedFiles() {
    if (!isBackendEnabled()) {
        uploadedGpxFiles = [];
        uploadedGpxListState = 'disabled';
        renderUploadedFiles();
        return;
    }

    uploadedGpxListState = 'loading';
    renderUploadedFiles();
    try {
        const response = await fetch(API_BASE + '/files', {
            cache: 'no-store',
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch uploaded GPX files');
        }
        const payload = await response.json();
        const files = Array.isArray(payload.files) ? payload.files : [];
        uploadedGpxFiles = files.map(normalizeUploadedFileEntry).filter(fileEntry => fileEntry.id);
        uploadedGpxListState = 'ready';
        renderUploadedFiles();
    } catch (err) {
        uploadedGpxFiles = [];
        uploadedGpxListState = 'error';
        renderUploadedFiles();
    }
}

async function loadSharedGpxById(gpxId, options = {}) {
    const t = translations[currentLang];
    if (!gpxId) return;
    if (!isBackendEnabled()) {
        statusDiv.textContent = t.status_shared_gpx_backend_disabled || t.status_backend_disabled || 'Backend sharing is disabled in this build.';
        return false;
    }
    statusDiv.textContent = t.status_loading_shared_gpx || t.status_loading || 'Loading data...';
    try {
        const response = await fetch(API_BASE + '/files/' + encodeURIComponent(gpxId) + '/raw', {
            cache: 'no-store',
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('Failed to load shared GPX');
        }
        const gpxText = await response.text();
        const parsedGpx = parseGpxText(gpxText);
        applyParsedGpxData(parsedGpx, {
            source: {
                id: gpxId,
                filename: options.filename || currentGpxFilename || gpxId,
                shareUrl: options.shareUrl || null
            },
            skipFitBounds: options.skipFitBounds,
            statusMessage: t.status_shared_gpx_loaded || t.status_gpx_loaded || 'GPX route loaded ({n} points).'
        });
        const params = new URLSearchParams(location.search);
        params.set('gpx', gpxId);
        history.replaceState(null, '', location.pathname + '?' + params.toString() + location.hash);
        return true;
    } catch (err) {
        statusDiv.textContent = t.status_shared_gpx_error || t.status_gpx_error || 'Failed to load GPX file.';
        return false;
    }
}

async function uploadGpxFile(file) {
    if (!isBackendEnabled()) {
        return null;
    }

    const t = translations[currentLang];
    const formData = new FormData();
    formData.append('file', file);
    statusDiv.textContent = t.status_uploading_gpx || t.status_loading || 'Loading data...';

    const response = await fetch(API_BASE + '/upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    });
    if (!response.ok) {
        throw new Error('Failed to upload GPX');
    }

    const payload = await response.json();
    return {
        id: payload.id || payload.filename,
        filename: payload.filename || file.name,
        shareUrl: payload.share_url || payload.shareUrl || null
    };
}

async function handleLocalFileSelection(file) {
    const t = translations[currentLang];
    if (!file) return;
    try {
        const gpxText = await file.text();
        const parsedGpx = parseGpxText(gpxText);
        let uploadResult = null;
        if (isBackendEnabled()) {
            try {
                uploadResult = await uploadGpxFile(file);
            } catch (uploadErr) {
                uploadResult = null;
            }
        }
        applyParsedGpxData(parsedGpx, {
            source: uploadResult,
            statusMessage: uploadResult
                ? (t.status_gpx_uploaded || t.status_gpx_loaded || 'GPX route loaded ({n} points).')
                : (isBackendEnabled()
                    ? (t.status_gpx_loaded_local || t.status_gpx_loaded || 'GPX route loaded ({n} points).')
                    : (t.status_gpx_loaded_local_only || t.status_gpx_loaded || 'GPX route loaded ({n} points).'))
        });
        if (uploadResult) {
            await refreshUploadedFiles();
        }
    } catch (err) {
        statusDiv.textContent = t.status_gpx_error || 'Failed to load GPX file.';
    }
}

document.getElementById('gpx-file-input').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    e.target.value = '';
    await handleLocalFileSelection(file);
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
    { targetSelector: '#share-map-btn', titleKey: 'tutorial_share_title', textKey: 'tutorial_share_text' },
    { targetSelector: '.info-btn', titleKey: 'tutorial_info_title', textKey: 'tutorial_info_text' },
    { targetSelector: '.toggle-btn', titleKey: 'tutorial_minimize_title', textKey: 'tutorial_minimize_text' },
    { targetSelector: '#layerSelect', titleKey: 'tutorial_layers_title', textKey: 'tutorial_layers_text' },
    { targetSelector: '.search-group', titleKey: 'tutorial_search_title', textKey: 'tutorial_search_text' },
    { targetSelector: '#section-routes-title', targetSelectorEnd: '#gpx-btn', titleKey: 'tutorial_routes_title', textKey: 'tutorial_routes_text' },
    { targetSelector: null, titleKey: 'tutorial_tips_title', textKey: 'tutorial_tips_text' }
];
const tutorialExpandStepIndex = tutorialSteps.findIndex(step => step.titleKey === 'tutorial_layers_title');
const tutorialCollapseAgainStepIndex = tutorialSteps.findIndex(step => step.titleKey === 'tutorial_tips_title');

function startTutorial() {
    if (controls && !controls.classList.contains('minimized')) {
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

    if (controls && tutorialExpandStepIndex !== -1 && tutorialCollapseAgainStepIndex !== -1) {
        const shouldBeExpanded = tutorialStep >= tutorialExpandStepIndex && tutorialStep < tutorialCollapseAgainStepIndex;
        const isMinimized = controls.classList.contains('minimized');
        if (shouldBeExpanded && isMinimized) {
            toggleControls();
        } else if (!shouldBeExpanded && !isMinimized) {
            toggleControls();
        }
    }

    titleEl.textContent = t[step.titleKey] || '';
    textEl.textContent = t[step.textKey] || '';
    progressEl.textContent = (tutorialStep + 1) + ' / ' + tutorialSteps.length;

    prevBtn.textContent = t.tutorial_btn_prev || 'Back';
    nextBtn.textContent = tutorialStep === tutorialSteps.length - 1 ? (t.tutorial_btn_finish || 'Finish') : (t.tutorial_btn_next || 'Next');
    prevBtn.style.visibility = tutorialStep === 0 ? 'hidden' : 'visible';

    const PAD = 8;
    if (step.targetSelector) {
        const startEl = document.querySelector(step.targetSelector);
        if (startEl) {
            let rect = startEl.getBoundingClientRect();
            if (step.targetSelectorEnd) {
                const endEl = document.querySelector(step.targetSelectorEnd);
                if (endEl) {
                    const endRect = endEl.getBoundingClientRect();
                    const left = Math.min(rect.left, endRect.left);
                    const top = Math.min(rect.top, endRect.top);
                    const right = Math.max(rect.right, endRect.right);
                    const bottom = Math.max(rect.bottom, endRect.bottom);
                    rect = {
                        left,
                        top,
                        right,
                        bottom,
                        width: right - left,
                        height: bottom - top
                    };
                }
            }
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
let elevationProfileMinimized = true;
let elevationProfileMarker = null;
let elevationProfileRedrawFrame = null;

function scheduleElevationProfileRedraw() {
    if (elevationProfileRedrawFrame !== null) {
        cancelAnimationFrame(elevationProfileRedrawFrame);
        elevationProfileRedrawFrame = null;
    }

    elevationProfileRedrawFrame = requestAnimationFrame(() => {
        elevationProfileRedrawFrame = requestAnimationFrame(() => {
            elevationProfileRedrawFrame = null;
            if (elevationProfileData && !elevationProfileMinimized) {
                drawElevationProfile();
            }
        });
    });
}

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

    const body = document.getElementById('elevation-profile-body');
    const rect = body ? body.getBoundingClientRect() : container.getBoundingClientRect();
    if (rect.height > 0) {
        return rect.height;
    }

    if (elevationProfileMinimized) return 26;
    return window.innerWidth >= 600 ? 150 : 130;
}

function adjustMapControlsForElevation() {
    const h = getElevationBarHeight();
    const bottomRight = document.querySelector('.leaflet-bottom.leaflet-right');
    if (bottomRight) {
        bottomRight.style.bottom = h > 0
            ? `calc(${Math.ceil(h)}px + env(safe-area-inset-bottom, 0px))`
            : '';
    }
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
    scheduleElevationProfileRedraw();
    updateElevationProfileInfo(null);
    adjustMapControlsForElevation();
}

function hideElevationProfile() {
    if (elevationProfileRedrawFrame !== null) {
        cancelAnimationFrame(elevationProfileRedrawFrame);
        elevationProfileRedrawFrame = null;
    }
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
        scheduleElevationProfileRedraw();
    }
    adjustMapControlsForElevation();
}

function drawElevationProfile() {
    const canvas = document.getElementById('elevation-canvas');
    if (!canvas || !elevationProfileData || elevationProfileData.length < 2) return;

    const body = document.getElementById('elevation-profile-body');
    if (!body) return;
    const rect = body.getBoundingClientRect();
    if (rect.width <= 80 || rect.height <= 40) {
        if (!elevationProfileMinimized) {
            scheduleElevationProfileRedraw();
        }
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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

    const elevationProfileBody = document.getElementById('elevation-profile-body');
    if (elevationProfileBody && 'ResizeObserver' in window) {
        let lastBodyWidth = 0;
        let lastBodyHeight = 0;
        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry || !elevationProfileData) return;

            const width = entry.contentRect.width;
            const height = entry.contentRect.height;
            if (Math.abs(width - lastBodyWidth) < 0.5 && Math.abs(height - lastBodyHeight) < 0.5) {
                return;
            }

            lastBodyWidth = width;
            lastBodyHeight = height;
            adjustMapControlsForElevation();
            if (!elevationProfileMinimized) {
                scheduleElevationProfileRedraw();
            }
        });
        resizeObserver.observe(elevationProfileBody);
    }
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

// Minimize controls on mobile when clicking the map
map.on('click', () => {
    if (window.innerWidth <= 600 && !isControlsMinimized) {
        toggleControls();
    }
});

function applyMapHashParams() {
    const hash = location.hash.replace(/^#/, '');
    if (!hash) return false;
    const match = hash.match(/^map=(.+)/);
    if (!match) return false;
    const parts = match[1].split('/');
    if (parts.length < 3) return false;
    const zoom = parseInt(parts[0]);
    const lat = parseFloat(parts[1]);
    const lng = parseFloat(parts[2]);
    const layer = parts[3] || null;
    if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)
        && zoom >= 1 && zoom <= 20
        && lat >= -90 && lat <= 90
        && lng >= -180 && lng <= 180) {
        map.setView([lat, lng], zoom);
        if (layer && layers[layer]) {
            handleLayerChange(layer);
            if (layerSelect) layerSelect.value = layer;
        }
        return true;
    }
    return false;
}

async function initializeApp() {
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
    if (window.innerWidth <= 600 && !isControlsMinimized) {
        toggleControls();
    }

    const params = new URLSearchParams(location.search);
    const sharedGpxId = params.get('gpx');
    const hasMapHash = location.hash.startsWith('#map=');
    if (sharedGpxId) {
        if (isBackendEnabled()) {
            await loadSharedGpxById(sharedGpxId, { skipFitBounds: hasMapHash });
        } else {
            params.delete('gpx');
            const queryString = params.toString();
            history.replaceState(null, '', location.pathname + (queryString ? '?' + queryString : '') + location.hash);
            statusDiv.textContent = translations[currentLang].status_shared_gpx_backend_disabled
                || translations[currentLang].status_backend_disabled
                || 'Backend sharing is disabled in this build.';
        }
    }
    if (hasMapHash) {
        applyMapHashParams();
    }
}

initializeApp();

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
