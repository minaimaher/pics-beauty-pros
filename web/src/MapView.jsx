import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function pinIcon(m, active) {
  const face = m.avatar
    ? `<img src="${escape(m.avatar)}" alt="" data-fallback="1" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${escape(m.initials)}'}))">`
    : `<span>${escape(m.initials)}</span>`;
  return L.divIcon({
    className: 'pbp-pin' + (active ? ' active' : ''),
    html: `<div class="pin-face">${face}</div>${m.label ? `<div class="pin-label">${escape(m.label)}</div>` : ''}`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -24]
  });
}

// Leaflet map with vendor pins. `markers`: [{ id, lat, lng, avatar, initials, label, popup: (el) => void }].
// `onPick(lat, lng)` makes the map clickable for choosing a location; `circleKm` draws a service area.
export function MapView({ markers = [], center, zoom = 11, fit = true, activeId, onPick, circleKm, height = 420, className = '' }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const circle = useRef(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    map.current = L.map(el.current, { scrollWheelZoom: false, zoomControl: true }).setView(center || [24.7136, 46.6753], zoom);
    L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19, subdomains: 'abcd' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    map.current.on('click', (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    // Price tags only once pins are far enough apart to read them.
    const labels = () => el.current?.classList.toggle('labels-off', map.current.getZoom() < 12);
    map.current.on('zoomend', labels);
    labels();
    map.current.on('focus', () => map.current.scrollWheelZoom.enable());
    map.current.on('blur', () => map.current.scrollWheelZoom.disable());
    return () => map.current.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layer.current.clearLayers();
    const pts = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
    for (const m of pts) {
      const mk = L.marker([m.lat, m.lng], { icon: pinIcon(m, m.id === activeId), riseOnHover: true, zIndexOffset: m.id === activeId ? 1000 : 0 });
      if (m.popup) {
        const div = document.createElement('div');
        m.popup(div);
        mk.bindPopup(div, { minWidth: 220, maxWidth: 260, className: 'pbp-popup' });
      }
      mk.addTo(layer.current);
    }
    if (fit && pts.length > 1) map.current.fitBounds(L.latLngBounds(pts.map((m) => [m.lat, m.lng])), { padding: [40, 40], maxZoom: 13 });
    else if (pts.length === 1) map.current.setView([pts[0].lat, pts[0].lng], Math.max(zoom, 12));
    else if (center) map.current.setView(center, zoom);
  }, [markers, activeId, fit, center, zoom]);

  useEffect(() => {
    circle.current?.remove();
    circle.current = null;
    const m = markers[0];
    if (circleKm && m) {
      circle.current = L.circle([m.lat, m.lng], { radius: circleKm * 1000, color: '#b7613f', weight: 1.5, fillColor: '#e8b4a0', fillOpacity: 0.15 }).addTo(map.current);
    }
  }, [circleKm, markers]);

  return <div ref={el} dir="ltr" className={'map ' + className} style={{ height }} role="region" aria-label="Map" />;
}
