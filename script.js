// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const APP_VERSION = "0.1";

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
        maxZoom: 17
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
    }
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
    if (editKeyBtn) editKeyBtn.style.display = lockedServices[layerKey] ? '' : 'none';
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
            if (editKeyBtn) editKeyBtn.style.display = '';
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
    navigator.geolocation.getCurrentPosition(
        (pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 13); statusDiv.textContent = t.status_done; },
        () => statusDiv.textContent = t.status_gps_error
    );
}

window.clearGpxRoute = function () {
    if (gpxLayer) { map.removeLayer(gpxLayer); gpxLayer = null; }
    gpxTrackData = null;
    const clearBtn = document.getElementById('gpx-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    const infoDiv = document.getElementById('gpx-track-info');
    if (infoDiv) { infoDiv.style.display = 'none'; infoDiv.innerHTML = ''; }
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

            rebuildGpxLayer();
            updateGpxTrackInfo();

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
document.getElementById('gpxTrackColor').addEventListener('input', function () { rebuildGpxLayer(); });
document.getElementById('gpxTrackWidth').addEventListener('input', function () {
    document.getElementById('gpxTrackWidthVal').textContent = this.value;
    rebuildGpxLayer();
});
document.getElementById('gpxShowKmLabels').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxColorBySlope').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxShowWaypoints').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('gpxShowMinMax').addEventListener('change', function () { rebuildGpxLayer(); });
document.getElementById('distanceUnit').addEventListener('change', function () {
    localStorage.setItem('gpxv_distance_unit', this.value);
    rebuildGpxLayer();
    updateGpxTrackInfo();
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

// Auto-start tutorial for new visitors
if (!localStorage.getItem('gpxv_tutorial_done')) {
    setTimeout(() => startTutorial(), 1000);
}
