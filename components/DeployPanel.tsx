import React, { useState, useMemo, useId } from 'react';
import {
  Database, Cloud, Zap, Server, ChevronRight, ChevronDown,
  Check, Eye, EyeOff, Table, Clock, RefreshCw, Package,
  Layers, FileCode, Shield, Link2, ArrowRight, DatabaseZap,
  Settings2, FileText, Info, Globe, Github, ExternalLink, Download, GitPullRequest
} from 'lucide-react';
import {
  DataModel, SourceConnection, SourceType, DeployTarget,
  PostgresConfig, SupabaseConfig, DatabricksConfig, GeopackageConfig, LayerSourceMapping
} from '../types';
import { generateDeployFiles, generatePygeoapiConfig, exportDeployKit } from '../utils/deployUtils';
import { pushDeployKit, checkRepoAccess, DeployPushResult } from '../utils/githubService';

interface DeployPanelProps {
  model: DataModel;
  t: any;
  lang: string;
  onSourceChange?: (source: SourceConnection) => void;
}

// ============================================================
// Source type metadata
// ============================================================
const SOURCE_META: Record<SourceType, { icon: React.ReactNode; colorClass: string }> = {
  postgis: {
    icon: <Database size={24} />,
    colorClass: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  supabase: {
    icon: <Zap size={24} />,
    colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  databricks: {
    icon: <DatabaseZap size={24} />,
    colorClass: 'bg-[#fff1f0] text-[#ff3621] border-[#ffccc7]',
  },
  geopackage: {
    icon: <Package size={24} />,
    colorClass: 'bg-amber-50 text-amber-600 border-amber-100',
  }
};

// ============================================================
// Reusable Field Component
// ============================================================
const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: 'text' | 'password';
}> = ({ label, value, onChange, placeholder, hint, type = 'text' }) => {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 cursor-pointer">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && !visible ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">{hint}</p>}
    </div>
  );
};

// ============================================================
// Main DeployPanel Component
// ============================================================
const DeployPanel: React.FC<DeployPanelProps> = ({ model, t, lang, onSourceChange }) => {
  const d = t.deploy; 
  const [step, setStep] = useState(0);
  const [sourceType, setSourceType] = useState<SourceType | null>(null);

  // Connection states
  const [pgConfig, setPgConfig] = useState<PostgresConfig>({
    host: 'localhost', port: '5432', dbname: '', user: 'postgres', password: '', schema: 'public',
  });
  const [supaConfig, setSupaConfig] = useState<SupabaseConfig>({
    projectUrl: '', anonKey: '', schema: 'public',
  });
  const [dbConfig, setDbConfig] = useState<DatabricksConfig>({
    host: '', httpPath: '', token: '', catalog: 'main', schema: 'default',
  });
  const [gpkgConfig, setGpkgConfig] = useState<GeopackageConfig>({
    filename: `${model.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.gpkg`
  });

  // Layer mapping state
  const [layerMappings, setLayerMappings] = useState<Record<string, LayerSourceMapping>>(() => {
    const initial: Record<string, LayerSourceMapping> = {};
    model.layers.forEach(l => {
      const tbl = l.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const fieldMappings: Record<string, string> = {};
      l.properties.forEach(p => { fieldMappings[p.id] = p.name; });
      initial[l.id] = { sourceTable: tbl, fieldMappings, timestampColumn: '', primaryKeyColumn: 'fid' };
    });
    return initial;
  });

  const [expandedLayer, setExpandedLayer] = useState<string | null>(model.layers[0]?.id || null);
  const [showPreview, setShowPreview] = useState(false);

  // GitHub publish state
  const [ghRepo, setGhRepo] = useState(model.githubMeta?.repo || '');
  const [ghBranch, setGhBranch] = useState(model.githubMeta?.branch || 'main');
  const [ghToken, setGhToken] = useState('');
  const [ghBasePath, setGhBasePath] = useState('');
  const [deployTarget, setDeployTarget] = useState<DeployTarget>('docker-compose');
  const [repoAccess, setRepoAccess] = useState<{ isOwner: boolean; ownerLogin: string; userLogin: string } | null>(null);
  const [repoCheckStatus, setRepoCheckStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [publishStatus, setPublishStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [publishResult, setPublishResult] = useState<DeployPushResult | null>(null);

  // Auto-detect repo ownership when repo + token are filled
  const checkAccess = async () => {
    if (!ghRepo || !ghToken) { setRepoAccess(null); setRepoCheckStatus('idle'); return; }
    setRepoCheckStatus('checking');
    try {
      const access = await checkRepoAccess(ghToken, ghRepo);
      setRepoAccess(access);
      setRepoCheckStatus('done');
    } catch {
      setRepoAccess(null);
      setRepoCheckStatus('error');
    }
  };

  const willCreatePR = repoAccess !== null && !repoAccess.isOwner;

  // State Updaters
  const updateMapping = (layerId: string, updates: Partial<LayerSourceMapping>) => {
    setLayerMappings(prev => ({
      ...prev,
      [layerId]: { ...prev[layerId], ...updates }
    }));
  };

  const handleFieldChange = (layerId: string, propId: string, val: string) => {
    setLayerMappings(prev => {
      const layer = prev[layerId];
      const fields = layer.fieldMappings || {};
      return {
        ...prev,
        [layerId]: {
          ...layer,
          fieldMappings: { ...fields, [propId]: val }
        }
      };
    });
  };

  const buildSource = (): SourceConnection | null => {
    if (!sourceType) return null;
    let config;
    if (sourceType === 'postgis') config = pgConfig;
    else if (sourceType === 'supabase') config = supaConfig;
    else if (sourceType === 'databricks') config = dbConfig;
    else config = gpkgConfig;
    
    return { type: sourceType, config, layerMappings };
  };

  const previewYaml = useMemo(() => {
    const source = buildSource();
    return source ? generatePygeoapiConfig(model, source, lang) : '';
  }, [sourceType, pgConfig, supaConfig, dbConfig, gpkgConfig, layerMappings, model, lang]);

  const isConnectionValid = (): boolean => {
    if (!sourceType) return false;
    if (sourceType === 'postgis') return !!(pgConfig.host && pgConfig.dbname && pgConfig.user);
    if (sourceType === 'supabase') return !!(supaConfig.projectUrl && supaConfig.anonKey);
    if (sourceType === 'databricks') return !!(dbConfig.host && dbConfig.httpPath && dbConfig.token);
    if (sourceType === 'geopackage') return !!gpkgConfig.filename;
    return false;
  };

  const isPublishReady = (): boolean => {
    return !!(ghRepo && ghToken);
  };

  const handlePublish = async () => {
    const source = buildSource();
    if (!source) return;
    setPublishStatus('loading');
    setPublishResult(null);
    try {
      const files = generateDeployFiles(model, source, lang, deployTarget);
      const commitMsg = `[${model.version}] Deploy ${model.name}`;
      const result = await pushDeployKit(
        ghToken, ghRepo, ghBranch, ghBasePath, files, commitMsg,
        willCreatePR, `Deploy: ${model.name} v${model.version}`
      );
      setPublishResult(result);
      setPublishStatus(result.success ? 'success' : 'error');
      if (result.success) onSourceChange?.(source);
    } catch (e: any) {
      setPublishResult({ success: false, error: e.message });
      setPublishStatus('error');
    }
  };

  const handleDownloadZip = async () => {
    const source = buildSource();
    if (!source) return;
    await exportDeployKit(model, source, lang, deployTarget);
  };

  const stepIcons = [Database, Link2, Table, Github];
  const sourceTypes: SourceType[] = ['postgis', 'supabase', 'databricks', 'geopackage'];

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-40 px-2 md:px-4">
      
      {/* 1. PROGRESS STEPPER */}
      <div className="flex items-center justify-between px-4 sm:px-12 py-8 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
        {d.steps.map((label: string, idx: number) => {
          const Icon = stepIcons[idx];
          const isPast = step > idx;
          return (
            <React.Fragment key={idx}>
              <div 
                className={`flex flex-col items-center gap-2 relative z-10 transition-all ${isPast ? 'cursor-pointer group' : ''}`}
                onClick={() => isPast && setStep(idx)}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
                  step >= idx ? 'bg-violet-600 text-white shadow-violet-200' : 'bg-slate-50 text-slate-300'
                } ${isPast ? 'group-hover:bg-violet-500 group-hover:scale-105' : ''}`}>
                  {isPast ? <Check size={20} strokeWidth={3} /> : <Icon size={18} />}
                </div>
                <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:block ${step >= idx ? 'text-violet-900' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
              {idx < d.steps.length - 1 && (
                <div className="flex-1 h-1 mx-2 md:mx-4 rounded-full bg-slate-100 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-violet-600 transition-all duration-700 ${step > idx ? 'w-full' : 'w-0'}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 0: SOURCE SELECTION */}
      {step === 0 && (
        <section className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600 border border-violet-100 shrink-0"><Cloud size={28} /></div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{d.sourceTitle}</h3>
              <p className="text-xs text-slate-500 font-medium">{d.subtitle}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sourceTypes.map(type => {
              const meta = SOURCE_META[type];
              return (
                <button 
                  key={type} 
                  onClick={() => { setSourceType(type); setStep(1); }} 
                  className={`text-left p-6 rounded-[24px] border-2 transition-all flex flex-col items-start gap-4 active:scale-95 group hover:scale-[1.02] ${
                    sourceType === type ? 'border-violet-400 bg-violet-50 shadow-xl' : 'border-slate-100 bg-white shadow-sm'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:rotate-3 ${meta.colorClass}`}>
                    {meta.icon}
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-1">{d.sources[type] || type}</h3>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">{d.sources[`${type}Desc`] || `Connect to ${type}`}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 1: CONNECTION DETAILS */}
      {step === 1 && sourceType && (
        <section className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm space-y-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shrink-0 ${SOURCE_META[sourceType].colorClass}`}>
              {SOURCE_META[sourceType].icon}
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{d.connectionTitle}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{d.sources[sourceType] || sourceType}</p>
            </div>
          </div>
          <div className="p-8 bg-slate-50 rounded-[24px] border border-slate-100 space-y-6">
            {sourceType === 'postgis' && (
              <React.Fragment>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="sm:col-span-2"><Field label={d.fields.host} value={pgConfig.host} onChange={v => setPgConfig(p => ({ ...p, host: v }))} placeholder="localhost" /></div>
                  <Field label={d.fields.port} value={pgConfig.port} onChange={v => setPgConfig(p => ({ ...p, port: v }))} placeholder="5432" />
                </div>
                <Field label={d.fields.database} value={pgConfig.dbname} onChange={v => setPgConfig(p => ({ ...p, dbname: v }))} placeholder="geodata" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field label={d.fields?.user} value={pgConfig.user} onChange={v => setPgConfig(p => ({ ...p, user: v }))} placeholder="postgres" />
                  <Field label={d.fields?.password} value={pgConfig.password} onChange={v => setPgConfig(p => ({ ...p, password: v }))} type="password" />
                </div>
                <Field label={d.fields.schema} value={pgConfig.schema} onChange={v => setPgConfig(p => ({ ...p, schema: v }))} placeholder="public" />
              </React.Fragment>
            )}
            {sourceType === 'supabase' && (
              <React.Fragment>
                <Field label={d.fields.projectUrl} value={supaConfig.projectUrl} onChange={v => setSupaConfig(p => ({ ...p, projectUrl: v }))} placeholder="https://abcdef.supabase.co" hint={d.supabaseHint} />
                <Field label={d.fields.anonKey} value={supaConfig.anonKey} onChange={v => setSupaConfig(p => ({ ...p, anonKey: v }))} type="password" />
                <Field label={d.fields.schema} value={supaConfig.schema} onChange={v => setSupaConfig(p => ({ ...p, schema: v }))} placeholder="public" />
              </React.Fragment>
            )}
            {sourceType === 'databricks' && (
              <React.Fragment>
                <Field label={d.fields.serverHostname} value={dbConfig.host} onChange={v => setDbConfig(p => ({ ...p, host: v }))} />
                <Field label={d.fields.httpPath} value={dbConfig.httpPath} onChange={v => setDbConfig(p => ({ ...p, httpPath: v }))} />
                <Field label={d.fields.accessToken} value={dbConfig.token} onChange={v => setDbConfig(p => ({ ...p, token: v }))} type="password" />
                <div className="grid grid-cols-2 gap-6">
                  <Field label={d.fields.catalog} value={dbConfig.catalog} onChange={v => setDbConfig(p => ({ ...p, catalog: v }))} />
                  <Field label={d.fields.schema} value={dbConfig.schema} onChange={v => setDbConfig(p => ({ ...p, schema: v }))} />
                </div>
              </React.Fragment>
            )}
            {sourceType === 'geopackage' && (
              <React.Fragment>
                <Field 
                  label={d.gpkgFilename} 
                  value={gpkgConfig.filename} 
                  onChange={v => setGpkgConfig(p => ({ ...p, filename: v }))} 
                  hint={d.gpkgHint} 
                />
              </React.Fragment>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={() => setStep(0)} className="px-8 py-4 rounded-2xl border-2 bg-white border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:border-slate-300">{d.back}</button>
            <button onClick={() => setStep(2)} disabled={!isConnectionValid()} className="px-8 py-4 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-50 shadow-lg shadow-violet-200 active:scale-95 transition-all hover:bg-violet-700">{d.next}</button>
          </div>
        </section>
      )}

      {/* STEP 2: LAYER MAPPING */}
      {step === 2 && (
        <section className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0"><Layers size={28} /></div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{d.mappingTitle}</h3>
              <p className="text-xs text-slate-500 font-medium">{d.mappingDesc}</p>
            </div>
          </div>

          <div className="space-y-6 pb-20">
            {model.layers.map(layer => {
              const m = layerMappings[layer.id];
              const isExpanded = expandedLayer === layer.id;
              const isMapped = !!m?.sourceTable;

              return (
                <div key={layer.id} className={`bg-white rounded-[24px] border transition-all overflow-hidden ${isExpanded ? 'border-violet-200 ring-4 ring-violet-500/5' : 'border-slate-200 shadow-sm'}`}>
                  <button onClick={() => setExpandedLayer(isExpanded ? null : layer.id)} className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isMapped ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                        {isMapped ? <Check size={20} /> : <Table size={20} />}
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-black uppercase tracking-widest text-slate-800 block">{layer.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">{m?.sourceTable || d.notConnected}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       {m?.timestampColumn && (
                          <span className="hidden sm:flex text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-black uppercase tracking-tighter items-center gap-1">
                            <Clock size={10} /> delta
                          </span>
                       )}
                       {isExpanded ? <ChevronDown size={20} className="text-slate-300" /> : <ChevronRight size={20} className="text-slate-300" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-8 pt-6 bg-slate-50/50 border-t border-slate-100">
                      
                      {/* Database Configurations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <Field 
                          label={d.sourceTable || 'Source Table'} 
                          value={m?.sourceTable || ''} 
                          onChange={v => updateMapping(layer.id, { sourceTable: v })} 
                          hint={sourceType === 'geopackage' ? 'Layer name inside GeoPackage' : (d.sourceTableHint || 'Table name in database')} 
                        />
                        <Field 
                          label={d.primaryKeyColumn || 'Primary Key'} 
                          value={m?.primaryKeyColumn || 'fid'} 
                          onChange={v => updateMapping(layer.id, { primaryKeyColumn: v })} 
                          placeholder="fid" 
                          hint={d.primaryKeyHint || 'Unique identifier column (e.g. fid, id)'} 
                        />
                      </div>

                      {/* Timestamp Selection - Hidden for GeoPackage */}
                      {sourceType !== 'geopackage' && (
                        <div className="space-y-1.5 mb-8">
                          <label className="text-[10px] font-black uppercase text-slate-400 px-1 flex items-center gap-2">
                              {d.timestampColumn || 'Timestamp Column'}
                              <div className="group relative">
                                <Info size={14} className="text-slate-300 cursor-help hover:text-violet-500 transition-colors" />
                                <div className="absolute bottom-full left-0 md:left-1/2 md:-translate-x-1/2 mb-3 w-72 p-4 bg-slate-900 text-white text-[10px] rounded-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 shadow-2xl font-medium leading-relaxed border border-slate-700">
                                    {d.timestampExplainer}
                                </div>
                              </div>
                          </label>
                          <div className="relative">
                            <select 
                              value={m?.timestampColumn || ''} 
                              onChange={e => updateMapping(layer.id, { timestampColumn: e.target.value })} 
                              className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold outline-none appearance-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all cursor-pointer shadow-sm"
                            >
                              <option value="">{d.noTimestamp}</option>
                              {layer.properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                            </select>
                            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                          </div>
                        </div>
                      )}

                      {/* Field Mapping Grid */}
                      <div className="bg-white border border-slate-200 rounded-[28px] overflow-hidden shadow-sm">
                        <div className="grid grid-cols-[1fr_auto_1fr] px-8 py-5 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span>{d.fieldMapping || 'Property'}</span><span className="w-6"></span><span>{d.sourceTable || 'Source Field'}</span>
                        </div>
                        <div className="p-4 space-y-1 max-h-[350px] overflow-y-auto custom-scrollbar">
                          {layer.properties.map(prop => (
                            <div key={prop.id} className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center px-4 py-3 hover:bg-slate-50 rounded-2xl transition-colors">
                              <span className="text-xs font-bold text-slate-700 truncate">{prop.name}</span>
                              <ArrowRight size={16} className="text-slate-200" />
                              <input 
                                value={(m?.fieldMappings || {})[prop.id] || prop.name} 
                                onChange={e => handleFieldChange(layer.id, prop.id, e.target.value)} 
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all" 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-6 z-20 flex gap-4 p-2 bg-white/80 backdrop-blur-md border border-slate-100 rounded-[28px] shadow-xl">
            <button onClick={() => setStep(1)} className="px-10 py-4 rounded-2xl border-2 bg-white border-slate-200 text-slate-500 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-slate-50">{d.back}</button>
            <button onClick={() => setStep(3)} className="flex-1 px-10 py-4 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest active:scale-95 shadow-lg shadow-violet-200 transition-all hover:bg-violet-700">{d.next}</button>
          </div>
        </section>
      )}

      {/* STEP 3: PUBLISH TO GITHUB */}
      {step === 3 && (
        <section className="bg-slate-900 rounded-[40px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="p-8 md:p-12 bg-slate-800/80 border-b border-slate-700">
            <div className="flex items-center gap-8">
              <div className="w-20 h-20 rounded-[28px] bg-violet-600 flex items-center justify-center text-white shrink-0 shadow-2xl transition-transform hover:rotate-3"><Github size={40} /></div>
              <div>
                <h3 className="text-2xl font-black text-white tracking-tight leading-none mb-2">{d.kitTitle} {model.name}</h3>
                <p className="text-[10px] text-violet-400 font-bold uppercase tracking-[0.2em]">{d.readyToGenerate}</p>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-800">
            {[
              { label: d.source, val: sourceType, icon: SOURCE_META[sourceType!]?.icon },
              { label: d.layersLabel, val: model.layers.length, icon: <Layers size={14}/> },
              { label: d.changeTracking, val: sourceType === 'geopackage' ? 'Static File' : `${Object.values(layerMappings).filter(m => m.timestampColumn).length} delta`, icon: <Clock size={14}/> },
              { label: 'CRS', val: model.crs || 'EPSG:25833', icon: <Globe size={14}/> }
            ].map((stat, i) => (
              <div key={i} className="bg-slate-900 p-8 flex flex-col gap-2">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest flex items-center gap-2">{stat.label}</span>
                <p className="text-white font-bold text-lg truncate capitalize">{String(stat.val)}</p>
              </div>
            ))}
          </div>

          {/* Deploy target selector */}
          <div className="p-8 md:p-12 border-b border-slate-800 space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{d.targetTitle}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(['railway', 'fly', 'ghcr', 'docker-compose'] as DeployTarget[]).map(tgt => {
                const icons: Record<string, React.ReactNode> = {
                  'railway': <Cloud size={18} />,
                  'fly': <Cloud size={18} />,
                  'ghcr': <Package size={18} />,
                  'docker-compose': <Server size={18} />,
                };
                const isActive = deployTarget === tgt;
                return (
                  <button
                    key={tgt}
                    onClick={() => setDeployTarget(tgt)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-violet-600/20 border-violet-500 shadow-lg shadow-violet-500/10'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {icons[tgt]}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{d.targets?.[tgt]}</p>
                      <p className="text-[9px] text-slate-500 font-medium mt-0.5 line-clamp-2 leading-relaxed">{d.targets?.[tgt + 'Desc']}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GitHub config */}
          <div className="p-8 md:p-12 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{d.publishTitle}</h4>
            </div>
            <p className="text-sm text-slate-400 font-medium -mt-4">{d.publishDesc}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">{d.githubRepo}</label>
                <input
                  type="text"
                  value={ghRepo}
                  onChange={e => setGhRepo(e.target.value)}
                  onBlur={checkAccess}
                  placeholder={d.githubRepoPlaceholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-600 font-medium px-1">{d.githubRepoHint}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">{d.githubToken}</label>
                <div className="relative">
                  <input
                    type="password"
                    value={ghToken}
                    onChange={e => setGhToken(e.target.value)}
                    onBlur={checkAccess}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder:text-slate-600"
                    placeholder="ghp_..."
                  />
                </div>
                <p className="text-[10px] text-slate-600 font-medium px-1">{d.githubTokenHint}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">{d.githubBranch}</label>
                <input
                  type="text"
                  value={ghBranch}
                  onChange={e => setGhBranch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">{d.githubBasePath}</label>
                <input
                  type="text"
                  value={ghBasePath}
                  onChange={e => setGhBasePath(e.target.value)}
                  placeholder={d.githubBasePathPlaceholder}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-xs font-bold text-slate-200 outline-none focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder:text-slate-600"
                />
                <p className="text-[10px] text-slate-600 font-medium px-1">{d.githubBasePathHint}</p>
              </div>
            </div>

            {/* Repo access info */}
            {repoCheckStatus === 'checking' && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-400">
                <RefreshCw size={16} className="animate-spin text-violet-400" />
                {d.repoChecking}
              </div>
            )}
            {repoCheckStatus === 'done' && repoAccess && (
              <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-xs font-bold ${
                willCreatePR 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}>
                {willCreatePR ? (
                  <React.Fragment>
                    <GitPullRequest size={16} />
                    {d.repoAccessPR?.replace('{owner}', repoAccess.ownerLogin)}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <Check size={16} strokeWidth={3} />
                    {d.repoAccessDirect?.replace('{branch}', ghBranch)}
                  </React.Fragment>
                )}
              </div>
            )}
            {repoCheckStatus === 'error' && (
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-300">
                <Info size={16} />
                {d.repoAccessError}
              </div>
            )}
          </div>

          {/* File inventory */}
          <div className="px-8 md:px-12 pb-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{d.packageContents}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { file: 'model.json', desc: d.files?.model || 'Model definition', icon: <FileCode size={16}/> },
                { file: 'docker-compose.yml', desc: d.files?.docker || 'Orchestration', icon: <Cloud size={16}/> },
                { file: 'Dockerfile', desc: d.files?.dockerfile || 'Container image', icon: <Package size={16}/> },
                { file: 'pygeoapi-config.yml', desc: sourceType === 'databricks' || sourceType === 'geopackage' ? (d.files?.pygeoapiGpkg || 'File-based OGC API') : (d.files?.pygeoapiPg || 'Live DB'), icon: <Settings2 size={16}/> },
                { file: 'project.qgs', desc: d.files?.qgis || 'Cartography', icon: <FileText size={16} /> },
                sourceType !== 'geopackage' && { file: 'delta_export.py', desc: d.files?.delta || 'Sync engine', icon: <RefreshCw size={16}/> },
                { file: '.env.template', desc: d.files?.env || 'Secrets template', icon: <Shield size={16}/> },
                { file: '.github/workflows/deploy.yml', desc: d.files?.workflow || 'CI/CD pipeline', icon: <Zap size={16}/> },
              ].filter(Boolean).map((item: any, i) => (
                <div key={i} className="flex gap-4 p-5 bg-slate-800/40 border border-slate-700/50 rounded-2xl group hover:bg-slate-800 hover:border-violet-500/30 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-violet-400 border border-slate-700 shrink-0 group-hover:scale-110 transition-transform">{item.icon}</div>
                  <div>
                    <p className="text-sm font-mono font-bold text-slate-100 mb-0.5">{item.file}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Publish result */}
          {publishStatus === 'success' && publishResult?.success && (
            <div className="mx-8 mb-8 p-8 bg-emerald-900/20 border border-emerald-900/50 rounded-[32px] space-y-6 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 text-emerald-400">
                <Check size={24} strokeWidth={3} />
                <span className="text-xs font-black uppercase tracking-widest">{d.publishSuccess}</span>
              </div>
              <p className="text-sm text-emerald-100/80 leading-relaxed font-medium">
                {publishResult.prUrl ? d.prCreatedDesc : d.directPushDesc}
              </p>
              {publishResult.prUrl && (
                <a
                  href={publishResult.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95"
                >
                  <ExternalLink size={16} /> {d.viewPR}
                </a>
              )}
              {!publishResult.prUrl && publishResult.commitSha && (
                <a
                  href={`https://github.com/${ghRepo}/commit/${publishResult.commitSha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95"
                >
                  <ExternalLink size={16} /> {d.viewCommit}
                </a>
              )}
            </div>
          )}

          {publishStatus === 'error' && (
            <div className="mx-8 mb-8 p-8 bg-rose-900/20 border border-rose-900/50 rounded-[32px] space-y-4 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-3 text-rose-400">
                <Shield size={24} />
                <span className="text-xs font-black uppercase tracking-widest">{d.publishError}</span>
              </div>
              <p className="text-sm text-rose-200/80 font-mono">{publishResult?.error || 'Unknown error'}</p>
            </div>
          )}

          {/* Preview */}
          <div className="p-8 border-t border-slate-800 bg-black/40">
            <button 
              onClick={() => setShowPreview(!showPreview)} 
              className="text-[10px] text-indigo-400 font-black uppercase tracking-widest flex items-center gap-2 hover:text-indigo-300 transition-colors"
            >
              {showPreview ? <ChevronDown size={16}/> : <ChevronRight size={16}/>} {d.previewConfig}
            </button>
            {showPreview && (
              <pre className="mt-8 bg-black/60 text-indigo-200 text-[11px] font-mono p-10 rounded-[32px] overflow-x-auto max-h-[500px] border border-slate-800 custom-scrollbar leading-relaxed">
                {previewYaml}
              </pre>
            )}
          </div>

          {/* Footer with actions */}
          <div className="p-8 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button 
              onClick={() => setStep(2)} 
              className="px-10 py-4 rounded-2xl border-2 border-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:text-white hover:border-slate-500"
            >
              {d.back}
            </button>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleDownloadZip}
                className="px-6 py-4 rounded-2xl border-2 border-slate-700 text-slate-500 font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:text-slate-300 hover:border-slate-500 flex items-center gap-2"
              >
                <Download size={16} /> {d.downloadZip}
              </button>
              <button
                onClick={handlePublish}
                disabled={!isPublishReady() || publishStatus === 'loading'}
                className={`px-12 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] active:scale-95 shadow-2xl transition-all flex items-center gap-3 ${
                  publishStatus === 'success' 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-violet-600 text-white shadow-violet-900/40 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {publishStatus === 'loading' ? (
                  <React.Fragment><RefreshCw size={18} className="animate-spin" /> {d.publishing}</React.Fragment>
                ) : publishStatus === 'success' ? (
                  <React.Fragment><Check size={18} strokeWidth={3} /> {d.publishSuccess}</React.Fragment>
                ) : (
                  <React.Fragment><Github size={18} /> {d.publishBtn}</React.Fragment>
                )}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default DeployPanel;