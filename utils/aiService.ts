export type AiProvider = 'claude' | 'gemini';

export interface AiConstraintSuggestion {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  required?: boolean;
  enumeration?: string[];
}

const PROVIDER_KEY = 'geoforge-ai-provider';
const API_KEY_PREFIX = 'geoforge-ai-key-';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const GEMINI_MODEL = 'gemini-2.5-flash';
const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class AiKeyMissingError extends Error {
  constructor() {
    super('AI key not configured');
    this.name = 'AiKeyMissingError';
  }
}

export class AiAuthError extends Error {
  constructor() {
    super('Invalid API key');
    this.name = 'AiAuthError';
  }
}

export function getProvider(): AiProvider {
  return (localStorage.getItem(PROVIDER_KEY) as AiProvider) ?? 'claude';
}

export function setProvider(p: AiProvider): void {
  localStorage.setItem(PROVIDER_KEY, p);
}

export function getApiKey(p?: AiProvider): string | null {
  return localStorage.getItem(API_KEY_PREFIX + (p ?? getProvider()));
}

export function saveApiKey(key: string, p?: AiProvider): void {
  localStorage.setItem(API_KEY_PREFIX + (p ?? getProvider()), key.trim());
}

async function callAI(system: string, user: string): Promise<string> {
  const provider = getProvider();
  const key = getApiKey();
  if (!key) throw new AiKeyMissingError();

  if (provider === 'claude') {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new AiAuthError();
      throw new Error(`API error ${res.status}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  } else {
    const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
      }),
    });
    if (!res.ok) {
      if (res.status === 400 || res.status === 403) throw new AiAuthError();
      throw new Error(`API error ${res.status}`);
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  }
}

export async function generatePropertyDescription(params: {
  fieldName: string;
  fieldType: string;
  layerName: string;
  lang: string;
}): Promise<string> {
  const langInstruction = params.lang === 'no' ? 'Svar kun på norsk.' : 'Reply in English only.';
  const system = `You are a geospatial data modeler. Generate a concise, professional field description for use in a geographic data model (1-2 sentences max). ${langInstruction} Output ONLY the description text, no quotes, no preamble.`;
  const user = `Layer: "${params.layerName}"\nField name: "${params.fieldName}"\nData type: ${params.fieldType}`;
  return callAI(system, user);
}

export async function suggestFieldType(params: {
  fieldName: string;
  description: string;
  lang: string;
}): Promise<string> {
  const validTypes = 'string, number, integer, boolean, date, geometry, codelist, json, object, array';
  const system = `You are a geospatial data modeler. Given a field name and optional description, choose the single most appropriate data type from this exact list: ${validTypes}. Output ONLY the type keyword (e.g. "integer"). No explanation, no punctuation.`;
  const user = `Field name: "${params.fieldName}"\nDescription: "${params.description || '(none)'}"`;
  return callAI(system, user);
}

export async function inferConstraints(params: {
  fieldName: string;
  fieldType: string;
  description: string;
  lang: string;
}): Promise<AiConstraintSuggestion> {
  const system = `You are a geospatial data modeler. Given a field's name, type, and description, suggest applicable constraints as a JSON object. Only include keys that are clearly relevant. Valid keys: min (number), max (number), minLength (number), maxLength (number), pattern (regex string), required (boolean), enumeration (array of strings). Output ONLY valid JSON. No markdown, no explanation.`;
  const user = `Field name: "${params.fieldName}"\nType: ${params.fieldType}\nDescription: "${params.description || '(none)'}"`;
  const raw = await callAI(system, user);
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as AiConstraintSuggestion;
  } catch {
    throw new Error('AI returned invalid JSON for constraints');
  }
}

export async function suggestTheme(params: {
  modelName: string;
  layers: Array<{ name: string; properties: Array<{ name: string; type: string }> }>;
  lang: string;
  validThemes: Record<string, string>;
}): Promise<string> {
  const themeList = Object.entries(params.validThemes).map(([k, v]) => `${k}: ${v}`).join('\n');
  const layerSummary = params.layers.map(l => {
    const topProps = l.properties.slice(0, 4).map(p => p.name).join(', ');
    return `- ${l.name}: ${topProps || '(no properties)'}`;
  }).join('\n');
  const system = `You are a geospatial metadata specialist. Given a dataset name and its layers, choose the single most appropriate INSPIRE/GeoDCAT theme from this list:\n${themeList}\n\nOutput ONLY the two-letter key (e.g. "tn"). No explanation, no punctuation.`;
  const user = `Dataset: "${params.modelName}"\nLayers:\n${layerSummary}`;
  return callAI(system, user);
}

export async function suggestKeywords(params: {
  modelName: string;
  layers: Array<{ name: string; properties: Array<{ name: string; type: string }> }>;
  lang: string;
}): Promise<string[]> {
  const langInstruction = params.lang === 'no' ? 'Svar kun på norsk.' : 'Reply in English only.';
  const layerSummary = params.layers.map(l => {
    const topProps = l.properties.slice(0, 4).map(p => p.name).join(', ');
    return `- ${l.name}: ${topProps || '(no properties)'}`;
  }).join('\n');
  const system = `You are a geospatial metadata specialist. Given a dataset name and its layers, suggest 5-8 relevant search keywords/tags. ${langInstruction} Output ONLY a JSON array of strings (e.g. ["roads","transport"]). No explanation, no markdown.`;
  const user = `Dataset: "${params.modelName}"\nLayers:\n${layerSummary}`;
  const raw = await callAI(system, user);
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as string[];
  } catch {
    return raw.split(',').map(s => s.replace(/["'\[\]]/g, '').trim()).filter(Boolean);
  }
}

export async function generateModelAbstract(params: {
  modelName: string;
  layers: Array<{ name: string; properties: Array<{ name: string; type: string }> }>;
  lang: string;
}): Promise<string> {
  const langInstruction = params.lang === 'no' ? 'Svar kun på norsk.' : 'Reply in English only.';
  const layerSummary = params.layers.map(l => {
    const topProps = l.properties.slice(0, 6).map(p => `${p.name} (${p.type})`).join(', ');
    return `- ${l.name}: ${topProps || '(no properties)'}`;
  }).join('\n');
  const system = `You are a geospatial metadata specialist. Write a GeoDCAT-ready abstract paragraph for the dataset described below (3-5 sentences). Describe what the dataset contains, its geographic purpose, and key attributes. ${langInstruction} Output ONLY the abstract text, no quotes, no preamble.`;
  const user = `Dataset name: "${params.modelName}"\nLayers:\n${layerSummary}`;
  return callAI(system, user);
}
