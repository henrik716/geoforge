import { createClient } from '@supabase/supabase-js';
import {
  DataModel, Layer, Field, FieldType, GeometryType, PropertyConstraints
} from '../types';
import { createEmptyModel, createEmptyField, createEmptyLayer } from '../constants';
import { mapSqlTypeToFieldType } from './typeMapUtils';
import { normalizeGeometryType } from './geomUtils';
import { sanitizeTechnicalName } from './nameSanitizer';

/**
 * Query schema info from a Supabase project via the get_schema_info RPC function.
 * Requires the SQL function to be deployed in the Supabase project:
 *
 * create or replace function get_schema_info(target_schema text default 'public')
 * returns json language sql security definer as $$
 *   select json_agg(t) from (
 *     select
 *       c.table_name, c.column_name, c.data_type, c.udt_name,
 *       c.is_nullable, c.column_default, tc.constraint_type
 *     from information_schema.columns c
 *     left join information_schema.key_column_usage kcu
 *       on c.table_schema = kcu.table_schema
 *       and c.table_name = kcu.table_name
 *       and c.column_name = kcu.column_name
 *     left join information_schema.table_constraints tc
 *       on kcu.constraint_name = tc.constraint_name
 *       and kcu.table_schema = tc.table_schema
 *     where c.table_schema = target_schema
 *     order by c.table_name, c.ordinal_position
 *   ) t
 * $$;
 */

interface SchemaRow {
  table_name: string;
  column_name: string;
  data_type: string;
  udt_name?: string;
  is_nullable: boolean;
  column_default?: string;
  constraint_type?: string;
}

/**
 * Convert Supabase schema to a GeoForge DataModel.
 *
 * @param projectUrl - Supabase project URL (e.g., "https://myproject.supabase.co")
 * @param anonKey - Supabase anonymous key (public, safe for browser)
 * @param schema - PostgreSQL schema name (default: 'public')
 * @returns A DataModel with one Layer per table
 */
export const processSupabaseSchemaToModel = async (
  projectUrl: string,
  anonKey: string,
  schema: string = 'public'
): Promise<DataModel> => {
  if (!projectUrl || !anonKey) {
    throw new Error('projectUrl and anonKey are required');
  }

  const supabase = createClient(projectUrl, anonKey);

  // Call the RPC function to get schema info
  const { data, error } = await supabase.rpc('get_schema_info', { target_schema: schema });

  if (error) {
    throw new Error(`Failed to fetch schema from Supabase: ${error.message}`);
  }

  if (!data || !Array.isArray(data)) {
    throw new Error('Invalid response from Supabase schema function');
  }

  const schemaRows: SchemaRow[] = data;

  // Group rows by table name
  const tableMap: Record<string, SchemaRow[]> = {};
  for (const row of schemaRows) {
    if (!tableMap[row.table_name]) {
      tableMap[row.table_name] = [];
    }
    tableMap[row.table_name].push(row);
  }

  // Convert to DataModel
  const model = createEmptyModel();
  model.name = projectUrl.split('.')[0].replace('https://', '');
  model.crs = 'EPSG:25833'; // default Norwegian CRS; could be inferred from PostGIS metadata
  model.layers = [];

  for (const [tableName, rows] of Object.entries(tableMap)) {
    const layer = createEmptyLayer(tableName);
    layer.name = tableName;

    const properties: Field[] = [];
    let geometryColumnName = '';
    let geometryType: GeometryType = 'Polygon';

    for (const row of rows) {
      const colName = row.column_name;
      const dataType = row.data_type;
      const udtName = row.udt_name?.toLowerCase() || dataType.toLowerCase();

      // Skip geometry columns for now, track them separately
      if (udtName.includes('geometry') || udtName.includes('geography')) {
        geometryColumnName = sanitizeTechnicalName(colName);
        // Try to infer geometry type from column name or use a default
        geometryType = normalizeGeometryType(udtName);
        continue;
      }

      // Map SQL type to FieldType
      let fieldType: FieldType;
      if (udtName.includes('geometry') || udtName.includes('geography')) {
        fieldType = { kind: 'geometry', geometryType: normalizeGeometryType(udtName) };
      } else {
        fieldType = mapSqlTypeToFieldType(dataType);
      }

      // Check if this is a primary key
      const constraints: PropertyConstraints = {};
      if (row.constraint_type === 'PRIMARY KEY') {
        constraints.isPrimaryKey = true;
      }

      properties.push({
        ...createEmptyField(),
        name: sanitizeTechnicalName(colName),
        title: colName.charAt(0).toUpperCase() + colName.slice(1).replace(/_/g, ' '),
        fieldType,
        multiplicity: row.is_nullable ? '0..1' : '1..1',
        defaultValue: row.column_default ? String(row.column_default) : '',
        constraints,
      });
    }

    layer.properties = properties;
    layer.geometryColumnName = geometryColumnName;
    layer.geometryType = geometryType;

    model.layers.push(layer);
  }

  // Fallback to single empty layer if no tables found
  if (model.layers.length === 0) {
    model.layers = [createEmptyLayer()];
  }

  return model;
};
