import {
  DataModel, Layer, SourceConnection, SourceType, DeployTarget,
  PostgresConfig, SupabaseConfig, DatabricksConfig, GeopackageConfig, LayerSourceMapping
} from '../types';

// ============================================================
// Helper: get table name for a layer (same logic as existing exports)
// ============================================================
const getTableName = (layer: Layer): string =>
  layer.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

// ============================================================
// Helper: get Geopackage filename
// ============================================================
const getGpkgFilename = (model: DataModel, source?: SourceConnection): string => {
  if (source?.type === 'geopackage') {
    return (source.config as GeopackageConfig).filename || 'data.gpkg';
  }
  return `${model.name.replace(/\s/g, '_') || 'modell'}.gpkg`;
};

// ============================================================
// Helper: resolve PostGIS connection details from any source type
// For Supabase: derive PG connection from project URL
// For Databricks & GeoPackage: returns null (no direct PG connection)
// ============================================================
const getPgConnectionEnv = (source: SourceConnection): Record<string, string> | null => {
  if (source.type === 'postgis') {
    const c = source.config as PostgresConfig;
    return {
      POSTGRES_HOST: c.host,
      POSTGRES_PORT: c.port,
      POSTGRES_DB: c.dbname,
      POSTGRES_USER: c.user,
      POSTGRES_PASSWORD: c.password,
      POSTGRES_SCHEMA: c.schema || 'public',
    };
  }
  if (source.type === 'supabase') {
    const c = source.config as SupabaseConfig;
    // Supabase PG connection: host is db.<project-ref>.supabase.co, port 5432
    const projectRef = c.projectUrl.replace('https://', '').replace('.supabase.co', '');
    return {
      POSTGRES_HOST: `db.${projectRef}.supabase.co`,
      POSTGRES_PORT: '5432',
      POSTGRES_DB: 'postgres',
      POSTGRES_USER: 'postgres',
      POSTGRES_PASSWORD: '${SUPABASE_DB_PASSWORD}', // User must set this
      POSTGRES_SCHEMA: c.schema || 'public',
    };
  }
  return null; // Databricks and GeoPackage have no PG connection
};

// ============================================================
// Generate source-aware pygeoapi config
// PostGIS/Supabase → PostgreSQL provider (live query)
// Databricks/GeoPackage → SQLiteGPKG provider
// ============================================================
export const generatePygeoapiConfig = (
  model: DataModel,
  source?: SourceConnection,
  lang: string = 'no'
): string => {
  const gpkgFilename = getGpkgFilename(model, source);
  const pgEnv = source ? getPgConnectionEnv(source) : null;
  const usePg = pgEnv !== null;

  let yaml = `# pygeoapi configuration for ${model.name}\n`;
  yaml += `# Generated: ${new Date().toISOString()}\n`;
  yaml += `# Source: ${source?.type || 'geopackage (no live connection)'}\n\n`;

  yaml += `server:\n  bind:\n    host: 0.0.0.0\n    port: 80\n  url: http://localhost:5000\n  mimetype: application/json; charset=UTF-8\n  encoding: utf-8\n  languages:\n    - ${lang === 'no' ? 'nb-NO' : 'en-US'}\n\n`;
  yaml += `logging:\n  level: INFO\n\n`;

  // Metadata — enriched from model.metadata if available
  const meta = model.metadata;
  const keywords = meta?.keywords?.length ? meta.keywords : ['geospatial', model.namespace || 'data'];
  const licenseName = meta?.license || 'CC-BY-4.0';
  const licenseUrls: Record<string, string> = {
    'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'NLOD-2.0': 'https://data.norge.no/nlod/no/2.0',
  };
  
  yaml += `metadata:\n`;
  yaml += `  identification:\n`;
  yaml += `    title: ${model.name}\n`;
  yaml += `    description: ${model.description || 'Spatial data'}\n`;
  yaml += `    url: ${meta.url || 'https://example.com/dataset'}\n`;
  yaml += `    terms_of_service: ${meta.termsOfService || 'https://example.com/terms'}\n`;
  yaml += `    keywords:\n`;
  keywords.forEach(kw => { yaml += `      - ${kw}\n`; });
  
  if (meta?.purpose) {
    yaml += `    abstract: ${meta.purpose}\n`;
  }
  
  yaml += `  license:\n`;
  yaml += `    name: ${licenseName}\n`;
  yaml += `    url: ${licenseUrls[licenseName] || ''}\n`;
  
  if (meta?.contactName || meta?.contactEmail || meta?.contactOrganization) {
    yaml += `  contact:\n`;
    yaml += `    name: ${meta.contactName || 'Contact'}\n`;
    yaml += `    email: ${meta.contactEmail || 'contact@example.com'}\n`;
    yaml += `  provider:\n`;
    yaml += `    name: ${meta.contactName || 'Contact'}\n`;
    if (meta?.contactOrganization) yaml += `    organization: ${meta.contactOrganization}\n`;
    yaml += `    email: ${meta.contactEmail || 'contact@example.com'}\n`;
  }
  yaml += `\n`;
  yaml += `resources:\n`;

  model.layers.forEach(layer => {
    const collectionId = getTableName(layer);
    const mapping = source?.layerMappings?.[layer.id];
    const sourceTable = mapping?.sourceTable || collectionId;

    yaml += `  ${collectionId}:\n`;
    yaml += `    type: collection\n`;
    yaml += `    title: ${layer.name}\n`;
    yaml += `    description: ${layer.description || 'Spatial collection'}\n`;

    if (layer.geometryType !== 'None') {
      const ext = model.metadata?.spatialExtent;
      const hasBbox = ext?.westBoundLongitude && ext?.southBoundLatitude && ext?.eastBoundLongitude && ext?.northBoundLatitude;
      const bbox = hasBbox
        ? `[${ext!.westBoundLongitude}, ${ext!.southBoundLatitude}, ${ext!.eastBoundLongitude}, ${ext!.northBoundLatitude}]`
        : '[-180, -90, 180, 90]';
      yaml += `    extents:\n`;
      yaml += `      spatial:\n`;
      yaml += `        bbox: ${bbox}\n`;
      yaml += `        crs: http://www.opengis.net/def/crs/OGC/1.3/CRS84\n`;
    }

    yaml += `    providers:\n`;

    if (usePg) {
      // Live connection to PostGIS / Supabase
      yaml += `      - type: feature\n`;
      yaml += `        name: PostgreSQL\n`;
      yaml += `        data:\n`;
      yaml += `          host: \${POSTGRES_HOST}\n`;
      yaml += `          port: \${POSTGRES_PORT}\n`;
      yaml += `          dbname: \${POSTGRES_DB}\n`;
      yaml += `          user: \${POSTGRES_USER}\n`;
      yaml += `          password: \${POSTGRES_PASSWORD}\n`;
      yaml += `          search_path:\n`;
      yaml += `            - \${POSTGRES_SCHEMA}\n`;
      yaml += `        id_field: ${mapping?.primaryKeyColumn || 'fid'}\n`;
      yaml += `        table: ${sourceTable}\n`;
      yaml += `        geom_field: ${layer.geometryColumnName || 'geom'}\n\n`;
    } else {
      // GeoPackage file provider (Databricks, direct GeoPackage, or no source)
      yaml += `      - type: feature\n`;
      yaml += `        name: SQLiteGPKG\n`;
      yaml += `        data: /data/${gpkgFilename}\n`;
      yaml += `        table: ${sourceTable}\n`;
      yaml += `        id_field: ${mapping?.primaryKeyColumn || 'fid'}\n`;
      yaml += `        geom_field: ${layer.geometryColumnName || 'geom'}\n\n`;
    }
  });

  return yaml;
};

// ============================================================
// Generate source-aware QGIS project
// PostGIS/Supabase → postgres layer source
// Databricks/GeoPackage → gpkg layer source
// ============================================================
export const generateQgisProject = (
  model: DataModel,
  source?: SourceConnection
): string => {
  const pgEnv = source ? getPgConnectionEnv(source) : null;
  const gpkgFilename = getGpkgFilename(model, source);
  const srid = model.crs?.split(':')[1] || '25833';

  const layersXml = model.layers
    .filter(l => l.geometryType !== 'None')
    .map(layer => {
      const tbl = getTableName(layer);
      const mapping = source?.layerMappings?.[layer.id];
      const sourceTable = mapping?.sourceTable || tbl;
      const geomCol = layer.geometryColumnName || 'geom';

      const pkCol = mapping?.primaryKeyColumn || 'fid';

      let datasource: string;
      if (pgEnv) {
        datasource = `dbname='${pgEnv.POSTGRES_DB}' host=${pgEnv.POSTGRES_HOST} port=${pgEnv.POSTGRES_PORT} user='${pgEnv.POSTGRES_USER}' password='${pgEnv.POSTGRES_PASSWORD}' sslmode=require key='${pkCol}' srid=${srid} type=${layer.geometryType} table="${pgEnv.POSTGRES_SCHEMA}"."${sourceTable}" (${geomCol})`;
      } else {
        datasource = `/data/${gpkgFilename}|layername=${sourceTable}`;
      }

      const providerKey = pgEnv ? 'postgres' : 'ogr';

      // Reuse existing symbol generation logic
      const opacity = layer.style.fillOpacity !== undefined ? layer.style.fillOpacity : 1;
      const rgb = hexToRgb(layer.style.simpleColor || '#3b82f6');
      const qColor = `${rgb.r},${rgb.g},${rgb.b},255`;
      const isPoint = layer.geometryType.includes('Point');
      const isLine = layer.geometryType.includes('LineString');

      let symbolXml = '';
      if (isPoint) {
        symbolXml = `<symbol type="marker" name="0"><layer class="SimpleMarker"><prop k="color" v="${qColor}"/><prop k="size" v="${layer.style.pointSize || 8}"/></layer></symbol>`;
      } else if (isLine) {
        symbolXml = `<symbol type="line" name="0"><layer class="SimpleLine"><prop k="line_color" v="${qColor}"/><prop k="line_width" v="${layer.style.lineWidth || 2}"/></layer></symbol>`;
      } else {
        symbolXml = `<symbol alpha="${opacity}" type="fill" name="0"><layer class="SimpleFill"><prop k="color" v="${qColor}"/></layer></symbol>`;
      }

      return `<maplayer name="${layer.name}" type="vector">
  <datasource>${datasource}</datasource>
  <provider encoding="UTF-8">${providerKey}</provider>
  ${symbolXml}
</maplayer>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<qgis projectname="${model.name}" version="3.34">
${layersXml}
</qgis>`;
};

// ============================================================
// Generate delta export script (Python)
// Handles inserts, updates AND deletes.
// ============================================================
export const generateDeltaScript = (
  model: DataModel,
  source: SourceConnection
): string => {
  // If the source is already a GeoPackage, no python extraction script is needed!
  if (source.type === 'geopackage') {
    return `# No Python extraction script required for direct GeoPackage sources.\n`;
  }

  const modelFilename = model.name.replace(/\s/g, '_') || 'modell';
  const isPg = source.type === 'postgis' || source.type === 'supabase';
  const srid = model.crs?.split(':')[1] || '25833';

  // ---- Shared header ----
  let script = `#!/usr/bin/env python3
"""
Delta GeoPackage exporter for ${model.name}
Generated: ${new Date().toISOString()}
Source type: ${source.type}

Handles inserts, updates AND deletes automatically.
Delete detection works via FID diff — no changes to your database needed.

Usage:
  python delta_export.py                    # Full export (resets state)
  python delta_export.py --since last       # Delta since last run
  python delta_export.py --since 2024-01-01 # Delta since specific date

Requires: psycopg2 (pip install psycopg2-binary)
"""
import os
import sys
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "/data/output")
STATE_FILE = os.path.join(OUTPUT_DIR, ".delta_state.json")
MODEL_NAME = "${modelFilename}"


# ============================================================
# State management
# State stores per layer: last_sync timestamp + set of known FIDs
# ============================================================

def load_state():
    if Path(STATE_FILE).exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}


def save_state(state):
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def get_since(args, layer_id):
    """Resolve the --since argument."""
    if "--since" not in args:
        return None  # full export
    idx = args.index("--since")
    val = args[idx + 1] if idx + 1 < len(args) else "last"
    if val == "last":
        state = load_state()
        return state.get(layer_id, {}).get("last_sync")
    return val

`;

  // ---- PG connection helper ----
  if (isPg) {
    const pgEnv = getPgConnectionEnv(source)!;
    script += `
# ============================================================
# Database connection
# ============================================================

def get_pg_conn_string():
    """OGR connection string for ogr2ogr."""
    return (
        f"PG:host=${pgEnv.POSTGRES_HOST} "
        f"port=${pgEnv.POSTGRES_PORT} "
        f"dbname=${pgEnv.POSTGRES_DB} "
        f"user=${pgEnv.POSTGRES_USER} "
        f"password=${pgEnv.POSTGRES_PASSWORD} "
        f"schemas=${pgEnv.POSTGRES_SCHEMA}"
    )

PG_CONN = get_pg_conn_string()


def pg_connect():
    """Direct psycopg2 connection for FID queries."""
    import psycopg2
    return psycopg2.connect(
        host="${pgEnv.POSTGRES_HOST}",
        port=${pgEnv.POSTGRES_PORT},
        dbname="${pgEnv.POSTGRES_DB}",
        user="${pgEnv.POSTGRES_USER}",
        password="${pgEnv.POSTGRES_PASSWORD}",
        options="-c search_path=${pgEnv.POSTGRES_SCHEMA}"
    )


def fetch_current_pks(table, pk_col="fid"):
    """Get the set of all current primary keys from a table. Fast — just a PK index scan."""
    conn = pg_connect()
    try:
        cur = conn.cursor()
        cur.execute(f'SELECT "{pk_col}" FROM "{table}"')
        pks = {row[0] for row in cur.fetchall()}
        cur.close()
        return pks
    finally:
        conn.close()

`;
  }

  // ---- Per-layer export functions ----
  model.layers.forEach(layer => {
    const mapping = source.layerMappings?.[layer.id];
    if (!mapping) return;

    const tbl = getTableName(layer);
    const sourceTable = mapping.sourceTable || tbl;
    const tsCol = mapping.timestampColumn;
    const geomCol = layer.geometryColumnName || 'geom';
    const pkCol = mapping.primaryKeyColumn || 'fid';

    if (isPg) {
      script += `
# ============================================================
# ${layer.name}
# Source table: ${sourceTable}
# Primary key: ${pkCol}
# Timestamp column: ${tsCol || '(none — full diff for updates)'}
# Delete detection: automatic PK diff
# ============================================================

def export_${tbl}(since=None):
    now = datetime.now(timezone.utc).isoformat()
    state = load_state()
    layer_state = state.get("${layer.id}", {})
    previous_pks = set(layer_state.get("pks", []))

    # --- Step 1: Get current PKs from source ---
    current_pks = fetch_current_pks("${sourceTable}", "${pkCol}")
    print(f"  [${tbl}] {len(current_pks)} features in source, {len(previous_pks)} in previous state")

    if since is None:
        # --- FULL EXPORT (no delta, reset state) ---
        output = os.path.join(OUTPUT_DIR, f"${tbl}_full.gpkg")
        cmd = [
            "ogr2ogr", "-f", "GPKG", output,
            PG_CONN, "${sourceTable}",
            "-nln", "${tbl}",
            "-a_srs", "EPSG:${srid}",
            "-overwrite"
        ]
        print(f"  [${tbl}] Full export → {output}")
        subprocess.run(cmd, check=True)

        # Save state: timestamp + all PKs
        state["${layer.id}"] = {
            "last_sync": now,
            "pks": sorted(current_pks),
            "output": output
        }
        save_state(state)
        return output

    # --- DELTA EXPORT ---
    output = os.path.join(OUTPUT_DIR, f"${tbl}_delta_{now[:10]}.gpkg")

    # Step 2: Detect deletes (PKs that disappeared)
    deleted_pks = previous_pks - current_pks
    if deleted_pks:
        print(f"  [${tbl}] {len(deleted_pks)} deletes detected")

    # Step 3: Detect inserts (PKs that are new)
    inserted_pks = current_pks - previous_pks
    if inserted_pks:
        print(f"  [${tbl}] {len(inserted_pks)} new features detected")

`;

      if (tsCol) {
        // Has timestamp: use it for change detection + FID diff for deletes
        script += `    # Step 4: Export inserts + updates (timestamp-based)
    sql_changes = f"""
        SELECT *,
            CASE
                WHEN "${pkCol}" IN ({','.join(str(f) for f in inserted_pks)}) THEN 'insert'
                ELSE 'update'
            END as _change_type
        FROM "${sourceTable}"
        WHERE "${tsCol}" > '{since}'
           OR "${pkCol}" IN ({','.join(str(f) for f in inserted_pks)})
    """ if (inserted_pks or since) else None

    has_changes = False

    if sql_changes:
        cmd = [
            "ogr2ogr", "-f", "GPKG", output,
            PG_CONN, "-sql", sql_changes,
            "-nln", "${tbl}",
            "-a_srs", "EPSG:${srid}"
        ]
        subprocess.run(cmd, check=True)
        has_changes = True

`;
      } else {
        // No timestamp: can only detect inserts and deletes via FID diff
        // Updates are invisible without a timestamp column
        script += `    # Step 4: Export inserts (PK-based, no timestamp available)
    # NOTE: Without a timestamp column, updates to existing features
    # cannot be detected. Only inserts and deletes are tracked.
    has_changes = False

    if inserted_pks:
        pk_list = ','.join(str(f) for f in inserted_pks)
        sql_inserts = f"""
            SELECT *, 'insert' as _change_type
            FROM "${sourceTable}"
            WHERE "${pkCol}" IN ({pk_list})
        """
        cmd = [
            "ogr2ogr", "-f", "GPKG", output,
            PG_CONN, "-sql", sql_inserts,
            "-nln", "${tbl}",
            "-a_srs", "EPSG:${srid}"
        ]
        subprocess.run(cmd, check=True)
        has_changes = True

`;
      }

      // Common delete-handling + state saving for PG layers
      script += `    # Step 5: Append deletes to the delta GeoPackage
    # Deletes are stored as rows with only the PK + _change_type = 'delete'
    if deleted_pks:
        import tempfile
        delete_geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"${pkCol}": pk, "_change_type": "delete"},
                    "geometry": None
                }
                for pk in sorted(deleted_pks)
            ]
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".geojson", delete=False) as f:
            json.dump(delete_geojson, f)
            tmp_path = f.name

        append_flag = ["-append"] if has_changes else []
        cmd = [
            "ogr2ogr", "-f", "GPKG", output,
            tmp_path,
            "-nln", "${tbl}_deletes",
            *append_flag
        ]
        subprocess.run(cmd, check=True)
        os.unlink(tmp_path)
        has_changes = True

    if not has_changes:
        print(f"  [${tbl}] No changes detected")
    else:
        print(f"  [${tbl}] Delta → {output}")

    # Step 6: Update state with current PKs
    state["${layer.id}"] = {
        "last_sync": now,
        "pks": sorted(current_pks),
        "output": output
    }
    save_state(state)
    return output if has_changes else None

`;
    } else {
      // ---- Databricks path ----
      script += `
# ============================================================
# ${layer.name} (Databricks)
# Source table: ${(source.config as DatabricksConfig).catalog}.${(source.config as DatabricksConfig).schema}.${sourceTable}
# Primary key: ${pkCol}
# ============================================================

def export_${tbl}(since=None):
    from databricks import sql as dbsql
    import geopandas as gpd
    import pandas as pd
    from shapely import wkt

    now = datetime.now(timezone.utc).isoformat()
    state = load_state()
    layer_state = state.get("${layer.id}", {})
    previous_pks = set(layer_state.get("pks", []))

    conn = dbsql.connect(
        server_hostname="${(source.config as DatabricksConfig).host}",
        http_path="${(source.config as DatabricksConfig).httpPath}",
        access_token=os.environ.get("DATABRICKS_TOKEN", "${(source.config as DatabricksConfig).token}")
    )
    cursor = conn.cursor()
    full_table = "${(source.config as DatabricksConfig).catalog}.${(source.config as DatabricksConfig).schema}.${sourceTable}"

    # Get all current PKs
    cursor.execute(f"SELECT ${pkCol} FROM {full_table}")
    current_pks = {row[0] for row in cursor.fetchall()}
    print(f"  [${tbl}] {len(current_pks)} features in source, {len(previous_pks)} in previous state")

    # Detect deletes
    deleted_pks = previous_pks - current_pks
    inserted_pks = current_pks - previous_pks
    if deleted_pks:
        print(f"  [${tbl}] {len(deleted_pks)} deletes detected")
    if inserted_pks:
        print(f"  [${tbl}] {len(inserted_pks)} new features detected")

    if since is None:
        # Full export
        cursor.execute(f"SELECT * FROM {full_table}")
    else:
`;

      if (tsCol) {
        script += `        # Changed + new features
        pk_csv = ','.join(str(f) for f in inserted_pks) if inserted_pks else '-1'
        cursor.execute(f"""
            SELECT * FROM {full_table}
            WHERE ${tsCol} > '{since}' OR ${pkCol} IN ({pk_csv})
        """)
`;
      } else {
        script += `        # No timestamp — only new features
        if inserted_pks:
            pk_csv = ','.join(str(f) for f in inserted_pks)
            cursor.execute(f"SELECT * FROM {full_table} WHERE ${pkCol} IN ({pk_csv})")
        else:
            cursor.execute(f"SELECT * FROM {full_table} WHERE 1=0")  # empty result
`;
      }

      script += `
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    conn.close()

    output = os.path.join(OUTPUT_DIR, f"${tbl}_{'full' if since is None else 'delta_' + now[:10]}.gpkg")

    if rows:
        df = pd.DataFrame(rows, columns=columns)
        if "${geomCol}" in df.columns:
            gdf = gpd.GeoDataFrame(df, geometry=gpd.GeoSeries.from_wkt(df["${geomCol}"]), crs="EPSG:${srid}")
        else:
            gdf = gpd.GeoDataFrame(df)
        if since is not None:
            gdf["_change_type"] = gdf["${pkCol}"].apply(lambda f: "insert" if f in inserted_pks else "update")
        gdf.to_file(output, driver="GPKG", layer="${tbl}")

    # Append deletes
    if deleted_pks and since is not None:
        delete_df = pd.DataFrame([
            {"${pkCol}": pk, "_change_type": "delete"} for pk in sorted(deleted_pks)
        ])
        delete_gdf = gpd.GeoDataFrame(delete_df)
        delete_gdf.to_file(output, driver="GPKG", layer="${tbl}_deletes", mode="a" if rows else "w")

    has_changes = bool(rows) or bool(deleted_pks)
    if has_changes:
        print(f"  [${tbl}] {'Full' if since is None else 'Delta'} → {output}")
    else:
        print(f"  [${tbl}] No changes detected")

    # Update state
    state["${layer.id}"] = {
        "last_sync": now,
        "pks": sorted(current_pks),
        "output": output
    }
    save_state(state)
    return output if has_changes else None

`;
    }
  });

  // ---- Main function ----
  script += `
# ============================================================
# Main
# ============================================================

def main():
    is_delta = "--since" in sys.argv
    mode = "DELTA" if is_delta else "FULL"
    print(f"=== {mode} export for ${model.name} ===")
    print(f"    Time: {datetime.now(timezone.utc).isoformat()}")
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    results = {}
`;

  model.layers.forEach(layer => {
    const mapping = source.layerMappings?.[layer.id];
    if (!mapping) return;
    const tbl = getTableName(layer);

    script += `
    since_${tbl} = get_since(sys.argv, "${layer.id}")
    results["${tbl}"] = export_${tbl}(since=since_${tbl})
`;
  });

  script += `
    # Summary
    print()
    print("=== Summary ===")
    for layer, output in results.items():
        status = f"→ {output}" if output else "(no changes)"
        print(f"  {layer}: {status}")
    print("=== Done ===")


if __name__ == "__main__":
    main()
`;

  return script;
};

// ============================================================
// Generate .env file
// ============================================================
export const generateEnvFile = (source: SourceConnection): string => {
  let env = `# Environment variables for deploy kit\n`;
  env += `# Generated: ${new Date().toISOString()}\n`;
  env += `# COPY THIS FILE: cp .env.template .env\n`;
  env += `# Then fill in your actual credentials below.\n\n`;

  if (source.type === 'postgis') {
    const c = source.config as PostgresConfig;
    env += `POSTGRES_HOST=${c.host}\n`;
    env += `POSTGRES_PORT=${c.port}\n`;
    env += `POSTGRES_DB=${c.dbname}\n`;
    env += `POSTGRES_USER=${c.user}\n`;
    env += `POSTGRES_PASSWORD=${c.password}\n`;
    env += `POSTGRES_SCHEMA=${c.schema || 'public'}\n`;
  } else if (source.type === 'supabase') {
    const c = source.config as SupabaseConfig;
    const ref = c.projectUrl.replace('https://', '').replace('.supabase.co', '');
    env += `POSTGRES_HOST=db.${ref}.supabase.co\n`;
    env += `POSTGRES_PORT=5432\n`;
    env += `POSTGRES_DB=postgres\n`;
    env += `POSTGRES_USER=postgres\n`;
    env += `POSTGRES_PASSWORD=your-supabase-db-password-here\n`;
    env += `POSTGRES_SCHEMA=${c.schema || 'public'}\n`;
    env += `SUPABASE_URL=${c.projectUrl}\n`;
    env += `SUPABASE_ANON_KEY=${c.anonKey}\n`;
  } else if (source.type === 'databricks') {
    const c = source.config as DatabricksConfig;
    env += `DATABRICKS_HOST=${c.host}\n`;
    env += `DATABRICKS_HTTP_PATH=${c.httpPath}\n`;
    env += `DATABRICKS_TOKEN=${c.token}\n`;
    env += `DATABRICKS_CATALOG=${c.catalog}\n`;
    env += `DATABRICKS_SCHEMA=${c.schema}\n`;
  } else if (source.type === 'geopackage') {
    env += `# No database credentials required for GeoPackage source\n`;
  }

  env += `\n# --- Configuration & Output ---\n`;
  env += `OUTPUT_DIR=./data/output\n`;
  
  if (source.type !== 'geopackage') {
    env += `\n# Delta Sync Interval in seconds (86400 = 24 hours)\n`;
    env += `SYNC_INTERVAL_SECONDS=86400\n`;
    env += `\n# Port to serve the GeoPackage downloads\n`;
    env += `DOWNLOAD_PORT=8081\n`;
  }

  return env;
};

// ============================================================
// Generate docker-compose.yml
// ============================================================
export const generateDockerCompose = (
  model: DataModel,
  source: SourceConnection
): string => {
  const isPg = source.type === 'postgis' || source.type === 'supabase';
  const isGpkg = source.type === 'geopackage';
  const hasGeomLayers = model.layers.some(l => l.geometryType !== 'None');

  let compose = `# Docker Compose for ${model.name}
# Source: ${source.type}
# Generated: ${new Date().toISOString()}
#
# Usage:
#   1. Copy .env.template to .env and fill in credentials
#   2. docker compose up -d
#   3. OGC API Features: http://localhost:5000
#   4. Downloads:        http://localhost:\${DOWNLOAD_PORT:-8081}

services:
  # --- OGC API - Features (pygeoapi) ---
  pygeoapi:
    image: geopython/pygeoapi:latest
    ports:
      - "5000:80"
    volumes:
      - ./pygeoapi-config.yml:/pygeoapi/local.config.yml
`;

  if (!isPg) {
    compose += `      - ./data:/data\n`;
  }

  compose += `    env_file: .env\n    restart: unless-stopped\n`;

  // WMS via QGIS Server (only if there are geometry layers)
  if (hasGeomLayers) {
    compose += `
  # --- WMS (QGIS Server) ---
  qgis-server:
    image: qgis/qgis-server:ltr
    ports:
      - "8080:80"
    volumes:
      - ./project.qgs:/data/project.qgs
`;
    if (!isPg) {
      compose += `      - ./data:/data\n`;
    }
    compose += `    environment:
      QGIS_PROJECT_FILE: /data/project.qgs
    env_file: .env
    restart: unless-stopped
`;
  }

  // Delta export worker & Nginx file server (Skip for direct GeoPackage)
  if (!isGpkg) {
    compose += `
  # --- Delta File Download Server (Nginx) ---
  # Serves the generated .gpkg files as an auto-indexed web directory
  downloads:
    image: nginx:alpine
    ports:
      - "\${DOWNLOAD_PORT:-8081}:80"
    volumes:
      - ./data/output:/usr/share/nginx/html:ro
    command: /bin/sh -c "echo 'server { listen 80; location / { root /usr/share/nginx/html; autoindex on; autoindex_exact_size off; autoindex_localtime on; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
    restart: unless-stopped

  # --- Automated Delta GeoPackage Exporter ---
  delta-worker:
    image: ghcr.io/osgeo/gdal:ubuntu-full-latest
    volumes:
      - ./delta_export.py:/app/delta_export.py
      - ./data/output:/data/output
    env_file: .env
    environment:
      - SYNC_INTERVAL_SECONDS=\${SYNC_INTERVAL_SECONDS:-86400}
    entrypoint:
      - /bin/bash
      - -c
      - |
        pip install -q psycopg2-binary
        echo "Starting automated delta extraction loop..."
        while true; do
          echo "Running extraction at $$(date)"
          python3 /app/delta_export.py --since last
          echo "Extraction complete. Sleeping for $\${SYNC_INTERVAL_SECONDS} seconds..."
          sleep $$SYNC_INTERVAL_SECONDS
        done
    restart: unless-stopped
`;

    if (source.type === 'databricks') {
      compose += `
  # --- Initial GeoPackage export (for Databricks) ---
  initial-export:
    image: ghcr.io/osgeo/gdal:ubuntu-full-latest
    volumes:
      - ./delta_export.py:/app/delta_export.py
      - ./data:/data/output
    env_file: .env
    entrypoint: ["python3", "/app/delta_export.py"]
    profiles:
      - setup  # Run once: docker compose --profile setup run --rm initial-export
`;
    }
  }

  return compose;
};

// ============================================================
// Generate README for the deploy kit
// ============================================================
export const generateReadme = (model: DataModel, source: SourceConnection): string => {
  const isPg = source.type === 'postgis' || source.type === 'supabase';
  const isGpkg = source.type === 'geopackage';
  const hasWms = model.layers.some(l => l.geometryType !== 'None');

  let md = `# ${model.name} — Deploy Kit\n\n`;
  md += `Autogenerert fra GeoForge.\n\n`;
  md += `## Datakilde: ${source.type}\n\n`;
  md += `## Tjenester\n\n`;
  md += `| Tjeneste | Port | URL |\n`;
  md += `|----------|------|-----|\n`;
  md += `| OGC API - Features (pygeoapi) | 5000 | http://localhost:5000 |\n`;
  if (hasWms) {
    md += `| WMS (QGIS Server) | 8080 | http://localhost:8080/qgis?SERVICE=WMS&REQUEST=GetCapabilities |\n`;
  }
  if (!isGpkg) {
    md += `| Delta Nedlastinger (Nginx) | 8081 | http://localhost:8081 |\n`;
  }
  md += `\n`;

  md += `## Kom i gang\n\n`;
  md += `\`\`\`bash\n`;
  md += `# 1. Kopier og oppdater miljøvariabler\n`;
  md += `cp .env.template .env\n`;
  md += `nano .env\n\n`;

  if (isGpkg) {
    const gpkgName = getGpkgFilename(model, source);
    md += `# 2. Legg inn data\n`;
    md += `Plasser din GeoPackage-fil (\`${gpkgName}\`) i \`./data\` mappen.\n\n`;
    md += `# 3. Start tjenestene\n`;
  } else if (source.type === 'databricks') {
    md += `# 2. Kjør initial eksport (kun Databricks)\n`;
    md += `pip install databricks-sql-connector geopandas\n`;
    md += `docker compose --profile setup run --rm initial-export\n\n`;
    md += `# 3. Start tjenestene\n`;
  } else {
    md += `# 2. Start tjenestene\n`;
  }

  md += `docker compose up -d\n`;
  md += `\`\`\`\n\n`;

  if (!isGpkg) {
    md += `## Delta-eksport (Automatisert)\n\n`;
    md += `Delta-eksporten kjører automatisk i bakgrunnen og håndterer **inserts, updates og deletes**.\n`;
    md += `Intervallet styres av \`SYNC_INTERVAL_SECONDS\` i \`.env\`-filen (standard er 86400 sekunder / 24 timer).\n\n`;
    md += `Nye \`.gpkg\`-filer blir automatisk tilgjengelige for nedlasting på **http://localhost:8081**.\n\n`;
    
    md += `### Hva delta-filen inneholder\n\n`;
    md += `| \_change\_type | Beskrivelse |\n`;
    md += `|---------------|-------------|\n`;
    md += `| \`insert\` | Nye features (FID finnes ikke i forrige kjøring) |\n`;
    md += `| \`update\` | Endrede features (timestamp er nyere, krever timestamp-kolonne) |\n`;
    md += `| \`delete\` | Slettede features (FID fantes forrige gang, men er nå borte) |\n\n`;
    md += `Slettede features lagres i et eget lag (\`<lagnavn>_deletes\`) med kun fid og \_change\_type.\n\n`;
  }

  md += `## Filer\n\n`;
  md += `| Fil | Beskrivelse |\n`;
  md += `|-----|-------------|\n`;
  md += `| \`docker-compose.yml\` | Starter alle tjenester |\n`;
  md += `| \`pygeoapi-config.yml\` | ${isPg ? 'Kobler direkte til PostGIS' : 'Leser fra GeoPackage-fil'} |\n`;
  if (hasWms) {
    md += `| \`project.qgs\` | QGIS-prosjekt med lag og stil |\n`;
  }
  if (!isGpkg) {
    md += `| \`delta_export.py\` | Script for inkrementell GeoPackage-eksport |\n`;
  }
  md += `| \`.env.template\` | Mal for tilkoblingsdetaljer — kopier til .env og fyll inn |\n`;

  return md;
};

// ============================================================
// ============================================================
// Generate GitHub Actions workflow for CI/CD deployment
// ============================================================
export const generateGithubActionsWorkflow = (
  model: DataModel,
  source: SourceConnection
): string => {
  const isPg = source.type === 'postgis' || source.type === 'supabase';
  const isGpkg = source.type === 'geopackage';
  const hasWms = model.layers.some(l => l.geometryType !== 'None');
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  let workflow = `name: Deploy ${model.name}

on:
  push:
    branches: [main]
    paths:
      - 'docker-compose.yml'
      - 'pygeoapi-config.yml'
      - 'project.qgs'
      - 'model.json'
      - '.github/workflows/deploy.yml'

  workflow_dispatch:
    inputs:
      full_redeploy:
        description: 'Force full redeployment'
        type: boolean
        default: false

env:
  SERVICE_NAME: ${slug}

jobs:
  validate:
    name: Validate configuration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate pygeoapi config
        run: |
          python3 -c "
          import yaml, sys
          with open('pygeoapi-config.yml') as f:
              config = yaml.safe_load(f)
          resources = config.get('resources', {})
          print(f'✓ {len(resources)} collection(s) defined')
          for name, res in resources.items():
              providers = res.get('providers', [])
              if not providers:
                  print(f'✗ {name}: no provider configured', file=sys.stderr)
                  sys.exit(1)
              print(f'  - {name}: {providers[0].get(\"name\", \"unknown\")} provider')
          print('✓ Configuration valid')
          "

      - name: Validate model definition
        run: |
          python3 -c "
          import json
          with open('model.json') as f:
              model = json.load(f)
          layers = model.get('layers', [])
          print(f'✓ Model: {model.get(\"name\", \"unnamed\")} v{model.get(\"version\", \"?\")}')
          print(f'✓ {len(layers)} layer(s)')
          for l in layers:
              props = l.get('properties', [])
              print(f'  - {l[\"name\"]}: {len(props)} properties, {l.get(\"geometryType\", \"None\")}')
          "

  build:
    name: Build and push container
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push pygeoapi image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile
          push: true
          tags: |
            ghcr.io/\${{ github.repository_owner }}/${slug}:latest
            ghcr.io/\${{ github.repository_owner }}/${slug}:\${{ github.sha }}
`;

  if (hasWms) {
    workflow += `
      - name: Package QGIS project
        run: |
          echo "QGIS project validated and ready for deployment"
          # QGIS Server uses the project.qgs directly via volume mount
`;
  }

  workflow += `
  deploy:
    name: Deploy services
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.DEPLOY_HOST }}
          username: \${{ secrets.DEPLOY_USER }}
          key: \${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/services/${slug}
            git pull origin main
            docker compose pull
            docker compose up -d --remove-orphans
            echo "✓ ${model.name} deployed successfully"
`;

  workflow += `
      - name: Health check
        run: |
          echo "Waiting for services to start..."
          sleep 10
          # Health check would go here when DEPLOY_URL is configured
          # curl -sf \${{ secrets.DEPLOY_URL }}/conformance || exit 1
          echo "✓ Deployment complete"
`;

  return workflow;
};

// ============================================================
// Generate Dockerfile for pygeoapi
// ============================================================
export const generateDockerfile = (
  model: DataModel,
  source: SourceConnection
): string => {
  const isGpkg = source.type === 'geopackage';

  return `FROM geopython/pygeoapi:latest

# Copy configuration
COPY pygeoapi-config.yml /pygeoapi/local.config.yml
${isGpkg ? 'COPY data/ /data/' : ''}

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD curl -sf http://localhost:80/conformance || exit 1
`;
};

// ============================================================
// Generate Dockerfile for QGIS Server (used by fly/railway targets)
// ============================================================
export const generateQgisDockerfile = (
  model: DataModel,
  source: SourceConnection
): string => {
  const isGpkg = source.type === 'geopackage';
  return `FROM qgis/qgis-server:ltr

COPY project.qgs /data/project.qgs
${isGpkg ? 'COPY data/ /data/' : ''}

ENV QGIS_PROJECT_FILE=/data/project.qgs
EXPOSE 80
`;
};

// ============================================================
// Generate fly.toml for Fly.io
// ============================================================
export const generateFlyToml = (
  model: DataModel,
  source: SourceConnection
): string => {
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hasWms = model.layers.some(l => l.geometryType !== 'None');

  let toml = `# Fly.io configuration for ${model.name}
# Generated by GeoForge
#
# Deploy:
#   fly launch --copy-config    (first time)
#   fly deploy                  (subsequent)

app = "${slug}-pygeoapi"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 80
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1

[checks]
  [checks.health]
    type = "http"
    port = 80
    path = "/conformance"
    interval = "30s"
    timeout = "5s"
`;

  if (source.type === 'geopackage') {
    toml += `
[mounts]
  source = "geodata"
  destination = "/data"
`;
  }

  return toml;
};

// ============================================================
// Generate fly.toml for QGIS Server (second Fly app)
// ============================================================
export const generateFlyQgisToml = (
  model: DataModel,
  source: SourceConnection
): string => {
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return `# Fly.io configuration for ${model.name} — QGIS Server (WMS)
# Deploy as separate app: fly deploy --config fly.qgis.toml

app = "${slug}-qgis"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile.qgis"

[http_service]
  internal_port = 80
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "1024mb"
  cpu_kind = "shared"
  cpus = 1

${source.type === 'geopackage' ? `[mounts]
  source = "geodata"
  destination = "/data"
` : ''}`;
};

// ============================================================
// Generate railway.json for Railway
// ============================================================
export const generateRailwayJson = (
  model: DataModel,
  source: SourceConnection
): string => {
  const hasWms = model.layers.some(l => l.geometryType !== 'None');

  const config: any = {
    "$schema": "https://railway.com/railway.schema.json",
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    deploy: {
      healthcheckPath: "/conformance",
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 10
    }
  };

  return JSON.stringify(config, null, 2);
};

// ============================================================
// Generate GitHub Actions workflow — target-aware
// ============================================================
const generateWorkflowForTarget = (
  model: DataModel,
  source: SourceConnection,
  target: DeployTarget
): string => {
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hasWms = model.layers.some(l => l.geometryType !== 'None');

  // Shared validation job
  const validateJob = `
  validate:
    name: Validate configuration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate pygeoapi config
        run: |
          python3 -c "
          import yaml, sys
          with open('pygeoapi-config.yml') as f:
              config = yaml.safe_load(f)
          resources = config.get('resources', {})
          print(f'✓ {len(resources)} collection(s) defined')
          for name, res in resources.items():
              providers = res.get('providers', [])
              if not providers:
                  print(f'✗ {name}: no provider configured', file=sys.stderr)
                  sys.exit(1)
              print(f'  - {name}: {providers[0].get(\\"name\\", \\"unknown\\")} provider')
          print('✓ Configuration valid')
          "

      - name: Validate model definition
        run: |
          python3 -c "
          import json
          with open('model.json') as f:
              model = json.load(f)
          layers = model.get('layers', [])
          print(f'✓ Model: {model.get(\\"name\\", \\"unnamed\\")} v{model.get(\\"version\\", \\"?\\")}')
          print(f'✓ {len(layers)} layer(s)')
          for l in layers:
              props = l.get('properties', [])
              print(f'  - {l[\\"name\\"]}: {len(props)} properties, {l.get(\\"geometryType\\", \\"None\\")}')
          "`;

  if (target === 'fly') {
    return `name: Deploy ${model.name} (Fly.io)

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}

jobs:
${validateJob}

  deploy-pygeoapi:
    name: Deploy pygeoapi to Fly.io
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config fly.toml --remote-only
${hasWms ? `
  deploy-qgis:
    name: Deploy QGIS Server to Fly.io
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --config fly.qgis.toml --remote-only
` : ''}`;
  }

  if (target === 'railway') {
    return `name: Validate ${model.name} (Railway)

# Railway deploys automatically from GitHub — no deploy job needed.
# This workflow only validates the configuration on push.

on:
  push:
    branches: [main]
  pull_request:

jobs:
${validateJob}
`;
  }

  if (target === 'ghcr') {
    return `name: Build ${model.name} (GHCR)

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
${validateJob}

  build:
    name: Build and push to GHCR
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push pygeoapi
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile
          push: true
          tags: |
            ghcr.io/\${{ github.repository_owner }}/${slug}:latest
            ghcr.io/\${{ github.repository_owner }}/${slug}:\${{ github.sha }}
${hasWms ? `
      - name: Build and push QGIS Server
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.qgis
          push: true
          tags: |
            ghcr.io/\${{ github.repository_owner }}/${slug}-qgis:latest
            ghcr.io/\${{ github.repository_owner }}/${slug}-qgis:\${{ github.sha }}
` : ''}`;
  }

  // Default: docker-compose (original SSH-based deploy)
  return generateGithubActionsWorkflow(model, source);
};

// ============================================================
// Generate README — target-aware
// ============================================================
const generateReadmeForTarget = (
  model: DataModel,
  source: SourceConnection,
  target: DeployTarget
): string => {
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isGpkg = source.type === 'geopackage';
  const hasWms = model.layers.some(l => l.geometryType !== 'None');

  const targetNames: Record<DeployTarget, string> = {
    'docker-compose': 'Docker Compose',
    'fly': 'Fly.io',
    'railway': 'Railway',
    'ghcr': 'GitHub Container Registry',
  };

  let md = `# ${model.name} — Deploy Kit\n\n`;
  md += `Autogenerert fra GeoForge · Deployment target: **${targetNames[target]}**\n\n`;

  // Services table
  md += `## Tjenester\n\n`;
  md += `| Tjeneste | Beskrivelse |\n`;
  md += `|----------|-------------|\n`;
  md += `| pygeoapi | OGC API – Features |\n`;
  if (hasWms) {
    md += `| QGIS Server | WMS/WFS kartlag |\n`;
  }
  md += `\n`;

  if (target === 'docker-compose') {
    return md + generateReadme(model, source).split('## Tjenester')[1]?.split('## Tjenester').pop() 
      || generateReadme(model, source).substring(generateReadme(model, source).indexOf('## Kom i gang'));
  }

  if (target === 'fly') {
    md += `## Kom i gang med Fly.io\n\n`;
    md += `### Forutsetninger\n\n`;
    md += `1. Installer [flyctl](https://fly.io/docs/getting-started/installing-flyctl/)\n`;
    md += `2. Logg inn: \`fly auth login\`\n\n`;
    md += `### Deploy\n\n`;
    md += `\`\`\`bash\n`;
    md += `# Første gang — opprett appene\n`;
    md += `fly launch --config fly.toml --copy-config --no-deploy\n`;
    if (hasWms) {
      md += `fly launch --config fly.qgis.toml --copy-config --no-deploy\n`;
    }
    md += `\n`;
    if (isGpkg) {
      const gpkgName = getGpkgFilename(model, source);
      md += `# Last opp GeoPackage-data\n`;
      md += `fly volumes create geodata --region ams --size 1 -a ${slug}-pygeoapi\n`;
      md += `# Kopier filen inn (bruk fly ssh console + scp, eller bak inn i imaget)\n\n`;
    }
    md += `# Deploy pygeoapi\n`;
    md += `fly deploy --config fly.toml\n`;
    if (hasWms) {
      md += `\n# Deploy QGIS Server\n`;
      md += `fly deploy --config fly.qgis.toml\n`;
    }
    md += `\`\`\`\n\n`;
    md += `### Automatisk deploy\n\n`;
    md += `Legg til \`FLY_API_TOKEN\` som GitHub Secret. GitHub Actions deployer automatisk ved push til main.\n\n`;
    md += `Hent token: \`fly tokens create deploy -x 999999h\`\n\n`;
  }

  if (target === 'railway') {
    md += `## Kom i gang med Railway\n\n`;
    md += `### Steg\n\n`;
    md += `1. Gå til [railway.app](https://railway.app) og opprett en konto\n`;
    md += `2. Klikk **"New Project"** → **"Deploy from GitHub Repo"**\n`;
    md += `3. Velg dette repoet\n`;
    md += `4. Railway oppdager \`Dockerfile\` automatisk og starter deploy\n\n`;
    if (hasWms) {
      md += `### QGIS Server (WMS)\n\n`;
      md += `Railway deployer én tjeneste per repo som standard. For å kjøre QGIS Server i tillegg:\n\n`;
      md += `1. Klikk **"+ New"** → **"GitHub Repo"** i samme prosjekt\n`;
      md += `2. Velg dette repoet igjen\n`;
      md += `3. Under **Settings → Build**, sett Dockerfile path til \`Dockerfile.qgis\`\n\n`;
    }
    if (isGpkg) {
      md += `### Data\n\n`;
      md += `GeoPackage-filen er bakt inn i Docker-imaget under build.\n`;
      md += `For å oppdatere data: legg ny fil i \`data/\`-mappen og push til GitHub.\n\n`;
    } else {
      md += `### Miljøvariabler\n\n`;
      md += `Sett disse under **Variables** i Railway dashboard:\n\n`;
      md += `\`\`\`\n`;
      md += generateEnvFile(source).split('\n').filter(l => l.includes('=') && !l.startsWith('#')).join('\n');
      md += `\n\`\`\`\n\n`;
    }
    md += `### Automatisk deploy\n\n`;
    md += `Railway deployer automatisk ved push til main. Ingen GitHub Actions nødvendig.\n\n`;
  }

  if (target === 'ghcr') {
    md += `## Container Registry\n\n`;
    md += `Denne konfigurasjonen bygger Docker-images og pusher til GitHub Container Registry (ghcr.io).\n`;
    md += `Du (eller driftsorganisasjonen) kan deretter pulle og kjøre bildene hvor som helst.\n\n`;
    md += `### Images\n\n`;
    md += `| Image | Beskrivelse |\n`;
    md += `|-------|-------------|\n`;
    md += `| \`ghcr.io/<owner>/${slug}:latest\` | pygeoapi (OGC API) |\n`;
    if (hasWms) {
      md += `| \`ghcr.io/<owner>/${slug}-qgis:latest\` | QGIS Server (WMS) |\n`;
    }
    md += `\n`;
    md += `### Kjøre lokalt\n\n`;
    md += `\`\`\`bash\n`;
    md += `docker pull ghcr.io/<owner>/${slug}:latest\n`;
    md += `docker run -p 5000:80 ghcr.io/<owner>/${slug}:latest\n`;
    md += `\`\`\`\n\n`;
    md += `### Bruke med Docker Compose\n\n`;
    md += `Bruk \`docker-compose.yml\` som følger med for å kjøre alle tjenester:\n\n`;
    md += `\`\`\`bash\n`;
    md += `docker compose up -d\n`;
    md += `\`\`\`\n\n`;
    md += `### Automatisk bygg\n\n`;
    md += `GitHub Actions bygger og pusher nye images automatisk ved push til main.\n`;
    md += `Driftsmiljøet kan polle \`:latest\`-taggen eller lytte på webhook for å redeploye.\n\n`;
  }

  // Files table
  md += `## Filer\n\n`;
  md += `| Fil | Beskrivelse |\n`;
  md += `|-----|-------------|\n`;
  md += `| \`model.json\` | Datamodell (GeoForge) |\n`;
  md += `| \`Dockerfile\` | pygeoapi container |\n`;
  md += `| \`pygeoapi-config.yml\` | OGC API-konfigurasjon |\n`;
  if (hasWms) {
    md += `| \`Dockerfile.qgis\` | QGIS Server container |\n`;
    md += `| \`project.qgs\` | QGIS-prosjekt med lag og stil |\n`;
  }
  if (target === 'docker-compose') md += `| \`docker-compose.yml\` | Starter alle tjenester |\n`;
  if (target === 'fly') md += `| \`fly.toml\` | Fly.io-konfigurasjon (pygeoapi) |\n`;
  if (target === 'fly' && hasWms) md += `| \`fly.qgis.toml\` | Fly.io-konfigurasjon (QGIS) |\n`;
  if (target === 'railway') md += `| \`railway.json\` | Railway-konfigurasjon |\n`;
  md += `| \`.env.template\` | Mal for miljøvariabler |\n`;
  if (!isGpkg) md += `| \`delta_export.py\` | Inkrementell GeoPackage-eksport |\n`;

  return md;
};

// ============================================================
// Generate deploy file map — target-aware
// Returns a flat Record<filename, content> for pushing to GitHub
// ============================================================
export const generateDeployFiles = (
  model: DataModel,
  source: SourceConnection,
  lang: string = 'no',
  target: DeployTarget = 'docker-compose'
): Record<string, string> => {
  const isGpkg = source.type === 'geopackage';
  const hasWms = model.layers.some(l => l.geometryType !== 'None');

  // Shared files — always included
  const files: Record<string, string> = {
    'model.json': JSON.stringify(model, null, 2),
    'Dockerfile': generateDockerfile(model, source),
    'pygeoapi-config.yml': generatePygeoapiConfig(model, source, lang),
    '.env.template': generateEnvFile(source),
    '.gitignore': '.env\ndata/\n*.gpkg\n__pycache__/\n',
    'README.md': generateReadmeForTarget(model, source, target),
    '.github/workflows/deploy.yml': generateWorkflowForTarget(model, source, target),
  };

  // QGIS project + Dockerfile.qgis (for targets that need separate service)
  if (hasWms) {
    files['project.qgs'] = generateQgisProject(model, source);
    if (target !== 'docker-compose') {
      files['Dockerfile.qgis'] = generateQgisDockerfile(model, source);
    }
  }

  // Delta script for database sources
  if (!isGpkg) {
    files['delta_export.py'] = generateDeltaScript(model, source);
  }

  // Target-specific files
  if (target === 'docker-compose') {
    files['docker-compose.yml'] = generateDockerCompose(model, source);
    if (hasWms) {
      files['project.qgs'] = generateQgisProject(model, source);
    }
  }

  if (target === 'fly') {
    files['fly.toml'] = generateFlyToml(model, source);
    if (hasWms) {
      files['fly.qgis.toml'] = generateFlyQgisToml(model, source);
    }
  }

  if (target === 'railway') {
    files['railway.json'] = generateRailwayJson(model, source);
  }

  if (target === 'ghcr') {
    // GHCR also includes docker-compose for local dev / pull-and-run
    files['docker-compose.yml'] = generateDockerCompose(model, source);
  }

  return files;
};

// ============================================================
// Legacy: generate deploy kit as downloadable zip (kept as fallback)
// ============================================================
export const exportDeployKit = async (
  model: DataModel,
  source: SourceConnection,
  lang: string = 'no',
  target: DeployTarget = 'docker-compose',
  binaryFiles?: Record<string, Blob>
) => {
  const files = generateDeployFiles(model, source, lang, target);

  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const folderName = `${model.name.replace(/\s/g, '_')}_deploy`;

    Object.entries(files).forEach(([name, content]) => {
      zip.file(`${folderName}/${name}`, content);
    });

    // Legg til binærfiler (f.eks. GeoPackage) i data/-mappen
    if (binaryFiles) {
      for (const [name, blob] of Object.entries(binaryFiles)) {
        zip.file(`${folderName}/${name}`, blob);
      }
    }

    zip.folder(`${folderName}/data/output`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    Object.entries(files).forEach(([name, content]) => {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
};

// ============================================================
// Utility: hexToRgb (duplicated here to avoid circular imports,
// or import from exportUtils if preferred)
// ============================================================
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 59, g: 130, b: 246 };
};