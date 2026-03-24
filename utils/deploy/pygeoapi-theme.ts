import { DataModel } from '../../types';
import { hexToRgb } from '../colorUtils';

/**
 * Toggle this to true to invert the colors of the GeoForge logo and favicon 
 * (White background with Indigo icon). Set to false for the original 
 * Indigo background with White icon.
 */
const INVERT_BRAND_COLORS = true;

export function deriveBrandColor(_model: DataModel): string {
  // Always use GeoForge's primary indigo brand color for the API interface
  // rather than inheriting random feature layer styling.
  return '#6366f1'; // GeoForge Indigo
}

function darken(hex: string, amount = 30): string {
  const { r, g, b } = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r - amount)}${toHex(g - amount)}${toHex(b - amount)}`;
}

export function generatePygeoapiTheme(model: DataModel): string {
  const brand = deriveBrandColor(model);
  const brandDark = darken(brand);
  return generateBaseHtml(brand, brandDark, model.name);
}

function generateBaseHtml(brand: string, brandDark: string, title: string): string {
  const logoBg = INVERT_BRAND_COLORS ? '#ffffff' : brand;
  const logoIcon = INVERT_BRAND_COLORS ? brand : '#ffffff';
  const logoBorder = INVERT_BRAND_COLORS ? `border: 1px solid ${darken(brand, -120)};` : ''; // Subtle border for white BG
  
  // Favicon needs URL-encoded hex for the data URI
  const favBg = logoBg.replace('#', '%23');
  const favIcon = logoIcon.replace('#', '%23');
  const favBorder = INVERT_BRAND_COLORS ? `%3Crect width='31' height='31' x='0.5' y='0.5' rx='8' stroke='${favIcon}' stroke-width='1' fill='none'/%3E` : '';

  return `<!DOCTYPE html>
<html lang="{{ locale | default('en') }}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}${title}{% endblock %} - OGC API</title>
  
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='${favBg}'/%3E${favBorder}%3Cg transform='translate(6,6)' stroke='${favIcon}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' fill='none'%3E%3Cpath d='m10 8-5.582 5.582a.667.667 0 1 1-2-2L8 6'/%3E%3Cpath d='m12 10 2.667-2.667'/%3E%3Cpath d='m14.333 7.667-1.276-1.276A1.333 1.333 0 0 1 12.667 5.448V4.667l-1.507-1.507a4 4 0 0 0-2.801-1.16H6l.613.547A4.12 4.12 0 0 1 8 5.6V6.667l1.333 1.333h.781a1.333 1.333 0 0 1 .943.39l1.943 1.943'/%3E%3C/g%3E%3C/svg%3E">
  
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --brand: \${brand};
      --brand-dark: \${brandDark};
      --radius: 0.75rem; /* Match app border radius */
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    body { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; color: #0f172a; background: #f8fafc; -webkit-font-smoothing: antialiased; }
    h1, h2, h3 { color: var(--brand); font-weight: 700; letter-spacing: -0.02em; }
    h1 { font-size: 1.75rem; }
    h2 { font-size: 1.375rem; }
    h3 { font-size: 1.125rem; }

    /* Sleek Navbar */
    .navbar { 
      background: rgba(255, 255, 255, 0.85) !important;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03); 
      padding: 1rem 1.5rem;
      position: sticky;
      top: 0;
      z-index: 1030;
    }
    .navbar-brand { 
      font-weight: 800; 
      font-size: 1.25rem; 
      letter-spacing: -0.02em; 
      color: var(--brand) !important;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .nav-link { 
      color: #6366f1 !important; 
      font-weight: 600;
      padding: 0.5rem 1rem !important;
      border-radius: 9999px;
      transition: all 0.2s ease;
    }
    .nav-link:hover, .nav-link.active {
      background: #eef2ff;
    }
    
    /* Cards */
    .card { 
      border: 1px solid rgba(226, 232, 240, 0.8); 
      border-radius: var(--radius);
      box-shadow: var(--shadow-sm); 
      background: #ffffff;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
    }
    .card:hover { 
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg); 
      border-color: #cbd5e1;
    }
    .card-header {
      background: #eef2ff;
      border-bottom: 1px solid #c7d2fe;
      font-weight: 700;
      padding: 1.25rem 1.5rem;
      font-size: 1.1rem;
      color: #6366f1;
    }
    .card-body { padding: 1.5rem; }
    
    /* Map Container Polish */
    #map { 
      height: 500px; /* Essential for Leaflet to render */
      border-radius: 0.75rem; 
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08); 
      border: 1px solid #c7d2fe; 
      z-index: 1; 
    }
    
    /* Tables */
    .table { font-size: 0.875rem; color: #334155; margin-bottom: 0; }
    .table thead th {
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      border-top: none;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--brand);
      opacity: 0.75;
      font-weight: 700;
      padding: 0.75rem 1rem;
    }
    .table td { padding: 0.875rem 1rem; vertical-align: middle; border-color: #f1f5f9; }
    .table-hover tbody tr { transition: background-color 0.15s ease; }
    .table-hover tbody tr:hover { background-color: #eef2ff; }
    
    /* Buttons */
    .btn { font-weight: 600; border-radius: 0.5rem; padding: 0.5rem 1.25rem; transition: all 0.2s; }
    .btn-primary { background: var(--brand); border-color: var(--brand); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .btn-primary:hover, .btn-primary:focus { 
      background: var(--brand-dark); 
      border-color: var(--brand-dark); 
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);
      transform: translateY(-1px);
    }
    
    /* Miscellaneous */
    .breadcrumb { 
      background: transparent; 
      padding: 0.75rem 0; 
      font-size: 0.875rem; 
      font-weight: 500;
      margin-bottom: 1rem;
      color: #94a3b8;
    }
    .breadcrumb a { color: var(--brand); text-decoration: none; transition: color 0.15s; }
    .breadcrumb a:hover { color: var(--brand); }
    
    a { color: var(--brand); transition: color 0.15s ease; text-decoration: none; }
    a:hover { color: var(--brand-dark); text-decoration: underline; }
    
    /* Footer */
    footer.gf-footer { 
      border-top: 1px solid #e2e8f0; 
      color: #64748b;
      font-size: 0.875rem; 
      padding: 2rem 0; 
      margin-top: 4rem; 
      background: #ffffff;
    }
    main.container { padding-top: 1rem; padding-bottom: 3rem; min-height: 50vh; }
  </style>
  {% block extrahead %}{% endblock %}
</head>
<body>
  <nav class="navbar navbar-expand-md navbar-light">
    <div class="container">
      <a class="navbar-brand" href="{{ config.server.url }}">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:${logoBg};border-radius:8px;flex-shrink:0;${logoBorder}" class="me-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${logoIcon}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/>
            <path d="m18 15 4-4"/>
            <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>
          </svg>
        </span>
        {{ config.metadata.identification.title }}
      </a>
      <button class="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav ms-auto gap-2">
          <li class="nav-item">
            <a class="nav-link" href="{{ config.server.url }}/collections">Collections</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="{{ config.server.url }}/openapi">API</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="{{ config.server.url }}/conformance">Conformance</a>
          </li>
          {% if config.server.languages | length > 1 %}
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
              {{ locale | default('en') }}
            </a>
            <div class="dropdown-menu dropdown-menu-end shadow-sm border-0 mt-2" style="border-radius: var(--radius);">
              {% for lang in config.server.languages %}
              <a class="dropdown-item py-2" href="?lang={{ lang }}">{{ lang }}</a>
              {% endfor %}
            </div>
          </li>
          {% endif %}
        </ul>
      </div>
    </div>
  </nav>

  <div class="container mt-4">
    <div class="breadcrumb">
      {% block crumbs %}
      <a href="{{ config.server.url }}">Home</a>
      {% endblock %}
    </div>
  </div>

  <main class="container">
    {% block body %}{% endblock %}
  </main>

  <footer class="gf-footer">
    <div class="container d-flex justify-content-between align-items-center flex-wrap gap-3">
      <span>Powered by <a href="https://pygeoapi.io" class="fw-bold">pygeoapi</a> {{ version }}</span>
      <a href="https://geoforge.up.railway.app/" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:0.4rem;font-weight:500;transition:opacity 0.2s;" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0" fill="none" stroke="${brand}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/>
          <path d="M17.64 15 22 10.64"/>
          <path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H11.2l-2.5 2.5"/>
          <path d="m12.44 9.15 4.41 4.41"/>
        </svg>
        Made with GeoForge
      </a>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  
  {% block extrabody %}{% endblock %}
  {% block extrafoot %}{% endblock %}
</body>
</html>`;
}

export function generateCollectionsHtml(model: DataModel): string {
  const geomTypesStr = model.layers.map(l => {
    const id = l.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `'${id}': '${l.geometryType}'`;
  }).join(', ');

  return `{% extends "_base.html" %}
{% block title %}{{ super() }} - Collections{% endblock %}
{% block crumbs %}{{ super() }} / <a href="{{ config.server.url }}/collections">Collections</a>{% endblock %}
{% block body %}
<style>
  .col-row {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: var(--radius);
    margin-bottom: 1rem;
    box-shadow: var(--shadow-sm);
    transition: box-shadow 0.2s, border-color 0.2s;
    overflow: hidden;
  }
  .col-row:hover { box-shadow: var(--shadow-md); border-color: #cbd5e1; }
  .col-icon {
    display: flex; align-items: center; justify-content: center;
    width: 90px; flex-shrink: 0;
    background: #f1f5f9;
    color: var(--brand);
    font-size: 2rem;
  }
  .col-body { flex: 1; padding: 1.1rem 1.3rem; min-width: 0; }
  .col-title { font-size: 1.05rem; font-weight: 700; color: #6366f1; text-decoration: none; }
  .col-title:hover { text-decoration: underline; }
  .col-count { font-size: 0.78rem; background: #e0e7ff; color: #4338ca; border-radius: 999px; padding: 0.15rem 0.65rem; font-weight: 600; margin-left: 0.5rem; vertical-align: middle; }
  .col-desc { font-size: 0.875rem; color: var(--brand); opacity: 0.7; margin: 0.3rem 0 0.6rem; }
  .col-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .col-tag { font-size: 0.72rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 999px; padding: 0.15rem 0.6rem; }
  .col-meta { padding: 1rem 1.3rem; min-width: 200px; border-left: 1px solid #f1f5f9; display: flex; flex-direction: column; justify-content: center; }
  .col-meta-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; font-weight: 700; }
  .col-meta-value { font-size: 0.85rem; color: #334155; font-weight: 500; margin-bottom: 0.6rem; }
  .col-cta { flex-shrink: 0; display: flex; align-items: center; padding: 0 1.3rem; }
  .col-cta a { font-size: 0.85rem; font-weight: 600; color: var(--brand); white-space: nowrap; text-decoration: none; }
  .col-cta a:hover { text-decoration: underline; }
  #collections-map { height: 380px; border-radius: var(--radius); box-shadow: var(--shadow-md); margin-bottom: 1.5rem; }
</style>

<div class="d-flex justify-content-between align-items-center mb-4">
  <h2 style="font-weight:800;font-size:1.5rem;letter-spacing:-0.02em;color:#6366f1;">Collections</h2>
  <a href="?f=json" class="btn btn-sm" style="background:#eef2ff;color:#6366f1;font-size:0.8rem;border:1px solid #c7d2fe;">JSON</a>
</div>

<div id="collections-map"></div>

{% for col in data.collections %}
<div class="col-row">
  <div class="col-icon">
    {% set geomMap = { ${geomTypesStr} } %}
    {% set gtype = geomMap.get(col.id, 'Unknown') %}
    {% if gtype == 'Point' or gtype == 'MultiPoint' %}
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    {% elif 'Line' in gtype %}
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    {% elif col.itemType == 'record' %}
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
    {% else %}
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="12" cy="17" r="3"/><line x1="7" y1="10" x2="12" y2="14"/><line x1="17" y1="10" x2="12" y2="14"/></svg>
    {% endif %}
  </div>
  <div class="col-body">
    <div>
      <a class="col-title" href="{{ config.server.url }}/collections/{{ col.id }}">{{ col.title }}</a>
    </div>
    <p class="col-desc">{{ col.description }}</p>
    <div class="col-tags">
      {% for kw in col.keywords %}<span class="col-tag">{{ kw }}</span>{% endfor %}
    </div>
  </div>
  {% if col.crs %}
  <div class="col-meta">
    <div class="col-meta-label">CRS</div>
    <div class="col-meta-value">{{ col.crs[0] | replace('http://www.opengis.net/def/crs/EPSG/0/', 'EPSG:') | replace('http://www.opengis.net/def/crs/OGC/1.3/CRS84', 'CRS84') }}</div>
  </div>
  {% endif %}
  <div class="col-cta">
    <a href="{{ config.server.url }}/collections/{{ col.id }}">View &rarr;</a>
  </div>
</div>
{% endfor %}
{% endblock %}

{% block extrafoot %}
<script>
  document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('collections-map').setView([0, 0], 1);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 18
    }).addTo(map);
    var bounds = L.latLngBounds();
    var hasBounds = false;
    {% for col in data.collections %}
      {% if col.extent and col.extent.spatial and col.extent.spatial.bbox %}
        (function() {
          var bbox = {{ col.extent.spatial.bbox[0] | to_json }};
          var sw = [bbox[1], bbox[0]], ne = [bbox[3], bbox[2]];
          L.rectangle([sw, ne], { color: '#6366f1', weight: 2, fillOpacity: 0.07 })
            .addTo(map)
            .bindPopup('<b>{{ col.title }}</b><br><a href="{{ config.server.url }}/collections/{{ col.id }}">View &rarr;</a>');
          bounds.extend([sw, ne]);
          hasBounds = true;
        })();
      {% endif %}
    {% endfor %}
    if (hasBounds) map.fitBounds(bounds, { padding: [24, 24] });
  });
</script>
{% endblock %}`;
}

export function generateItemsHtml(model: DataModel): string {
  return `{% extends "_base.html" %}
{% block title %}{{ super() }} - Items{% endblock %}
{% block crumbs %}
  {{ super() }} / 
  <a href="{{ config.server.url }}/collections">Collections</a> / 
  <a href="{{ data.dataset_path | default(config.server.url + '/collections') }}">{{ data.title | default('Collection') }}</a> / 
  <span>Items</span>
{% endblock %}
{% block body %}
<style>
  #items-map { height: 420px; border-radius: var(--radius); box-shadow: var(--shadow-md); }
  .items-header { font-size:1.5rem; font-weight:800; letter-spacing:-0.02em; margin-bottom:0.25rem; color: var(--brand); }
  .items-desc { color: var(--brand); opacity: 0.75; font-size:0.95rem; margin-bottom:1.25rem; }
  .feature-table th { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700; padding:0.65rem 1rem; background:#f8fafc; border-bottom:2px solid #e2e8f0; }
  .feature-table td { padding:0.7rem 1rem; font-size:0.875rem; color:#334155; border-color:#f1f5f9; vertical-align:middle; }
  .feature-table tbody tr { transition:background 0.12s; }
  .feature-table tbody tr:hover { background:#f8fafc; }
  .id-link { font-weight:700; font-family:monospace; font-size:0.95rem; color:#4f46e5; display:inline-flex; align-items:center; gap:0.4rem; text-decoration:underline; text-decoration-color:#c7d2fe; text-underline-offset:4px; text-decoration-thickness:2px; transition:all 0.2s; }
  .id-link:hover { color:#3730a3; text-decoration-color:#4f46e5; }
  .chip { display:inline-block; font-size:0.72rem; padding:0.15rem 0.6rem; border-radius:999px; background:#e0e7ff; color:#4338ca; font-weight:600; }
  .items-meta-bar { display:flex; gap:1.5rem; flex-wrap:wrap; align-items:center; margin-bottom:0.75rem; padding:0.85rem 1.1rem; background:#fff; border:1px solid #e2e8f0; border-radius: var(--radius); box-shadow:var(--shadow-sm); }
  .items-meta-bar .meta-item { display:flex; flex-direction:column; }
  .items-meta-bar .meta-label { font-size:0.68rem; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8; font-weight:700; }
  .items-meta-bar .meta-value { font-size:0.9rem; font-weight:600; color:#0f172a; }

  #filter-panel { background:#fff; border:1px solid #e2e8f0; border-radius:var(--radius); box-shadow:var(--shadow-sm); padding:1.5rem; margin-bottom:1rem; display:none; }
  #filter-panel.open { display:block; }
  .filter-row { display:flex; gap:0.75rem; align-items:flex-end; margin-bottom:0.75rem; animation: fadeIn 0.2s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
  .filter-row-field { flex: 1; min-width: 0; }
  .filter-row-op { width: 80px; flex-shrink: 0; }
  .filter-row-val { flex: 2; min-width: 0; }
  .filter-row label { display:block; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.06em; color:#94a3b8; font-weight:700; margin-bottom:0.3rem; }
  .filter-row select, .filter-row input { width:100%; font-size:0.85rem; padding:0.455rem 0.65rem; border:1px solid #cbd5e1; border-radius:0.4rem; color:#334155; background:#f8fafc; transition:all 0.15s; outline:none; }
  .filter-row select:focus, .filter-row input:focus { border-color:#6366f1; background:#fff; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1); }
  .btn-remove-row { background:none; border:none; color:#cbd5e1; padding:0.45rem; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center; }
  .btn-remove-row:hover { color:#ef4444; background:#fef2f2; border-radius:0.35rem; }
  .btn-add-filter { display:inline-flex; align-items:center; gap:0.45rem; background:#fff; border:1px solid #e2e8f0; color:#64748b; font-size:0.8rem; font-weight:700; padding:0.55rem 1.1rem; border-radius:0.5rem; cursor:pointer; transition:all 0.15s; width: 100%; justify-content: center; margin-bottom: 1.5rem; box-shadow:var(--shadow-sm); }
  .btn-add-filter:hover { border-color:#6366f1; color:#6366f1; background:#f8fafc; box-shadow:var(--shadow-md); }
  .filter-section-title { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; font-weight:800; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; }
  .filter-section-title::after { content:""; flex:1; height:1px; background:#f1f5f9; }
  .filter-actions { display:flex; gap:0.75rem; align-items:center; }
  .btn-filter-apply { background:#6366f1; color:#fff; border:none; border-radius:0.5rem; font-size:0.82rem; font-weight:700; padding:0.55rem 1.4rem; cursor:pointer; transition:all 0.2s; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2); }
  .btn-filter-apply:hover { background:#4f46e5; transform:translateY(-1px); box-shadow: 0 6px 12px -2px rgba(99, 102, 241, 0.3); }
  .btn-filter-apply:active { transform:translateY(0); }
  .btn-filter-clear { background:#fff; border:1px solid #e2e8f0; border-radius:0.5rem; font-size:0.82rem; font-weight:700; padding:0.55rem 1.4rem; color:#64748b; cursor:pointer; transition:all 0.2s; }
  .btn-filter-clear:hover { border-color:#94a3b8; color:#334155; background:#f8fafc; }

  /* Active filter chips */
  #active-filters { display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:1rem; }
  .active-chip { display:inline-flex; align-items:center; gap:0.3rem; font-size:0.75rem; background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; border-radius:999px; padding:0.2rem 0.5rem 0.2rem 0.7rem; font-weight:600; }
  .active-chip button { background:none; border:none; cursor:pointer; color:#4338ca; padding:0; line-height:1; font-size:0.9rem; display:flex; align-items:center; opacity:0.6; transition:opacity 0.15s; }
  .active-chip button:hover { opacity:1; }
  .btn-filter-toggle { display:inline-flex; align-items:center; gap:0.45rem; font-size:0.82rem; font-weight:700; padding:0.38rem 0.85rem; border-radius:0.45rem; cursor:pointer; background:#f1f5f9; border:1px solid #e2e8f0; color:#475569; transition:all 0.15s; white-space:nowrap; }
  .btn-filter-toggle:hover, .btn-filter-toggle.active { background:#eef2ff; border-color:#c7d2fe; color:#6366f1; }
</style>

<div class="items-header">{{ data.title | default('Collection') }}</div>
<div class="items-desc">{{ data.description }}</div>

<div class="items-meta-bar mb-3">
  <div class="meta-item">
    <span class="meta-label">Collection</span>
    <span class="meta-value">{{ data.title | default('Collection') }}</span>
  </div>
  {% if data.numberMatched is defined %}
  <div class="meta-item">
    <span class="meta-label">Total features</span>
    <span class="meta-value">{{ data.numberMatched }}</span>
  </div>
  {% endif %}
  {% if data.numberReturned is defined %}
  <div class="meta-item">
    <span class="meta-label">Returned</span>
    <span class="meta-value">{{ data.numberReturned }}</span>
  </div>
  {% endif %}
  <div class="meta-item">
    <span class="meta-label">Limit</span>
    <select id="items-limit" class="form-select form-select-sm" style="font-size:0.85rem; padding:0.15rem 1.5rem 0.15rem 0.5rem; border-color:#cbd5e1; border-radius:0.375rem; color:#334155; font-weight:600; cursor:pointer;">
      <option value="{{ config.server.limits.default_items }}">{{ config.server.limits.default_items }} (Default)</option>
      <option value="10">10</option>
      <option value="50">50</option>
      <option value="100">100</option>
    </select>
  </div>
  <div class="ms-auto d-flex gap-2">
    <button id="btn-filter-toggle" class="btn-filter-toggle" onclick="GF.toggleFilterPanel()">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
      Filter
    </button>
    <a href="?f=json" class="btn btn-sm" style="background:#eef2ff;color:#6366f1;font-size:0.8rem;border:1px solid #c7d2fe;">JSON</a>
  </div>
</div>

<div id="active-filters"></div>

<div id="filter-panel">
  <div class="filter-section-title">Attribute Filters</div>
  <div id="filter-list" class="mb-2">
    <!-- Rows added dynamically -->
    <div class="filter-loading">Loading queryable properties…</div>
  </div>
  <button id="btn-add-filter" class="btn-add-filter" style="display:none" onclick="GF.addRow()">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
    Add filter
  </button>

  <div class="filter-section-title">Spatial Filter</div>
  <div class="filter-row mb-4">
    <div class="filter-row-field" style="flex:1">
      <label>Bounding box (xmin, vmin, xmax, ymax)</label>
      <input type="text" id="qf-bbox" placeholder="e.g. 10.0, 59.0, 11.0, 60.0">
    </div>
  </div>

  <div class="filter-actions" id="filter-actions" style="display:none; border-top:1px solid #f1f5f9; padding-top:1.25rem;">
    <button class="btn-filter-apply" onclick="GF.applyFilters()">Apply filters</button>
    <button class="btn-filter-clear" onclick="GF.clearFilters()">Clear all</button>
    <span id="filter-count" style="font-size:0.78rem;color:#94a3b8;margin-left:auto;"></span>
  </div>
</div>

<div class="row g-4 mb-4">
  <div class="col-md-12">
    <div id="items-map"></div>
  </div>
</div>

<div class="card" style="overflow:hidden;">
  <div class="card-header d-flex align-items-center justify-content-between">
    <div class="d-flex align-items-center gap-3">
      <span>Features</span>
      {% if data.features %}<span class="chip">{{ data.features | length }} shown</span>{% endif %}
    </div>
    
    <div class="d-flex gap-2">
      {% for link in data.links %}
        {% if link.rel == 'prev' %}
          <a href="{{ link.href }}" class="btn btn-sm" style="background:#fff;color:#6366f1;border:1px solid #c7d2fe;font-size:0.75rem;padding:0.25rem 0.6rem;">&larr; Prev</a>
        {% elif link.rel == 'next' %}
          <a href="{{ link.href }}" class="btn btn-sm" style="background:#fff;color:#6366f1;border:1px solid #c7d2fe;font-size:0.75rem;padding:0.25rem 0.6rem;">Next &rarr;</a>
        {% endif %}
      {% endfor %}
    </div>
  </div>
  <div class="card-body p-0">
    <div class="table-responsive">
      <table class="table feature-table mb-0">
        <thead>
          <tr>
            <th>ID</th>
            {% if data.features and data.features|length > 0 %}
              {% for key in data.features[0].properties.keys() %}
                <th>{{ key }}</th>
              {% endfor %}
            {% endif %}
          </tr>
        </thead>
        <tbody>
          {% for feature in data.features %}
          <tr>
            <td><a class="id-link" href="{{ data.items_path | default(config.server.url + '/collections/items') }}/{{ feature.id }}">{{ feature.id }} <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7;"><polyline points="9 18 15 12 9 6"/></svg></a></td>
            {% for key, value in feature.properties.items() %}
              <td>{{ value }}</td>
            {% endfor %}
          </tr>
          {% endfor %}
        </tbody>
      </table>
    </div>
  </div>
</div>
{% endblock %}

{% block extrafoot %}
<script>
  document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('items-map').setView([0, 0], 1);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(map);
    var featuresData = {{ data | to_json | safe }};
    if (featuresData && featuresData.features && featuresData.features.length > 0) {
      var brandColor = '#6366f1';
      var layer = L.geoJSON(featuresData, {
        style: function() { return { color: brandColor, weight: 2, fillOpacity: 0.18 }; },
        pointToLayer: function(feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 6, fillColor: brandColor,
            color: '#fff', weight: 1.5, opacity: 1, fillOpacity: 0.85
          });
        },
        onEachFeature: function(feature, layer) {
          var detailsUrl = '{{ data.items_path | default(config.server.url + "/collections/items") }}/' + feature.id;
          var html = '<div style="min-width:240px; font-family:Inter,sans-serif;">';
          
          // Header
          html += '<div style="padding:10px 0; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">';
          html += '<span style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700;">Feature</span>';
          html += '<span style="font-family:monospace; font-size:0.85rem; font-weight:700; color:#6366f1;">#' + feature.id + '</span>';
          html += '</div>';

          // Properties Scroll Area
          html += '<div style="max-height:180px; overflow-y:auto; padding-right:4px;">';
          if (feature.properties) {
            for (var p in feature.properties) {
              if (p === 'extent') continue; 
              html += '<div style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid #f8fafc;">';
              html += '<div style="font-size:0.65rem; color:#94a3b8; text-transform:uppercase; font-weight:600; margin-bottom:1px;">' + p + '</div>';
              html += '<div style="font-size:0.82rem; color:#334155; font-weight:500; word-break:break-all;">' + feature.properties[p] + '</div>';
              html += '</div>';
            }
          }
          html += '</div>';

          // Action Button
          html += '<a href="' + detailsUrl + '" style="display:block; text-align:center; background:#6366f1; color:#fff; text-decoration:none; padding:8px; border-radius:6px; font-size:0.8rem; font-weight:700; margin-top:12px;">';
          html += 'View full details &rarr;';
          html += '</a>';
          
          html += '</div>';
          layer.bindPopup(html);
        }
      }).addTo(map);
      try { map.fitBounds(layer.getBounds(), { padding: [24, 24] }); } catch(e) {}
    }

    var params = (new URL(document.location)).searchParams;
    
    var select = document.getElementById('items-limit');
    if (select) {
      if (params.has('limit')) {
        select.value = params.get('limit');
      }
      select.addEventListener('change', function(ev) {
        var url = new URL(document.location);
        url.searchParams.set('limit', ev.target.value);
        url.searchParams.delete('offset'); // reset to page 1
        document.location = url.toString();
      });
    }

    // --- Queryables filter panel ---
    // Use plain object maps instead of Set to avoid any Jinja2/browser issues
    var QUERYABLES_SKIP = { geometry: true, id: true };
    var RESERVED_PARAMS = { f: true, limit: true, offset: true, bbox: true, datetime: true, lang: true };
    var collectionId = '{{ data.id }}';
    if (!collectionId || collectionId === 'None' || collectionId === '') {
      var pathParts = window.location.pathname.split('/');
      var collectionsIdx = pathParts.indexOf('collections');
      if (collectionsIdx !== -1 && pathParts.length > collectionsIdx + 1) {
        collectionId = pathParts[collectionsIdx + 1];
      }
    }
    var queryablesUrl = '{{ config.server.url }}/collections/' + collectionId + '/queryables?f=json';
    var queryables = {}; // exposed on window.GF so onclick handlers can reach it

    // Expose all filter functions globally so inline onclick="..." can call them
    window.GF = window.GF || {};
    window.GF.queryables = queryables;

    window.GF.toggleFilterPanel = function() {
      var panel = document.getElementById('filter-panel');
      var btn = document.getElementById('btn-filter-toggle');
      var isOpen = panel.classList.toggle('open');
      btn.classList.toggle('active', isOpen);
      if (isOpen && Object.keys(window.GF.queryables).length === 0) {
        window.GF.loadQueryables();
      }
    };

    window.GF.loadQueryables = function() {
      fetch(queryablesUrl)
        .then(function(r) { return r.json(); })
        .catch(function(err) { console.error('GF Debug - Fetch error:', err); return null; })
        .then(function(resp) {
          var list = document.getElementById('filter-list');
          var actions = document.getElementById('filter-actions');
          var addBtn = document.getElementById('btn-add-filter');
          if (!resp || !resp.properties) {
            list.innerHTML = '<div class="filter-loading">No queryable properties available for this collection.</div>';
            return;
          }
          window.GF.queryables = {};
          var props = resp.properties;
          Object.keys(props).forEach(function(key) {
            if (QUERYABLES_SKIP[key]) return;
            window.GF.queryables[key] = props[key];
          });
          if (Object.keys(window.GF.queryables).length === 0) {
            list.innerHTML = '<div class="filter-loading">No filterable properties found.</div>';
            return;
          }
          
          list.innerHTML = ''; // Clear loading
          addBtn.style.display = 'inline-flex';
          actions.style.display = 'flex';
          
          // Pre-fill from URL
          var bboxVal = params.get('bbox') || '';
          var bboxEl = document.getElementById('qf-bbox');
          if (bboxEl) bboxEl.value = bboxVal;

          var rowsRestored = false;
          // 1. Try simple params first (prop=val)
          params.forEach(function(val, key) {
            if (window.GF.queryables[key]) {
              window.GF.addRow({ attr: key, op: '=', val: val });
              rowsRestored = true;
            }
          });
          
          // 2. Try OGC Filter (CQL2)
          var filterVal = params.get('filter');
          if (filterVal) {
            // Simple regex for 'prop op val'
            var re = /([a-zA-Z0-9_]+)\\s*(=|>|<|>=|<=|<>)\\s*(['"]?)(.*?)\\3/g;
            var match;
            while ((match = re.exec(filterVal)) !== null) {
              var attr = match[1];
              var op = match[2];
              var val = match[4];
              if (window.GF.queryables[attr]) {
                window.GF.addRow({ attr: attr, op: op, val: val });
                rowsRestored = true;
              }
            }
          }

          if (!rowsRestored) {
            window.GF.addRow(); // Start with one empty row
          }
          window.GF.updateFilterCount();
        });
    };

    window.GF.addRow = function(data) {
      data = data || { attr: '', op: '=', val: '' };
      var list = document.getElementById('filter-list');
      var row = document.createElement('div');
      row.className = 'filter-row';
      
      var attrOptions = Object.keys(window.GF.queryables).map(function(key) {
        var q = window.GF.queryables[key];
        return '<option value="' + key + '"' + (data.attr === key ? ' selected' : '') + '>' + (q.title || key) + '</option>';
      }).join('');

      var ops = ['=', '<>', '>', '<', '>=', '<='];
      var opOptions = ops.map(function(o) {
        return '<option value="' + o + '"' + (data.op === o ? ' selected' : '') + '>' + o + '</option>';
      }).join('');

      row.innerHTML = 
        '<div class="filter-row-field"><label>Attribute</label><select class="qf-attr">' + attrOptions + '</select></div>' +
        '<div class="filter-row-op"><label>Op</label><select class="qf-op">' + opOptions + '</select></div>' +
        '<div class="filter-row-val"><label>Value</label><input type="text" class="qf-val" value="' + (data.val || '') + '" placeholder="Value..."></div>' +
        '<button class="btn-remove-row" title="Remove" onclick="this.parentElement.remove(); GF.updateFilterCount();">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
      
      list.appendChild(row);
      window.GF.updateFilterCount();
    };

    window.GF.applyFilters = function() {
      var url = new URL(document.location);
      // Clear existing
      Object.keys(window.GF.queryables).forEach(function(key) { url.searchParams.delete(key); });
      url.searchParams.delete('filter');
      url.searchParams.delete('bbox');
      url.searchParams.delete('offset');

      var rows = document.querySelectorAll('.filter-row');
      var simpleFilters = [];
      var cqlFilters = [];

      rows.forEach(function(row) {
        var attr = row.querySelector('.qf-attr')?.value;
        var op = row.querySelector('.qf-op')?.value;
        var val = row.querySelector('.qf-val')?.value.trim();
        if (!attr || !val) return;

        if (op === '=') {
          simpleFilters.push({ key: attr, val: val });
        } else {
          // FIX 2: Check exact type from queryables to prevent pygeofilter 400 Bad Request crashes
          var qType = window.GF.queryables[attr]?.type;
          var isNumericType = (qType === 'number' || qType === 'integer');
          var formattedVal = isNumericType ? val : "'" + val + "'";
          cqlFilters.push(attr + " " + op + " " + formattedVal);
        }
      });

      // Prefer simple params if ONLY equality is used for one or more DIFFERENT keys
      // But if operators are used, or multiple filters for same key, CQL is better
      if (cqlFilters.length > 0) {
        // Build CQL2 filter string
        var allConditions = simpleFilters.map(function(f) { 
          var qType = window.GF.queryables[f.key]?.type;
          var isNumericType = (qType === 'number' || qType === 'integer');
          return f.key + " = " + (isNumericType ? f.val : "'" + f.val + "'");
        }).concat(cqlFilters);
        url.searchParams.set('filter', allConditions.join(' AND '));
      } else {
        simpleFilters.forEach(function(f) {
          url.searchParams.set(f.key, f.val);
        });
      }

      var bboxEl = document.getElementById('qf-bbox');
      if (bboxEl && bboxEl.value.trim()) url.searchParams.set('bbox', bboxEl.value.trim());
      
      document.location = url.toString();
    };

    window.GF.clearFilters = function() {
      var url = new URL(document.location);
      Object.keys(window.GF.queryables).forEach(function(key) { url.searchParams.delete(key); });
      url.searchParams.delete('filter');
      url.searchParams.delete('bbox');
      url.searchParams.delete('offset');
      document.location = url.toString();
    };

    window.GF.updateFilterCount = function() {
      var list = document.getElementById('filter-list');
      var rows = list ? list.querySelectorAll('.filter-row') : [];
      var count = 0;
      rows.forEach(function(row) {
        var v = row.querySelector('.qf-val')?.value.trim();
        if (v) count++;
      });
      var bboxEl = document.getElementById('qf-bbox');
      if (bboxEl && bboxEl.value.trim()) count++;
      var span = document.getElementById('filter-count');
      if (span) span.textContent = count > 0 ? count + ' filter' + (count > 1 ? 's' : '') + ' active' : '';
    };

    window.GF.removeFilter = function(key) {
      var url = new URL(document.location);
      url.searchParams.delete(key);
      url.searchParams.delete('filter'); 
      url.searchParams.delete('bbox'); 
      url.searchParams.delete('offset');
      document.location = url.toString();
    };

    // Render active filter chips from URL params
    (function() {
      var container = document.getElementById('active-filters');
      if (!container) return;
      var chips = [];
      var seenKeys = {};
      params.forEach(function(value, key) {
        if (RESERVED_PARAMS[key]) return;
        var uid = key + '=' + value;
        if (!seenKeys[uid]) { seenKeys[uid] = true; chips.push({ key: key, value: value }); }
      });
      if (params.has('bbox')) {
        var bv = params.get('bbox');
        chips.push({ key: 'bbox', value: bv });
      }
      if (chips.length === 0) return;
      container.innerHTML = chips.map(function(c) {
        return '<span class="active-chip"><span>' + c.key + ': ' + c.value + '</span>'
          + '<button class="chip-remove" data-key="' + c.key + '" title="Remove filter">&times;</button></span>';
      }).join('');
      container.addEventListener('click', function(e) { var t = e.target.closest ? e.target.closest('.chip-remove') : null; if (t && t.dataset && t.dataset.key) window.GF.removeFilter(t.dataset.key); });
      var btn = document.getElementById('btn-filter-toggle');
      if (btn) btn.classList.add('active');
    })();

    // --- Navigation Context Tracking ---
    try {
      var itemIds = [];
      var idLinks = document.querySelectorAll('.id-link');
      idLinks.forEach(function(link) {
        var parts = link.href.split('/');
        itemIds.push(parts[parts.length - 1]);
      });
      if (itemIds.length > 0) {
        sessionStorage.setItem('gf_items_context', JSON.stringify({
          ids: itemIds,
          collection: '{{ data.id }}',
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      console.warn('Failed to save navigation context', e);
    }
  });
</script>
{% endblock %}`;
}

export function generateCollectionHtml(_model: DataModel): string {
  return `{% extends "_base.html" %}
{% block title %}{{ super() }} - {{ data.title | default(data.id) }}{% endblock %}
{% block crumbs %}
  {{ super() }} / 
  <a href="{{ config.server.url }}/collections">Collections</a> / 
  <span>{{ data.title | default(data.id) }}</span>
{% endblock %}
{% block body %}
<style>
  .coll-hero { display:flex; gap:1.75rem; align-items:flex-start; margin-bottom:2rem; }
  #coll-map { width:200px; height:170px; flex-shrink:0; border-radius:calc(var(--radius) * 0.75); border:1px solid #e2e8f0; box-shadow:var(--shadow-sm); }
  .coll-hero-body { flex:1; min-width:0; }
  .coll-hero-title { font-size:2rem; font-weight:800; letter-spacing:-0.03em; margin-bottom:0.25rem; color:#6366f1; }
  .coll-hero-desc { color:#475569; font-size:0.95rem; margin-bottom:0.85rem; line-height:1.6; }
  .coll-hero-tags { display:flex; flex-wrap:wrap; gap:0.35rem; }
  .coll-hero-tag { font-size:0.72rem; background:#f1f5f9; color:#475569; border:1px solid #e2e8f0; border-radius:999px; padding:0.15rem 0.65rem; }
  .browse-btn { display:inline-flex; align-items:center; gap:0.6rem; padding:0.85rem 1.5rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius); font-weight:700; font-size:0.95rem; color:#6366f1; text-decoration:none; transition:all 0.2s; margin-bottom:1.5rem; }
  .browse-btn:hover { background:#f1f5f9; border-color:#cbd5e1; color:#6366f1; text-decoration:none; box-shadow:var(--shadow-sm); }
  .url-block { background:#f8fafc; border:1px solid #e2e8f0; border-radius:var(--radius); padding:1.25rem 1.5rem; margin-bottom:1.5rem; }
  .url-row { display:flex; align-items:center; gap:1rem; padding:0.6rem 0; border-bottom:1px solid #f1f5f9; }
  .url-row:last-child { border-bottom:none; }
  .url-label { font-size:0.8rem; font-weight:600; color:#475569; min-width:110px; flex-shrink:0; }
  .url-code { flex:1; font-family:monospace; font-size:0.78rem; color:#334155; background:#fff; border:1px solid #e2e8f0; border-radius:0.375rem; padding:0.35rem 0.65rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .url-copy { flex-shrink:0; background:none; border:none; color:#94a3b8; cursor:pointer; padding:0.25rem; border-radius:0.25rem; transition:color 0.15s; line-height:1; }
  .url-copy:hover { color:var(--brand); }
  .sidebar-card { background:#fff; border:1px solid #e2e8f0; border-radius:var(--radius); box-shadow:var(--shadow-sm); padding:1.25rem 1.5rem; }
  .sidebar-card-title { font-size:0.8rem; font-weight:700; color:#475569; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; }
  .sidebar-row { display:flex; justify-content:space-between; align-items:baseline; padding:0.5rem 0; border-bottom:1px solid #f8fafc; font-size:0.875rem; gap:1rem; }
  .sidebar-row:last-child { border-bottom:none; }
  .sidebar-key { color:#94a3b8; font-weight:500; flex-shrink:0; }
  .sidebar-val { color:#0f172a; font-weight:600; text-align:right; word-break:break-all; }
</style>

<div class="row g-4">
  <div class="col-lg-8">

    <!-- Hero -->
    <div class="coll-hero">
      <div id="coll-map"></div>
      <div class="coll-hero-body">
        <div class="coll-hero-title">{{ data.title | default(data.id) }}</div>
        <div class="coll-hero-desc">{{ data.description }}</div>
        <div class="coll-hero-tags">
          {% for kw in data.keywords %}<span class="coll-hero-tag">{{ kw }}</span>{% endfor %}
        </div>
      </div>
    </div>

    <!-- Browse CTA -->
    <a class="browse-btn" href="{{ config.server.url }}/collections/{{ data.id }}/items">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      Browse collections
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>

    <!-- URL examples -->
    <div class="url-block">
      <div style="font-size:0.85rem;font-weight:700;color:#475569;margin-bottom:0.85rem;display:flex;align-items:center;gap:0.4rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        Usage examples
      </div>
      <div class="url-row">
        <span class="url-label">QGIS</span>
        <span class="url-code" id="url-qgis">{{ config.server.url }}/collections/{{ data.id }}/items?f=json</span>
        <button class="url-copy" onclick="copyUrl('url-qgis')" title="Copy">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
      </div>
      <div class="url-row">
        <span class="url-label">ArcGIS Online</span>
        <span class="url-code" id="url-arcgis">{{ config.server.url }}/collections/{{ data.id }}/items</span>
        <button class="url-copy" onclick="copyUrl('url-arcgis')" title="Copy">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
      </div>
      <div class="url-row">
        <span class="url-label">JSON</span>
        <span class="url-code" id="url-json">{{ config.server.url }}/collections/{{ data.id }}?f=json</span>
        <button class="url-copy" onclick="copyUrl('url-json')" title="Copy">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
      </div>
    </div>

  </div>

  <!-- Sidebar -->
  <div class="col-lg-4">
    <div class="sidebar-card">
      <div class="sidebar-card-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        About this collection
      </div>
      <div class="sidebar-row">
        <span class="sidebar-key">Type</span>
        <span class="sidebar-val">{{ data.itemType | default('feature') | capitalize }}</span>
      </div>
      {% if data.extent and data.extent.spatial and data.extent.spatial.bbox %}
      <div class="sidebar-row">
        <span class="sidebar-key">Extent</span>
        <span class="sidebar-val" style="font-size:0.75rem;font-family:monospace;">{{ data.extent.spatial.bbox[0] | join(', ') }}</span>
      </div>
      {% endif %}
      {% if data.crs %}
      <div class="sidebar-row">
        <span class="sidebar-key">CRS</span>
        <span class="sidebar-val">{{ data.crs[0] | replace('http://www.opengis.net/def/crs/EPSG/0/', 'EPSG:') | replace('http://www.opengis.net/def/crs/OGC/1.3/CRS84', 'CRS84') }}</span>
      </div>
      {% endif %}
      <div class="sidebar-row" style="margin-top:0.5rem;padding-top:0.9rem;border-top:1px solid #e2e8f0;flex-wrap:wrap;gap:0.5rem;">
        <a href="{{ config.server.url }}/collections/{{ data.id }}/queryables" style="font-size:0.83rem;color:var(--brand);font-weight:600;">Queryables &rarr;</a>
        <a href="{{ config.server.url }}/collections/{{ data.id }}/schema" style="font-size:0.83rem;color:var(--brand);font-weight:600;">Schema &rarr;</a>
      </div>
    </div>
  </div>
</div>
{% endblock %}

{% block extrafoot %}
<script>
  function copyUrl(id) {
    var el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(function() {
      el.style.background = '#dcfce7';
      setTimeout(function() { el.style.background = ''; }, 1200);
    });
  }
  document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('coll-map', { zoomControl: false, attributionControl: false }).setView([0, 0], 1);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(map);
    {% if data.extent and data.extent.spatial and data.extent.spatial.bbox %}
      var bbox = {{ data.extent.spatial.bbox[0] | tojson }};
      var sw = [bbox[1], bbox[0]], ne = [bbox[3], bbox[2]];
      var brandColor = '#6366f1';
      L.rectangle([sw, ne], { color: brandColor, weight: 2, fillOpacity: 0.15 }).addTo(map);
      map.fitBounds([sw, ne], { padding: [8, 8] });
    {% endif %}
  });
</script>
{% endblock %}`;
}

export function generateIndexHtml(model: DataModel): string {
  return `{% extends "_base.html" %}
{% block title %}{{ super() }} - Home{% endblock %}
{% block body %}
<style>
  .hero-sec { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2.5rem; gap:2rem; }
  .hero-text { flex:1; max-width:700px; }
  .hero-title { font-size:2.25rem; font-weight:800; letter-spacing:-0.03em; margin-bottom:1rem; color:#6366f1; }
  .hero-desc { font-size:1.05rem; color:#475569; line-height:1.6; margin-bottom:1.5rem; }
  .hero-graphic { flex-shrink:0; width:160px; height:auto; opacity:0.8; }
  
  .cta-card { background:#f1f5f9; border:1px solid #cbd5e1; border-radius:var(--radius); padding:1.5rem; margin-bottom:2rem; transition:all 0.2s; text-decoration:none; display:flex; align-items:center; gap:1.25rem; color:inherit; }
  .cta-card:hover { background:#e2e8f0; border-color:#94a3b8; box-shadow:0 4px 12px rgba(0,0,0,0.06); text-decoration:none; color:inherit; transform:translateY(-2px); }
  .cta-icon { width:52px; height:52px; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:#0f172a; }
  .cta-body { flex:1; }
  .cta-title { font-weight:600; font-size:1.15rem; color:#6366f1; margin-bottom:0.15rem; }
  .cta-desc { font-size:0.95rem; color:#475569; }
  .cta-arrow { color:#6366f1; opacity:0.6; }
  .cta-card:hover .cta-arrow { opacity:1; }
  
  .api-block { border:1px solid #cbd5e1; border-radius:var(--radius); padding:0; margin-bottom:2rem; overflow:hidden; }
  .api-header { padding:1.25rem 1.5rem; display:flex; align-items:center; gap:0.6rem; font-weight:600; color:#0f172a; font-size:1.05rem; padding-bottom:0.5rem; border-bottom:none; }
  .api-content { padding:1.5rem; padding-top:0.5rem; }
  
  .api-url-box { display:flex; align-items:center; background:#e2e8f0; border-radius:0.5rem; margin-bottom:1.5rem; }
  .api-url-text { flex:1; padding:0.85rem 1rem; font-family:monospace; font-size:0.9rem; color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .api-url-btn { background:none; border:none; padding:0 1.25rem; color:var(--brand); cursor:pointer; font-weight:600; transition:color 0.15s; height:100%; display:flex; align-items:center; justify-content:center; }
  .api-url-btn:hover { color:#000; }
  
  .api-links { list-style:none; padding:0; margin:0; }
  .api-links a { display:flex; justify-content:space-between; align-items:center; padding:0.85rem 0; color:var(--brand); font-weight:400; text-decoration:none; font-size:1.1rem; border-bottom:none; transition:opacity 0.15s; }
  .api-links a:hover { opacity:0.75; text-decoration:none; }
  
  .sidebar-card { background:#fff; border:1px solid #e2e8f0; border-radius:var(--radius); box-shadow:var(--shadow-sm); padding:1.5rem; margin-bottom:1.5rem; }
  .sidebar-title { font-size:0.95rem; font-weight:700; color:#0f172a; margin-bottom:1.25rem; display:flex; align-items:center; gap:0.5rem; border-bottom:2px solid #f1f5f9; padding-bottom:0.75rem; }
  .meta-grid { display:grid; grid-template-columns:100px 1fr; gap:0.75rem 0; font-size:0.85rem; margin-bottom:1.5rem; }
  .meta-lbl { color:#64748b; font-weight:500; }
  .meta-val { color:#0f172a; font-weight:600; }
  .tags-wrap { display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.2rem; }
  .tag-pill { background:#e0e7ff; color:#4338ca; border-radius:999px; padding:0.15rem 0.6rem; font-size:0.75rem; font-weight:600; }
  
  .contact-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:0.5rem; padding:1rem; }
  .contact-hdr { font-weight:700; font-size:0.85rem; color:#475569; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.5rem; cursor:pointer; }
  .contact-row { margin-bottom:0.65rem; }
  .contact-row:last-child { margin-bottom:0; }
  .contact-lbl { display:block; font-size:0.75rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.15rem; }
  .contact-val { font-size:0.85rem; color:var(--brand); word-break:break-all; }
</style>

<div class="row">
  <div class="col-lg-8 pe-lg-5">
    
    <div class="hero-sec">
      <div class="hero-text">
        <div class="hero-title">{{ config.metadata.identification.title }}</div>
        <div class="hero-desc">{{ config.metadata.identification.description }}</div>
      </div>
      <div class="hero-graphic">
        <!-- Abstract network/dataset graphic representing the collections -->
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" stroke="var(--brand)" stroke-width="4" stroke-opacity="0.2" fill="var(--brand)" fill-opacity="0.05"/>
          <circle cx="50" cy="50" r="15" stroke="var(--brand)" stroke-width="4" fill="#fff"/>
          <circle cx="50" cy="50" r="5" fill="var(--brand)"/>
          <circle cx="25" cy="35" r="8" stroke="var(--brand)" stroke-width="3" fill="#fff"/>
          <circle cx="75" cy="35" r="8" stroke="var(--brand)" stroke-width="3" fill="#fff"/>
          <circle cx="25" cy="65" r="8" stroke="var(--brand)" stroke-width="3" fill="#fff"/>
          <circle cx="75" cy="65" r="8" stroke="var(--brand)" stroke-width="3" fill="#fff"/>
          <line x1="40" y1="45" x2="33" y2="40" stroke="var(--brand)" stroke-width="3"/>
          <line x1="60" y1="45" x2="67" y2="40" stroke="var(--brand)" stroke-width="3"/>
          <line x1="40" y1="55" x2="33" y2="60" stroke="var(--brand)" stroke-width="3"/>
          <line x1="60" y1="55" x2="67" y2="60" stroke="var(--brand)" stroke-width="3"/>
        </svg>
      </div>
    </div>

    <a href="{{ config.server.url }}/collections" class="cta-card">
      <div class="cta-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      </div>
      <div class="cta-body">
        <div class="cta-title">Browse collections</div>
        <div class="cta-desc">Browse through the default collections exposed by this API</div>
      </div>
      <div class="cta-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </a>

    <div class="api-block">
      <div class="api-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        Use the API
      </div>
      <div class="api-content">
        <div class="api-url-box">
          <div class="api-url-text" id="api-base-url">{{ config.server.url }}</div>
          <button class="api-url-btn" onclick="copyApiUrl()" title="Copy API URL">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
        
        <ul class="api-links">
          <li>
            <a href="{{ config.server.url }}/openapi?f=html">
              <span>Swagger UI</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
          </li>
          <li>
            <a href="{{ config.server.url }}/openapi?f=json">
              <span>OpenAPI Document</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
          </li>
          <li>
            <a href="{{ config.server.url }}/conformance">
              <span>Conformance</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
          </li>
        </ul>
      </div>
    </div>

  </div>
  
  <div class="col-lg-4">
    <div class="sidebar-card">
      <div class="sidebar-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Info about dataset
      </div>
      
      <div class="meta-grid">
        <div class="meta-lbl">Provider</div>
        <div class="meta-val">{{ config.metadata.provider.organization | default('System') }}</div>
        
        <div class="meta-lbl">License</div>
        <div class="meta-val">
          {% if config.metadata.license.url %}
            <a href="{{ config.metadata.license.url }}" target="_blank" style="color:var(--brand)">{{ config.metadata.license.name | default('Unknown') }}</a>
          {% else %}
            {{ config.metadata.license.name | default('Unknown') }}
          {% endif %}
        </div>
        
        <div class="meta-lbl">Keywords</div>
        <div class="meta-val">
          <div class="tags-wrap">
            {% for kw in config.metadata.identification.keywords %}
              <span class="tag-pill">{{ kw }}</span>
            {% endfor %}
          </div>
        </div>
      </div>
      
      {% if config.metadata.contact.url or config.metadata.contact.email %}
      <div class="contact-box">
        <div class="contact-hdr">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Contact Info
        </div>
        
        {% if config.metadata.contact.url %}
        <div class="contact-row">
          <span class="contact-lbl">URL</span>
          <a class="contact-val" href="{{ config.metadata.contact.url }}" target="_blank">{{ config.metadata.contact.url }}</a>
        </div>
        {% endif %}
        
        {% if config.metadata.contact.email %}
        <div class="contact-row">
          <span class="contact-lbl">E-mail</span>
          <a class="contact-val" href="mailto:{{ config.metadata.contact.email }}">{{ config.metadata.contact.email }}</a>
        </div>
        {% endif %}
        
        {% if config.metadata.provider.name %}
        <div class="contact-row">
          <span class="contact-lbl">Contact person</span>
          <span class="contact-val">{{ config.metadata.provider.name }}</span>
        </div>
        {% endif %}
      </div>
      {% endif %}
      
    </div>
  </div>
</div>
{% endblock %}

{% block extrafoot %}
<script>
  function copyApiUrl() {
    var el = document.getElementById('api-base-url');
    var btn = document.querySelector('.api-url-btn');
    if (!el || !btn) return;
    navigator.clipboard.writeText(el.textContent).then(function() {
      var origColor = btn.style.color;
      btn.style.color = '#10b981'; // green
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
      setTimeout(function() { 
        btn.style.color = origColor; 
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 1500);
    });
  }
</script>
{% endblock %}`;
}

export function generateItemHtml(_model: DataModel): string {
  return `{% extends "_base.html" %}
{% set ptitle = data['properties'][data['title_field']] or data['id'] | string %}
{% block title %}{{ super() }} - {{ ptitle }}{% endblock %}
{% block crumbs %}
  {{ super() }} /
  <a href="{{ data['collections_path'] }}">Collections</a>
  {% for link in data['links'] %}
    {% if link.rel == 'collection' %}
       / <a href="{{ link['href'] }}">{{ link['title'] | truncate(25) }}</a>
    {% endif %}
  {% endfor %}
  / <a href="../items">Items</a>
  / <span>{{ ptitle | truncate(25) }}</span>
{% endblock %}
{% block body %}
<style>
  .item-card { background:#fff; border:1px solid #e2e8f0; border-radius:var(--radius); box-shadow:var(--shadow-sm); overflow:hidden; }
  .item-header { padding:1.25rem 1.5rem; border-bottom:1px solid #f1f5f9; background:#f8fafc; }
  .item-title { font-size:1.15rem; font-weight:800; color:#0f172a; margin:0; }
  .item-map { height:350px; border-bottom:1px solid #f1f5f9; }
  .item-prop-table { width:100%; border-collapse:collapse; }
  .item-prop-table th { width:200px; background:#f8fafc; color:#64748b; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:700; padding:0.75rem 1.25rem; text-align:left; border-bottom:1px solid #f1f5f9; }
  .item-prop-table td { padding:0.75rem 1.25rem; font-size:0.875rem; color:#334155; border-bottom:1px solid #f1f5f9; word-break:break-word; }
  .item-prop-table tbody tr:hover { background:#f8fafc; }
  .nav-btn { display:inline-flex; align-items:center; gap:0.35rem; padding:0.4rem 0.85rem; background:#fff; color:#6366f1; border:1px solid #c7d2fe; border-radius:0.5rem; font-size:0.82rem; font-weight:600; text-decoration:none; transition:all 0.15s; }
  .nav-btn:hover { background:#eef2ff; text-decoration:none; }
</style>

<div class="row g-4">
  <div class="col-lg-8">
    <div class="item-card">
      <div class="item-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 class="item-title">{{ ptitle }}</h2>
        <div class="d-flex gap-2" id="item-nav-top">
          <a href="#" class="nav-btn d-none" id="btn-prev-top">&larr; Prev</a>
          <a href="#" class="nav-btn d-none" id="btn-next-top">Next &rarr;</a>
          {% if data['prev'] %}
            <a href="./{{ data['prev'] }}" class="nav-btn">&larr; Prev (Data)</a>
          {% endif %}
          {% if data['next'] %}
            <a href="./{{ data['next'] }}" class="nav-btn">Next (Data) &rarr;</a>
          {% endif %}
        </div>
      </div>

      <div id="item-map" class="item-map"></div>

      <div class="table-responsive">
        <table class="item-prop-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>id</td>
              <td style="font-family:monospace; font-weight:600;">{{ data.id }}</td>
            </tr>
            {% for key, value in data['properties'].items() %}
            <tr>
              <td>{{ key }}</td>
              <td>{{ value }}</td>
            </tr>
            {% endfor %}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="col-lg-4">
    <div class="sidebar-card">
      <div class="sidebar-card-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        About this feature
      </div>

      <div class="sidebar-row">
        <span class="sidebar-key">Feature ID</span>
        <span class="sidebar-val" style="font-family:monospace;">{{ data.id }}</span>
      </div>

      {% for link in data['links'] %}
        {% if link.rel == 'collection' %}
        <div class="sidebar-row">
          <span class="sidebar-key">Collection</span>
          <span class="sidebar-val"><a href="{{ link['href'] }}" style="color:var(--brand)">{{ link['title'] }}</a></span>
        </div>
        {% endif %}
      {% endfor %}

      <div class="sidebar-row" style="margin-top:0.5rem; padding-top:0.75rem; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:0.5rem;">
        <a href="?f=json" style="font-size:0.83rem; color:var(--brand); font-weight:600;">GeoJSON &rarr;</a>
        <a href="../items" style="font-size:0.83rem; color:var(--brand); font-weight:600;">All Items &rarr;</a>
      </div>
    </div>

    <div class="sidebar-card" style="margin-top:1rem;" id="sidebar-nav">
      <div class="sidebar-card-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Navigation
      </div>
      <div class="d-flex flex-column gap-2 pt-1">
        <a href="#" class="nav-btn w-100 justify-content-center d-none" id="btn-prev-side">&larr; Previous feature</a>
        <a href="#" class="nav-btn w-100 justify-content-center d-none" id="btn-next-side">Next feature &rarr;</a>
        {% if data['prev'] %}
          <a href="./{{ data['prev'] }}" class="nav-btn w-100 justify-content-center">&larr; Previous (Data)</a>
        {% endif %}
        {% if data['next'] %}
          <a href="./{{ data['next'] }}" class="nav-btn w-100 justify-content-center">Next (Data) &rarr;</a>
        {% endif %}
        <a href="../items" class="nav-btn w-100 justify-content-center mt-1" style="border-style:dashed; opacity:0.8;">Back to list</a>
      </div>
    </div>
  </div>
</div>
{% endblock %}

{% block extrafoot %}
<script>
  document.addEventListener('DOMContentLoaded', function() {
    var map = L.map('item-map').setView([0, 0], 1);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19
    }).addTo(map);

    var itemData = {{ data | to_json | safe }};
    if (itemData && itemData.geometry) {
      var brandColor = '#6366f1';
      var layer = L.geoJSON(itemData, {
        style: function() { return { color: brandColor, weight: 3, fillOpacity: 0.2 }; },
        pointToLayer: function(feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 8, fillColor: brandColor,
            color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9
          });
        }
      }).addTo(map);
      try { map.fitBounds(layer.getBounds(), { padding: [40, 40] }); } catch(e) {}
    }

    // --- Navigation Logic ---
    try {
      var currentId = "{{ data.id }}";
      var context = JSON.parse(sessionStorage.getItem('gf_items_context') || 'null');
      
      if (context && context.ids) {
        var ids = context.ids;
        var idx = ids.indexOf(currentId);
        
        if (idx !== -1) {
          if (idx > 0) {
            setupBtn('btn-prev-top', ids[idx-1]);
            setupBtn('btn-prev-side', ids[idx-1]);
          }
          if (idx < ids.length - 1) {
            setupBtn('btn-next-top', ids[idx+1]);
            setupBtn('btn-next-side', ids[idx+1]);
          }
        }
      }
    } catch (e) {
      console.warn('Navigation setup failed', e);
    }

    function setupBtn(id, targetId) {
      var el = document.getElementById(id);
      if (el) {
        el.href = './' + targetId;
        el.classList.remove('d-none');
      }
    }
  });
</script>
{% endblock %}`;
}
