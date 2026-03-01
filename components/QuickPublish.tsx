import React, { useState } from 'react';
import {
  ChevronLeft, Check, Database, Tag, Github, Layers, ArrowRight,
  RefreshCw, ExternalLink, Info, GitPullRequest, Download, X, Paintbrush,
  Cloud, Server, Package, AlertTriangle
} from 'lucide-react';
import { DataModel, ModelMetadata, LayerStyle, DeployTarget } from '../types';
import { InferredDataSummary } from '../utils/importUtils';
import LayerStyleEditor from './LayerStyleEditor';
import { generateDeployFiles, exportDeployKit } from '../utils/deployUtils';
import { pushDeployKit, checkRepoAccess, DeployPushResult } from '../utils/githubService';

interface QuickPublishProps {
  model: DataModel;
  summary: InferredDataSummary;
  t: any;
  lang: string;
  onUpdateModel: (model: DataModel) => void;
  onBack: () => void;
  onOpenEditor: () => void;
  dataBlob?: { blob: Blob; filename: string } | null;
}

const GEOM_ICONS: Record<string, string> = {
  Point: '●', MultiPoint: '●●', LineString: '╱', MultiLineString: '╱╱',
  Polygon: '◆', MultiPolygon: '◆◆', GeometryCollection: '◇', None: '○'
};

const QuickPublish: React.FC<QuickPublishProps> = ({
  model, summary, t, lang, onUpdateModel, onBack, onOpenEditor, dataBlob
}) => {
  const q = t.quickPublish || {};
  const md = t.metadata || {};
  const d = t.deploy || {};

  const [step, setStep] = useState(0);
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(
    new Set(model.layers.map(l => l.id))
  );
  const [includeData, setIncludeData] = useState(false);

  // Metadata state
  const meta: ModelMetadata = model.metadata || {
    contactName: '', contactEmail: '', contactOrganization: '',
    keywords: [], theme: '', license: 'CC-BY-4.0', accessRights: 'public',
    purpose: '', accrualPeriodicity: 'unknown',
    spatialExtent: {
      westBoundLongitude: summary.bbox?.west?.toString() || '',
      eastBoundLongitude: summary.bbox?.east?.toString() || '',
      southBoundLatitude: summary.bbox?.south?.toString() || '',
      northBoundLatitude: summary.bbox?.north?.toString() || '',
    },
    temporalExtentFrom: '', temporalExtentTo: '',
  };

  const updateMeta = (partial: Partial<ModelMetadata>) => {
    onUpdateModel({ ...model, metadata: { ...meta, ...partial } });
  };

  // Keyword input
  const [kwInput, setKwInput] = useState('');
  const addKeyword = () => {
    const kw = kwInput.trim();
    if (kw && !meta.keywords.includes(kw)) {
      updateMeta({ keywords: [...meta.keywords, kw] });
    }
    setKwInput('');
  };

  // GitHub publish state
  const [deployTarget, setDeployTarget] = useState<DeployTarget>('railway');
  const [ghRepo, setGhRepo] = useState(model.githubMeta?.repo || '');
  const [ghBranch, setGhBranch] = useState(model.githubMeta?.branch || 'main');
  const [ghToken, setGhToken] = useState('');
  const [ghBasePath, setGhBasePath] = useState('');
  const [repoAccess, setRepoAccess] = useState<{ isOwner: boolean; ownerLogin: string } | null>(null);
  const [repoCheckStatus, setRepoCheckStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [publishStatus, setPublishStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [publishResult, setPublishResult] = useState<DeployPushResult | null>(null);

  const willCreatePR = repoAccess !== null && !repoAccess.isOwner;

  const formatBlobSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  const handlePublish = async () => {
    setPublishStatus('loading');
    setPublishResult(null);
    try {
      // Build model with only selected layers
      const publishModel = {
        ...model,
        layers: model.layers.filter(l => selectedLayers.has(l.id)),
      };
      const source = {
        type: 'geopackage' as const,
        config: { filename: summary.filename },
        layerMappings: Object.fromEntries(
          publishModel.layers.map(l => [l.id, {
            sourceTable: l.name.toLowerCase().replace(/\s+/g, '_'),
            fieldMappings: {},
            primaryKeyColumn: 'fid',
          }])
        ),
      };
      const files = generateDeployFiles(publishModel, source, lang, deployTarget);
      const commitMsg = `[${publishModel.version}] Publish ${publishModel.name}`;
      
      // Build binary files map if data inclusion is enabled
      const binaryFiles: Record<string, Blob> | undefined = 
        includeData && dataBlob ? { [`data/${dataBlob.filename}`]: dataBlob.blob } : undefined;
      
      const result = await pushDeployKit(
        ghToken, ghRepo, ghBranch, ghBasePath, files, commitMsg,
        willCreatePR, `Publish: ${publishModel.name}`, binaryFiles
      );
      setPublishResult(result);
      setPublishStatus(result.success ? 'success' : 'error');
    } catch (e: any) {
      setPublishResult({ success: false, error: e.message });
      setPublishStatus('error');
    }
  };

  const handleDownloadZip = async () => {
    const publishModel = { ...model, layers: model.layers.filter(l => selectedLayers.has(l.id)) };
    const source = {
      type: 'geopackage' as const,
      config: { filename: summary.filename },
      layerMappings: Object.fromEntries(
        publishModel.layers.map(l => [l.id, {
          sourceTable: l.name.toLowerCase().replace(/\s+/g, '_'),
          fieldMappings: {},
          primaryKeyColumn: 'fid',
        }])
      ),
    };
    const binaryFilesForZip = includeData && dataBlob ? { [`data/${dataBlob.filename}`]: dataBlob.blob } : undefined;
    await exportDeployKit(publishModel, source, lang, deployTarget, binaryFilesForZip);
  };

  // Helper: update a single layer's style
  const updateLayerStyle = (layerId: string, partial: Partial<LayerStyle>) => {
    onUpdateModel({
      ...model,
      layers: model.layers.map(l =>
        l.id === layerId ? { ...l, style: { ...l.style, ...partial } } : l
      ),
    });
  };

  // Step indicators
  const st = t.styling || {};
  const steps = [
    { icon: Database, label: q.step1Title },
    { icon: Paintbrush, label: q.stepStyleTitle || st.title },
    { icon: Tag, label: q.step2Title },
    { icon: Github, label: q.step3Title },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-14 min-w-0 custom-scrollbar scroll-smooth">
      {/* Back + Open Editor buttons */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-colors group">
          <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-all"><ChevronLeft size={16} /></div>
          {q.backToStart}
        </button>
        <button onClick={onOpenEditor} className="text-[10px] font-black uppercase tracking-[0.15em] text-indigo-500 hover:text-indigo-700 transition-colors">
          {q.editModel} →
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <React.Fragment key={i}>
              {i > 0 && <div className={`flex-1 h-0.5 rounded-full transition-colors ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              <button
                onClick={() => i <= step && setStep(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  isActive ? 'bg-slate-900 text-white shadow-lg' :
                  isDone ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' :
                  'bg-slate-100 text-slate-400'
                }`}
              >
                {isDone ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 0: Review tables */}
      {step === 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{q.step1Title}</h2>
            <p className="text-sm text-slate-400 font-medium">{q.step1Desc}</p>
          </div>

          <div className="space-y-3">
            {summary.layers.map((layer, i) => {
              const modelLayer = model.layers[i];
              if (!modelLayer) return null;
              const isSelected = selectedLayers.has(modelLayer.id);
              return (
                <button
                  key={modelLayer.id}
                  onClick={() => {
                    const next = new Set(selectedLayers);
                    if (isSelected && next.size > 1) next.delete(modelLayer.id);
                    else next.add(modelLayer.id);
                    setSelectedLayers(next);
                  }}
                  className={`w-full flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all ${
                    isSelected
                      ? 'bg-white border-emerald-400 shadow-md shadow-emerald-50'
                      : 'bg-slate-50 border-slate-200 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 transition-colors ${
                    isSelected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {GEOM_ICONS[layer.geometryType] || '◇'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate">{layer.tableName}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {layer.geometryType} · {layer.featureCount.toLocaleString()} {q.features} · {layer.columnCount} {q.columns} · EPSG:{layer.srid}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                  }`}>
                    {isSelected && <Check size={14} strokeWidth={3} className="text-white" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4">
            <span className="text-xs text-slate-400 font-bold">{selectedLayers.size} {q.selectedLayers}</span>
            <button onClick={() => setStep(1)} className="px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-[0.15em] hover:bg-slate-800 active:scale-95 transition-all shadow-lg flex items-center gap-2">
              {q.next} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: Symbology */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{q.stepStyleTitle || st.title}</h2>
            <p className="text-sm text-slate-400 font-medium">{q.stepStyleDesc}</p>
          </div>

          <div className="space-y-6">
            {model.layers.filter(l => selectedLayers.has(l.id)).map((layer) => (
              <div key={layer.id} className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold bg-slate-100 text-slate-500`}>
                    {GEOM_ICONS[layer.geometryType] || '◇'}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{layer.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{layer.geometryType}</p>
                  </div>
                </div>
                <LayerStyleEditor
                  layer={layer}
                  onUpdate={(partial) => updateLayerStyle(layer.id, partial)}
                  t={t}
                  variant="light"
                  showPreview={true}
                />
              </div>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setStep(0)} className="px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all">
              {q.back}
            </button>
            <button onClick={() => setStep(2)} className="px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-[0.15em] hover:bg-slate-800 active:scale-95 transition-all shadow-lg flex items-center gap-2">
              {q.next} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Metadata */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{q.step2Title}</h2>
            <p className="text-sm text-slate-400 font-medium">{q.step2Desc}</p>
          </div>

          {/* Dataset name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.modelName}</label>
            <input
              value={model.name}
              onChange={e => onUpdateModel({ ...model, name: e.target.value })}
              className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.descriptionPlaceholder?.split('...')[0] || 'Beskrivelse'}</label>
            <textarea
              value={model.description}
              onChange={e => onUpdateModel({ ...model, description: e.target.value })}
              placeholder={t.descriptionPlaceholder}
              rows={2}
              className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all resize-none"
            />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{md.contactName}</label>
              <input value={meta.contactName} onChange={e => updateMeta({ contactName: e.target.value })} placeholder={md.contactNamePlaceholder} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{md.contactEmail}</label>
              <input value={meta.contactEmail} onChange={e => updateMeta({ contactEmail: e.target.value })} placeholder={md.contactEmailPlaceholder} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{md.contactOrganization}</label>
              <input value={meta.contactOrganization} onChange={e => updateMeta({ contactOrganization: e.target.value })} placeholder={md.contactOrganizationPlaceholder} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
          </div>

          {/* Theme + License */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{md.theme}</label>
              <select value={meta.theme} onChange={e => updateMeta({ theme: e.target.value })} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all cursor-pointer">
                <option value="">—</option>
                {Object.entries(md.themes || {}).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{md.license}</label>
              <select value={meta.license} onChange={e => updateMeta({ license: e.target.value })} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all cursor-pointer">
                {Object.entries(md.licenses || {}).map(([k, v]) => <option key={k} value={k}>{String(v)}</option>)}
              </select>
            </div>
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{md.keywords}</label>
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {meta.keywords.map((kw, i) => (
                <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold">
                  {kw}
                  <button onClick={() => updateMeta({ keywords: meta.keywords.filter((_, j) => j !== i) })} className="hover:text-red-500 transition-colors"><X size={12} /></button>
                </span>
              ))}
              <input
                value={kwInput}
                onChange={e => setKwInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder={md.keywordsPlaceholder}
                className="flex-1 min-w-[160px] bg-transparent text-sm font-medium outline-none placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setStep(1)} className="px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all">
              {q.back}
            </button>
            <button onClick={() => setStep(3)} className="px-8 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-[0.15em] hover:bg-slate-800 active:scale-95 transition-all shadow-lg flex items-center gap-2">
              {q.next} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Publish */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">{q.step3Title}</h2>
            <p className="text-sm text-slate-400 font-medium">{q.step3Desc}</p>
          </div>

          {/* How it works guide */}
          <div className="p-6 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-500">{q.publishGuideTitle}</h3>
            <ol className="space-y-3">
              {(q.publishGuideSteps || []).map((text: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm text-slate-600 font-medium leading-relaxed">
                  <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">{i + 1}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Summary badge */}
          <div className="flex flex-wrap gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
              <Layers size={12} className="inline mr-1.5 text-indigo-400" />{model.name}
            </span>
            <span className="px-3 py-1.5 bg-white rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
              {selectedLayers.size} {q.selectedLayers}
            </span>
            {meta.contactOrganization && (
              <span className="px-3 py-1.5 bg-emerald-50 rounded-xl text-xs font-bold text-emerald-600 border border-emerald-200">
                {meta.contactOrganization}
              </span>
            )}
            {meta.license && (
              <span className="px-3 py-1.5 bg-violet-50 rounded-xl text-xs font-bold text-violet-600 border border-violet-200">
                {meta.license}
              </span>
            )}
          </div>

          {/* Deploy target selector */}
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{d.targetTitle}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['railway', 'fly', 'ghcr', 'docker-compose'] as DeployTarget[]).map(tgt => {
                const icons: Record<DeployTarget, React.ReactNode> = {
                  'railway': <Cloud size={20} />,
                  'fly': <Cloud size={20} />,
                  'ghcr': <Package size={20} />,
                  'docker-compose': <Server size={20} />,
                };
                const isActive = deployTarget === tgt;
                return (
                  <button
                    key={tgt}
                    onClick={() => setDeployTarget(tgt)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      isActive
                        ? 'bg-white border-indigo-400 shadow-md shadow-indigo-50'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {icons[tgt]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900">{d.targets?.[tgt]}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">{d.targets?.[tgt + 'Desc']}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'
                    }`}>
                      {isActive && <Check size={12} strokeWidth={3} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GitHub config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{d.githubRepo}</label>
              <input value={ghRepo} onChange={e => setGhRepo(e.target.value)} onBlur={checkAccess} placeholder={d.githubRepoPlaceholder} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{d.githubToken}</label>
              <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} onBlur={checkAccess} placeholder="ghp_..." className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{d.githubBranch}</label>
              <input value={ghBranch} onChange={e => setGhBranch(e.target.value)} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{d.githubBasePath}</label>
              <input value={ghBasePath} onChange={e => setGhBasePath(e.target.value)} placeholder={d.githubBasePathPlaceholder} className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all" />
            </div>
          </div>

          {/* Repo access info */}
          {repoCheckStatus === 'checking' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-100 text-xs font-bold text-slate-500">
              <RefreshCw size={14} className="animate-spin" /> {d.repoChecking}
            </div>
          )}
          {repoCheckStatus === 'done' && repoAccess && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold ${
              willCreatePR ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              {willCreatePR ? <GitPullRequest size={14} /> : <Check size={14} strokeWidth={3} />}
              {willCreatePR ? d.repoAccessPR?.replace('{owner}', repoAccess.ownerLogin) : d.repoAccessDirect?.replace('{branch}', ghBranch)}
            </div>
          )}
          {repoCheckStatus === 'error' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-50 text-xs font-bold text-red-600 border border-red-200">
              <Info size={14} /> {d.repoAccessError}
            </div>
          )}

          {/* Publish result */}
          {publishStatus === 'success' && publishResult?.success && (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 animate-in zoom-in-95 duration-500">
              <div className="flex items-center gap-2 text-emerald-700">
                <Check size={20} strokeWidth={3} />
                <span className="text-sm font-black">{d.publishSuccess}</span>
              </div>
              <p className="text-xs text-emerald-600 font-medium">
                {publishResult.prUrl ? d.prCreatedDesc : d.directPushDesc}
              </p>
              {publishResult.prUrl && (
                <a href={publishResult.prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95">
                  <ExternalLink size={14} /> {d.viewPR}
                </a>
              )}
              {!publishResult.prUrl && publishResult.commitSha && (
                <a href={`https://github.com/${ghRepo}/commit/${publishResult.commitSha}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all active:scale-95">
                  <ExternalLink size={14} /> {d.viewCommit}
                </a>
              )}
            </div>
          )}
          {publishStatus === 'error' && (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-2">
              <span className="text-sm font-black text-red-700">{d.publishError}</span>
              <p className="text-xs text-red-500 font-mono">{publishResult?.error}</p>
            </div>
          )}

          {/* Include data toggle */}
          {dataBlob && (
            <div className={`p-5 rounded-2xl border-2 transition-all ${includeData ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <label className="flex items-start gap-4 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={includeData} 
                  onChange={e => setIncludeData(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className="text-sm font-black text-slate-800 block">{d.includeData}</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {dataBlob.filename} ({formatBlobSize(dataBlob.blob.size)}) {d.includeDataDesc} <code className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">data/</code>
                  </span>
                  {dataBlob.blob.size > 50 * 1024 * 1024 && includeData && (
                    <div className="flex items-center gap-2 mt-2 text-amber-700 text-xs font-bold">
                      <AlertTriangle size={14} />
                      {d.includeDataWarn50}
                    </div>
                  )}
                  {dataBlob.blob.size > 100 * 1024 * 1024 && includeData && (
                    <div className="flex items-center gap-2 mt-1 text-rose-700 text-xs font-bold">
                      <AlertTriangle size={14} />
                      {d.includeDataWarn100}
                    </div>
                  )}
                </div>
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setStep(2)} className="px-6 py-3 rounded-2xl border-2 border-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all">
              {q.back}
            </button>
            <div className="flex items-center gap-3">
              <button onClick={handleDownloadZip} className="px-4 py-3 rounded-2xl border-2 border-slate-200 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 active:scale-95 transition-all flex items-center gap-2">
                <Download size={14} /> {d.downloadZip}
              </button>
              <button
                onClick={handlePublish}
                disabled={!ghRepo || !ghToken || publishStatus === 'loading'}
                className="px-8 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.15em] hover:bg-emerald-500 active:scale-95 transition-all shadow-lg shadow-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {publishStatus === 'loading' ? (
                  <React.Fragment><RefreshCw size={16} className="animate-spin" /> {d.publishing}</React.Fragment>
                ) : publishStatus === 'success' ? (
                  <React.Fragment><Check size={16} strokeWidth={3} /> {d.publishSuccess}</React.Fragment>
                ) : (
                  <React.Fragment><Github size={16} /> {d.publishBtn}</React.Fragment>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickPublish;