import React, { useState } from 'react';
import {
  ChevronLeft, Check, Database, Tag, Github, ArrowRight, Paintbrush
} from 'lucide-react';
import { DataModel, LayerStyle, ImportValidationResult } from '../types';
import { InferredDataSummary } from '../utils/importUtils';
import LayerStyleEditor from './LayerStyleEditor';
import ImportWarnings from './ImportWarnings';
import MetadataStep from './quickpublish/MetadataStep';
import PublishStep from './quickpublish/PublishStep';

interface QuickPublishProps {
  model: DataModel;
  summary: InferredDataSummary;
  validation?: ImportValidationResult;
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
  model, summary, validation, t, lang, onUpdateModel, onBack, onOpenEditor, dataBlob
}) => {
  const q = t.quickPublish || {};

  const [step, setStep] = useState(0);
  const [selectedLayers, setSelectedLayers] = useState<Set<string>>(
    new Set(model.layers.map(l => l.id))
  );

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

          {/* Validation warnings */}
          {validation && (
            <ImportWarnings
              key={`validation-${Date.now()}-${validation.warnings.length}-${validation.errors.length}-${validation.warnings.map(w => `${w.layerName}:${w.type}:${w.message}`).sort().join('|')}-${validation.errors.map(e => `${e.layerName}:${e.type}:${e.message}`).sort().join('|')}`}
              validation={validation}
              t={t}
              lang={lang}
            />
          )}

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
        <MetadataStep
          model={model}
          summary={summary}
          onUpdateModel={onUpdateModel}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
          t={t}
          lang={lang}
        />
      )}

      {/* STEP 3: Publish */}
      {step === 3 && (
        <PublishStep
          model={model}
          summary={summary}
          selectedLayers={selectedLayers}
          dataBlob={dataBlob}
          lang={lang}
          t={t}
        />
      )}
    </div>
  );
};

export default QuickPublish;