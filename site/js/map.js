/* 3D location map. Basemap from OpenFreeMap (positron); the Zarea tower and the institutions around it come from
   data/landmarks.geojson (building outlines baked from OpenStreetMap), so the page never waits on a live Overpass call.
   Neighbouring buildings are extruded from the vector tiles and stay interactive. */
(function () {
  'use strict';
  const I = window.ZareaI18n, t = I.t;
  const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
  const ASSET = '#C4A056';
  const CATS = { state: [t('State institutions'), '#4A5A7A'], finance: [t('Finance'), '#5E7A6A'], landmark: [t('Landmarks'), '#8A7AA0'] };
  const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dist = (m) => (m < 950 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toLocaleString(I.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km');
  const locale = I.lang === 'ro' ? {
    'AttributionControl.ToggleAttribution': 'Arată sau ascunde sursele hărții',
    'AttributionControl.MapFeedback': 'Trimite observații despre hartă',
    'Map.Title': 'Hartă', 'Marker.Title': 'Marcaj', 'Popup.Close': 'Închide',
    'NavigationControl.ResetBearing': 'Orientează harta spre nord',
    'NavigationControl.ZoomIn': 'Mărește', 'NavigationControl.ZoomOut': 'Micșorează',
    'CooperativeGesturesHandler.WindowsHelpText': 'Ține apăsată tasta Ctrl și derulează pentru a mări sau micșora harta',
    'CooperativeGesturesHandler.MacHelpText': 'Ține apăsată tasta ⌘ și derulează pentru a mări sau micșora harta',
    'CooperativeGesturesHandler.MobileHelpText': 'Folosește două degete pentru a deplasa harta'
  } : undefined;

  function init(P) {
    const el = document.getElementById('locmap'); if (!el || !window.maplibregl) return;
    // centre sits between the hotel and the government quarter so both are in frame; bearing 150 puts the quarter "up"
    const map = new maplibregl.Map({ container: el, style: STYLE_URL, center: [28.8345, 47.0283], zoom: 15.7, pitch: 55, bearing: 150, attributionControl: { compact: true }, cooperativeGestures: true, locale });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right'); window.zareaMap = map;
    let HOME = { center: [28.8345, 47.0283], zoom: 15.7, bearing: 150, pitch: 55 };
    const legend = document.querySelector('.lmap__hint');
    const layersAll = ['z-3d', 'z-3d-hover', 'z-3d-asset', 'z-3d-pois'];
    const data = fetch('data/landmarks.geojson').then((r) => r.json()).then(fc => {
      if (I.lang === 'ro') fc.features.forEach(f => { if (f.properties) f.properties.name = f.properties.ro || t(f.properties.name); });
      return fc;
    });

    map.on('load', () => {
      const bl = map.getStyle().layers.find((l) => l.id === 'building' || (l['source-layer'] === 'building' && l.type === 'fill'));
      const labelLayer = map.getStyle().layers.find((l) => l.type === 'symbol' && l.layout && l.layout['text-field']);
      const before = labelLayer ? labelLayer.id : undefined;
      const H = ['coalesce', ['get', 'render_height'], 12], BASE = ['coalesce', ['get', 'render_min_height'], 0];
      const empty = { type: 'FeatureCollection', features: [] };
      if (bl) map.addLayer({ id: 'z-3d', type: 'fill-extrusion', source: bl.source, 'source-layer': bl['source-layer'], minzoom: 13, paint: { 'fill-extrusion-color': ['interpolate', ['linear'], H, 4, '#eef1f5', 14, '#dde4ec', 30, '#c5cfda', 60, '#a9b6c5'], 'fill-extrusion-height': H, 'fill-extrusion-base': BASE, 'fill-extrusion-opacity': 0.55 } }, before);
      map.addSource('z-hover', { type: 'geojson', data: empty });
      map.addLayer({ id: 'z-3d-hover', type: 'fill-extrusion', source: 'z-hover', paint: { 'fill-extrusion-color': '#a8a29a', 'fill-extrusion-height': ['+', H, 0.4], 'fill-extrusion-base': BASE, 'fill-extrusion-opacity': 1 } }, before);
      map.addSource('z-pois', { type: 'geojson', data: empty });
      map.addLayer({ id: 'z-3d-pois', type: 'fill-extrusion', source: 'z-pois', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['+', ['get', 'height'], 0.6], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1 } }, before);
      map.addSource('z-asset', { type: 'geojson', data: empty });
      map.addLayer({ id: 'z-3d-asset', type: 'fill-extrusion', source: 'z-asset', paint: { 'fill-extrusion-color': ASSET, 'fill-extrusion-height': ['+', ['get', 'height'], 0.6], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 1 } }, before);
      map.addSource('z-poi-pts', { type: 'geojson', data: empty });
      map.addLayer({ id: 'z-poi-labels', type: 'symbol', source: 'z-poi-pts', layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-max-width': 9, 'text-anchor': 'top', 'text-offset': [0, 0.4], 'text-padding': 4, 'symbol-sort-key': ['get', 'rank'] }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(255,255,255,0.96)', 'text-halo-width': 1.8 } });

      data.then((fc) => {
        const feats = fc.features.filter((f) => f.properties && (f.properties.cat === 'asset' || CATS[f.properties.cat])).map((f) => Object.assign({}, f, { geometry: offsetFeature(f, 0.4).geometry, properties: Object.assign({}, f.properties, { color: f.properties.cat === 'asset' ? ASSET : CATS[f.properties.cat][1] }) }));
        const asset = feats.find((f) => f.properties.cat === 'asset');
        const pois = feats.filter((f) => f.properties.cat !== 'asset');
        map.getSource('z-asset').setData({ type: 'FeatureCollection', features: asset ? [asset] : [] });
        map.getSource('z-pois').setData({ type: 'FeatureCollection', features: pois });
        map.getSource('z-poi-pts').setData({ type: 'FeatureCollection', features: pois.map((f, i) => ({ type: 'Feature', properties: { name: f.properties.name, color: f.properties.color, rank: i }, geometry: { type: 'Point', coordinates: f.properties.center } })) });
        // frame the hotel and the government quarter: the hotel at the bottom, the quarter "up" the screen
        const near = feats.filter((f) => f.properties.cat === 'asset' || f.properties.dist <= 1000);
        const b = new maplibregl.LngLatBounds();
        near.forEach((f) => { const cs = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]; cs.forEach((c) => b.extend(c)); });
        const cam = map.cameraForBounds(b, { padding: { top: 70, bottom: 90, left: 90, right: 90 }, bearing: 205 });
        const c = asset ? asset.properties.center : [P.lng, P.lat];
        if (cam) {
          const narrow = map.getContainer().clientWidth < 700;
          map.jumpTo({ center: cam.center, zoom: cam.zoom + (narrow ? 1.1 : 0.8), bearing: 205, pitch: 55 });
          const pt = map.project(c), W = map.getContainer().clientWidth, Hh = map.getContainer().clientHeight;
          map.panBy([pt.x - W * (narrow ? 0.3 : 0.4), pt.y - Hh * (narrow ? 0.6 : 0.74)], { animate: false });
          HOME = { center: map.getCenter(), zoom: map.getZoom(), bearing: 205, pitch: 55 };
        }
        // the hotel's pin and label
        const pin = document.createElement('div'); pin.className = 'pin'; pin.setAttribute('aria-label', P.name);
        new maplibregl.Marker({ element: pin }).setLngLat(c).addTo(map);
        const big = document.createElement('div'); big.className = 'poi-asset'; big.innerHTML = '<b>' + h(P.name) + '</b><span>' + h(P.address.split(',')[0]) + '</span>';
        new maplibregl.Marker({ element: big, anchor: 'left', offset: [18, 2] }).setLngLat(c).addTo(map);
        pin.addEventListener('click', (e) => { e._zHandled = true; assetInfo(c); });
        big.addEventListener('click', (e) => { e._zHandled = true; assetInfo(c); });
        if (legend) legend.innerHTML = '<span><i class="is-asset"></i> <b>' + h(P.name) + '</b></span>' + Object.keys(CATS).filter((k) => pois.some((f) => f.properties.cat === k)).map((k) => '<span><i class="is-' + k + '"></i> ' + h(CATS[k][0]) + '</span>').join('') + '<span class="lmap__hint-src">' + h(t('outlines from OpenStreetMap')) + '</span>';
      }).catch(() => { if (legend) legend.innerHTML = '<span><i class="is-asset"></i> <b>' + h(P.name) + '</b></span>'; });

      // interaction
      let bpop = null, tip = null;
      const showTip = (text, lngLat) => { if (!tip) tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'tip' }); tip.setLngLat(lngLat).setText(text).addTo(map); };
      const hideTip = () => { if (tip) tip.remove(); };
      const popup = (html, lngLat) => { if (bpop) bpop.remove(); bpop = new maplibregl.Popup({ offset: 12, closeButton: false, closeOnClick: false, maxWidth: '300px' }).setLngLat(lngLat).setHTML(html).addTo(map); };
      const assetInfo = (lngLat) => popup('<div class="bpop"><em>' + h(t('The property for sale')) + '</em><b>' + h(P.name) + '</b><span>' + h(P.address) + ' · ' + h(t('{levels} floors · {rooms} rooms', { levels: P.levels, rooms: P.rooms })) + '</span></div>', lngLat);
      map.on('mousemove', 'z-3d-asset', (e) => { map.getCanvas().style.cursor = 'pointer'; showTip(P.name, e.lngLat); });
      map.on('mouseleave', 'z-3d-asset', () => { map.getCanvas().style.cursor = ''; hideTip(); });
      map.on('mousemove', 'z-3d-pois', (e) => { map.getCanvas().style.cursor = 'pointer'; showTip(e.features[0].properties.name, e.lngLat); });
      map.on('mouseleave', 'z-3d-pois', () => { map.getCanvas().style.cursor = ''; hideTip(); });
      map.on('click', 'z-3d-asset', (e) => { e.originalEvent._zHandled = true; assetInfo(e.lngLat); });
      map.on('click', 'z-3d-pois', (e) => { e.originalEvent._zHandled = true; const p = e.features[0].properties; if (!CATS[p.cat]) return; popup('<div class="bpop"><em>' + h(CATS[p.cat][0]) + '</em><b>' + h(p.name) + '</b><span>' + h(t('{distance} from the hotel in a straight line', { distance: dist(p.dist) })) + '</span><small>' + (I.lang === 'en' && p.ro ? h(p.ro) + ' · ' : '') + h(t('outline from OpenStreetMap')) + '</small></div>', e.lngLat); });
      if (bl) {
        const hoverSrc = map.getSource('z-hover');
        const partAt = (f, point) => {
          const g = f.geometry; const hgt = Number(f.properties && f.properties.render_height) || 12;
          const ll0 = map.unproject([point.x, point.y]);
          const q0 = map.project([ll0.lng, ll0.lat]), q1 = map.project([ll0.lng + 0.0001, ll0.lat]);
          const ppm = Math.hypot(q1.x - q0.x, q1.y - q0.y) / (0.0001 * 111320 * Math.cos(ll0.lat * Math.PI / 180));
          const hpx = hgt * ppm * Math.sin(map.getPitch() * Math.PI / 180) * 1.6 + 8;
          const parts = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
          for (let dy = 0; dy <= hpx; dy += 3) { const ll = map.unproject([point.x, point.y + dy]); const hit = parts.find((rings) => pointInRing([ll.lng, ll.lat], rings[0])); if (hit) return { type: 'Polygon', coordinates: hit }; }
          return null;
        };
        map.on('mousemove', 'z-3d', (e) => { if (map.queryRenderedFeatures(e.point, { layers: ['z-3d-asset', 'z-3d-pois'] }).length) { hoverSrc.setData(empty); return; } const f = e.features[0]; const part = f && partAt(f, e.point); map.getCanvas().style.cursor = part ? 'pointer' : ''; hoverSrc.setData(part ? offsetFeature({ type: 'Feature', geometry: part, properties: f.properties }, 0.4) : empty); });
        map.on('mouseleave', 'z-3d', () => { map.getCanvas().style.cursor = ''; hoverSrc.setData(empty); });
        map.on('click', 'z-3d', (e) => { if (e.originalEvent._zHandled) return; e.originalEvent._zHandled = true; const f = e.features[0]; const hgt = f.properties && f.properties.render_height; const lv = hgt ? Math.max(1, Math.round(hgt / 3.1)) : null; popup('<div class="bpop"><b>' + h(t('Neighbouring building')) + '</b><span>' + h(hgt ? t(lv === 1 ? 'about {height} m · 1 floor' : 'about {height} m · {levels} floors', { height: Math.round(hgt), levels: lv }) : t('height unknown')) + '</span><small>' + h(t('Outline and height from OpenStreetMap. Not part of the offer.')) + '</small></div>', e.lngLat); });
      }
      map.on('click', (e) => { if (bpop && !e.originalEvent._zHandled && !map.queryRenderedFeatures(e.point, { layers: layersAll.filter((id) => map.getLayer(id)) }).length) { bpop.remove(); bpop = null; } });
    });
    const b3 = document.querySelector('[data-3d]');
    if (b3) b3.addEventListener('click', () => { const on = b3.getAttribute('aria-pressed') !== 'true'; b3.setAttribute('aria-pressed', on); layersAll.forEach((id) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); }); if (map.getLayer('z-3d-asset')) map.setLayoutProperty('z-3d-asset', 'visibility', 'visible'); map.easeTo({ pitch: on ? HOME.pitch : 0, bearing: on ? HOME.bearing : 0, duration: 600 }); });
    if ('ResizeObserver' in window) new ResizeObserver(() => map.resize()).observe(el);
  }

  function offsetRing(ring, d) {
    const n = ring.length - 1; if (n < 3) return ring;
    let area = 0; for (let i = 0; i < n; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    const ccw = area > 0; const lat0 = ring[0][1] * Math.PI / 180; const kx = 1 / (111320 * Math.cos(lat0)), ky = 1 / 110540;
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n]; const dx = (b[0] - a[0]) / kx, dy = (b[1] - a[1]) / ky; const len = Math.hypot(dx, dy) || 1;
      let nx = dy / len, ny = -dx / len; if (ccw) { nx = -nx; ny = -ny; }
      lines.push({ a: [a[0] + nx * d * kx, a[1] + ny * d * ky], b: [b[0] + nx * d * kx, b[1] + ny * d * ky] });
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const L1 = lines[(i - 1 + n) % n], L2 = lines[i];
      const x1 = L1.a[0], y1 = L1.a[1], x2 = L1.b[0], y2 = L1.b[1], x3 = L2.a[0], y3 = L2.a[1], x4 = L2.b[0], y4 = L2.b[1];
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-14) { out.push(L2.a); continue; }
      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
      const px = x1 + t * (x2 - x1), py = y1 + t * (y2 - y1);
      if (Math.hypot((px - ring[i][0]) / kx, (py - ring[i][1]) / ky) > 3 * d) out.push(L2.a); else out.push([px, py]);
    }
    out.push(out[0]); return out;
  }
  function offsetFeature(f, d) { const g = f.geometry; const rings = (rs) => rs.map((r, i) => i === 0 ? offsetRing(r, d) : r); return { type: 'Feature', properties: f.properties, geometry: g.type === 'Polygon' ? { type: 'Polygon', coordinates: rings(g.coordinates) } : { type: 'MultiPolygon', coordinates: g.coordinates.map(rings) } }; }
  function pointInRing(p, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }

  window.ZareaMap = { init };
})();
