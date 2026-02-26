import React, { useState, useRef } from 'react';
import { 
  ChevronDown, ChevronUp, Trash2, Asterisk, 
  ArrowUp, ArrowDown, ShieldCheck, Lock, X, Plus, Info, MessageSquare, Link, CornerDownRight, Box
} from 'lucide-react';
import { ModelProperty, CodeValue, PropertyType, PropertyConstraints, SharedType } from '../types';
import { TYPE_CONFIG, createEmptyCodeValue, createEmptyProperty } from '../constants';
import { ModelChange } from '../utils/diffUtils';

interface PropertyEditorProps {
  prop: ModelProperty;
  baselineProp?: ModelProperty | null;
  onUpdate: (prop: ModelProperty) => void;
  onDelete: (id: string) => void;
  onMove: (direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
  t: any;
  allLayers: { id: string, name: string }[];
  sharedTypes?: SharedType[]; // <--- NEW: Passed down from ModelEditor
  change?: ModelChange;
  isGhost?: boolean;
  reviewMode?: boolean;
  depth?: number; 
}

const PropDiffField: React.FC<{
  label: string;
  currentValue: any;
  baselineValue: any;
  reviewMode: boolean;
  children: React.ReactNode;
}> = ({ label, currentValue, baselineValue, reviewMode, children }) => {
  const isChanged = reviewMode && baselineValue !== undefined && baselineValue !== null && currentValue !== baselineValue;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{label}</label>
        {isChanged && (
          <span className="text-[9px] text-rose-500 line-through font-bold">
            {String(baselineValue)}
          </span>
        )}
      </div>
      <div className={`transition-all ${isChanged ? 'ring-2 ring-amber-400 bg-amber-50 rounded-xl overflow-hidden' : ''}`}>
        {children}
      </div>
    </div>
  );
};

const PropertyEditor: React.FC<PropertyEditorProps> = ({ 
  prop, baselineProp, onUpdate, onDelete, onMove, isFirst, isLast, t, allLayers, sharedTypes = [], change, isGhost, reviewMode, depth = 0 
}) => {
  const [isOpen, setIsOpen] = useState(prop.name === "" || depth > 0);
  const [isConstraintsOpen, setIsConstraintsOpen] = useState(false);
  const [enumInputValue, setEnumInputValue] = useState('');
  const [expandedDescs, setExpandedDescs] = useState<Record<string, boolean>>({});
  const config = TYPE_CONFIG[prop.type] || TYPE_CONFIG.string;
  const nameInputRef = useRef<HTMLInputElement>(null);

  const c = prop.constraints || {};
  const hasActiveConstraints = Object.keys(c).some(k => {
    const val = c[k as keyof PropertyConstraints];
    return val !== undefined && val !== '' && val !== false && (!Array.isArray(val) || val.length > 0);
  });

  const handleUpdate = (updates: Partial<ModelProperty>) => {
    onUpdate({ ...prop, ...updates });
  };

  const handleConstraintUpdate = (updates: Partial<PropertyConstraints>) => {
    handleUpdate({
      constraints: { ...(prop.constraints || {}), ...updates }
    });
  };

  const handleAddCodeValue = () => {
    const newValue = createEmptyCodeValue();
    handleUpdate({
      codelistValues: [...(prop.codelistValues || []), newValue]
    });
  };

  const handleUpdateCodeValue = (updated: CodeValue) => {
    handleUpdate({
      codelistValues: (prop.codelistValues || []).map(v => v.id === updated.id ? updated : v)
    });
  };

  const handleDeleteCodeValue = (id: string) => {
    handleUpdate({
      codelistValues: (prop.codelistValues || []).filter(v => v.id !== id)
    });
  };

  const toggleDesc = (id: string) => {
    setExpandedDescs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddEnum = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const currentEnum = prop.constraints?.enumeration || [];
    if (!currentEnum.includes(trimmed)) {
      handleConstraintUpdate({ enumeration: [...currentEnum, trimmed] });
    }
    setEnumInputValue('');
  };

  const handleRemoveEnum = (val: string) => {
    const currentEnum = prop.constraints?.enumeration || [];
    handleConstraintUpdate({ enumeration: currentEnum.filter(v => v !== val) });
  };

  const handleEnumKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddEnum(enumInputValue);
    }
  };

  // --- REKURSJON FOR SUB-PROPERTIES ---
  const handleAddSubProperty = () => {
    handleUpdate({
      subProperties: [...(prop.subProperties || []), createEmptyProperty()]
    });
    setIsOpen(true);
  };

  const handleUpdateSubProperty = (updatedProp: ModelProperty) => {
    handleUpdate({
      subProperties: (prop.subProperties || []).map(p => p.id === updatedProp.id ? updatedProp : p)
    });
  };

  const handleDeleteSubProperty = (id: string) => {
    handleUpdate({
      subProperties: (prop.subProperties || []).filter(p => p.id !== id)
    });
  };

  const handleMoveSubProperty = (id: string, direction: 'up' | 'down') => {
    const index = (prop.subProperties || []).findIndex(p => p.id === id);
    if (index === -1) return;
    
    const newProps = [...(prop.subProperties || [])];
    if (direction === 'up' && index > 0) {
      [newProps[index - 1], newProps[index]] = [newProps[index], newProps[index - 1]];
    } else if (direction === 'down' && index < newProps.length - 1) {
      [newProps[index + 1], newProps[index]] = [newProps[index], newProps[index + 1]];
    } else {
      return;
    }
    handleUpdate({ subProperties: newProps });
  };
  // -------------------------------------

  const renderDefaultInput = () => {
    const commonClasses = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-12";
    
    switch (prop.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-3 py-2">
            <input 
              type="checkbox" 
              checked={prop.defaultValue === 'true'}
              onChange={e => handleUpdate({ defaultValue: e.target.checked ? 'true' : 'false' })}
              className="w-7 h-7 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] font-black text-slate-500 uppercase">{prop.defaultValue === 'true' ? 'True' : 'False'}</span>
          </div>
        );
      case 'number':
      case 'integer':
        return <input type="number" placeholder={t.propDefaultPlaceholder} value={prop.defaultValue || ''} onChange={e => handleUpdate({ defaultValue: e.target.value })} className={commonClasses} />;
      case 'date':
        return <input type="date" value={prop.defaultValue || ''} onChange={e => handleUpdate({ defaultValue: e.target.value })} className={commonClasses} />;
      case 'codelist':
        return (
          <select value={prop.defaultValue || ''} onChange={e => handleUpdate({ defaultValue: e.target.value })} className={commonClasses}>
            <option value="">None</option>
            {prop.codelistValues.map(v => (
              <option key={v.id} value={v.code}>{v.label || v.code}</option>
            ))}
          </select>
        );
      case 'json':
        return <textarea placeholder='{ "id": 1, "status": "active" }' value={prop.defaultValue || ''} onChange={e => handleUpdate({ defaultValue: e.target.value })} className={commonClasses + " mono h-24 resize-none"} />;
      case 'relation':
      case 'object':
      case 'array':
      case 'shared_type':
        return (
          <div className="flex items-center gap-2 text-slate-400 italic text-xs h-12">
            <Link size={14} />
            <span>Standardverdi støttes ikke for denne typen</span>
          </div>
        );
      default:
        return <input type="text" placeholder={t.propDefaultPlaceholder} value={prop.defaultValue || ''} onChange={e => handleUpdate({ defaultValue: e.target.value })} className={commonClasses} />;
    }
  };

  const renderConstraints = () => {
    const isNumeric = prop.type === 'number' || prop.type === 'integer';
    const isString = prop.type === 'string' || prop.type === 'codelist';
    const c = prop.constraints || {};

    if (prop.type === 'object' || prop.type === 'array' || prop.type === 'relation' || prop.type === 'shared_type') return null;

    return (
      <div className="space-y-2 pt-2">
        <button 
          onClick={() => setIsConstraintsOpen(!isConstraintsOpen)}
          className={`w-full flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-colors py-4 px-5 rounded-xl border ${isConstraintsOpen ? 'text-emerald-700 bg-emerald-50 border-emerald-100 shadow-sm' : 'text-slate-500 bg-white border-slate-100 hover:border-emerald-200'}`}
        >
          <ShieldCheck size={16} className={hasActiveConstraints ? "text-emerald-600" : "text-slate-300"} />
          {t.constraints.title}
          <div className="ml-auto flex items-center gap-2">
            {hasActiveConstraints && !isConstraintsOpen && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {isConstraintsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>
        
        {isConstraintsOpen && (
          <div className="bg-slate-50 p-5 rounded-xl border border-emerald-100 space-y-5 animate-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-x-6 gap-y-4 px-2 py-1">
                 <label className="flex items-center gap-3 cursor-pointer select-none">
                   <input type="checkbox" checked={!!prop.required} onChange={e => handleUpdate({ required: e.target.checked })} className="w-6 h-6 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600" />
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{t.constraints.notNull}</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer select-none">
                   <input type="checkbox" checked={!!c.isPrimaryKey} onChange={e => handleConstraintUpdate({ isPrimaryKey: e.target.checked })} className="w-6 h-6 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600" />
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{t.constraints.primaryKey}</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer select-none">
                   <input type="checkbox" checked={!!c.isUnique} onChange={e => handleConstraintUpdate({ isUnique: e.target.checked })} className="w-6 h-6 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600" />
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{t.constraints.unique}</span>
                 </label>
              </div>

              {(isNumeric || isString) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-emerald-100/50">
                  {isNumeric && (
                    <>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">{t.constraints.min}</label>
                        <input type="number" value={c.min ?? ''} onChange={e => handleConstraintUpdate({ min: e.target.value ? Number(e.target.value) : undefined })} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all h-11" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">{t.constraints.max}</label>
                        <input type="number" value={c.max ?? ''} onChange={e => handleConstraintUpdate({ max: e.target.value ? Number(e.target.value) : undefined })} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all h-11" />
                      </div>
                    </>
                  )}
                  {isString && (
                    <>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">{t.constraints.minLength}</label>
                        <input type="number" min="0" value={c.minLength ?? ''} onChange={e => handleConstraintUpdate({ minLength: e.target.value ? Number(e.target.value) : undefined })} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all h-11" />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">{t.constraints.maxLength}</label>
                        <input type="number" min="0" value={c.maxLength ?? ''} onChange={e => handleConstraintUpdate({ maxLength: e.target.value ? Number(e.target.value) : undefined })} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all h-11" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">{t.constraints.pattern}</label>
                        <input type="text" placeholder={t.constraints.patternPlaceholder} value={c.pattern ?? ''} onChange={e => handleConstraintUpdate({ pattern: e.target.value || undefined })} className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono outline-none focus:border-emerald-500 transition-all h-11" />
                      </div>
                      <div className="sm:col-span-2 space-y-4 pt-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">{t.constraints.enumeration}</label>
                        <div className="flex flex-wrap gap-2.5">
                           {c.enumeration?.map((val) => (
                             <span key={val} className="inline-flex items-center gap-2 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-sm animate-in zoom-in-95 duration-150">
                               {val}
                               <button onClick={() => handleRemoveEnum(val)} className="text-emerald-200 hover:text-white transition-colors p-0.5">
                                 <X size={12} />
                               </button>
                             </span>
                           ))}
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder={t.constraints.enumPlaceholder} 
                            value={enumInputValue} 
                            onKeyDown={handleEnumKeyDown}
                            onChange={e => setEnumInputValue(e.target.value)} 
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-emerald-500 transition-all h-12" 
                          />
                          <button onClick={() => handleAddEnum(enumInputValue)} className="w-12 h-12 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shrink-0 flex items-center justify-center">
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Funksjon for fargekoding av innrykk
  const getDepthColor = () => {
    const colors = ['bg-slate-200', 'bg-indigo-300', 'bg-emerald-300', 'bg-amber-300', 'bg-rose-300'];
    return colors[depth % colors.length];
  };

  return (
    <div className={`bg-white rounded-2xl border transition-all relative ${isOpen ? 'border-indigo-200 ring-4 ring-indigo-50 shadow-sm mb-4' : 'border-slate-200 hover:border-slate-300'} ${change ? (change.type === 'added' ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-amber-500 ring-4 ring-amber-50') : ''} ${isGhost ? 'opacity-50 grayscale-[0.5] border-rose-300 bg-rose-50/10 pointer-events-none' : ''}`}>
      {(change || isGhost) && (
        <div className={`absolute -top-2.5 -right-2.5 px-2 py-1 rounded-lg text-[9px] font-black text-white shadow-lg z-10 animate-in zoom-in-95 duration-300 ${isGhost ? 'bg-rose-600' : (change?.type === 'added' ? 'bg-emerald-500' : 'bg-amber-500')}`}>
          {isGhost ? t.review.deleted.toUpperCase() : (change?.type === 'added' ? t.review.added.toUpperCase() : t.review.modified.toUpperCase())}
        </div>
      )}
      <div onClick={() => setIsOpen(!isOpen)} className={`px-3 py-4 flex items-center justify-between cursor-pointer group ${depth > 0 ? 'bg-slate-50/50 rounded-2xl' : ''}`}>
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
            <button disabled={isFirst || isGhost} onClick={() => onMove('up')} className={`p-2 rounded-lg transition-all ${isFirst || isGhost ? 'text-slate-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}><ArrowUp size={18} /></button>
            <button disabled={isLast || isGhost} onClick={() => onMove('down')} className={`p-2 rounded-lg transition-all ${isLast || isGhost ? 'text-slate-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}><ArrowDown size={18} /></button>
          </div>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-black shrink-0 shadow-sm" style={{ backgroundColor: config.bg, color: config.color }}>{config.icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-sm md:text-base font-bold truncate ${prop.name ? 'text-slate-800' : 'text-slate-300 italic'} ${isGhost ? 'line-through text-rose-500' : ''}`}>{prop.name || 'felt_navn'}</span>
              {prop.required && <Asterisk size={11} className="text-indigo-500" />}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">
              <span>{t.types[prop.type]}</span>
              {prop.title && <span className="hidden xs:inline truncate opacity-60">• {prop.title}</span>}
              
              {/* Vise navnet på den delte typen i overskriften hvis det er valgt */}
              {prop.type === 'shared_type' && prop.sharedTypeId && (
                <span className="hidden xs:inline font-bold text-fuchsia-600 truncate ml-1 px-1.5 py-0.5 bg-fuchsia-50 rounded">
                  {sharedTypes.find(st => st.id === prop.sharedTypeId)?.name || 'Ukjent'}
                </span>
              )}

              {(hasActiveConstraints || (prop.constraints && Object.keys(prop.constraints).length > 0)) && <Lock size={9} className="text-emerald-600 shrink-0" />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isGhost && <button onClick={(e) => { e.stopPropagation(); onDelete(prop.id); }} className="p-3 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all"><Trash2 size={20} /></button>}
          {isOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="px-5 pb-8 pt-2 border-t border-slate-50 space-y-6 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <PropDiffField label={t.propName} currentValue={prop.name} baselineValue={baselineProp?.name} reviewMode={!!reviewMode}>
              <input ref={nameInputRef} type="text" placeholder={t.propNamePlaceholder} value={prop.name} onChange={e => handleUpdate({ name: e.target.value.replace(/\s+/g, '_').toLowerCase() })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-mono focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-12" />
            </PropDiffField>
            <PropDiffField label={t.propTitle} currentValue={prop.title} baselineValue={baselineProp?.title} reviewMode={!!reviewMode}>
              <input type="text" placeholder={t.propTitlePlaceholder} value={prop.title} onChange={e => handleUpdate({ title: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-12" />
            </PropDiffField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-end">
            <PropDiffField label={t.propType} currentValue={prop.type} baselineValue={baselineProp?.type} reviewMode={!!reviewMode}>
              <div className="relative">
                <select value={prop.type} onChange={e => handleUpdate({ type: e.target.value as PropertyType, defaultValue: '', constraints: {} })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer h-12">
                  {Object.entries(t.types).filter(([k]) => k !== 'geometry').map(([k, v]) => (
                      <option key={k} value={k}>{v as string}</option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </PropDiffField>

            {/* --- SHARED TYPE SELECTOR --- */}
            {prop.type === 'shared_type' && (
              <PropDiffField label="Velg Datatype" currentValue={prop.sharedTypeId} baselineValue={baselineProp?.sharedTypeId} reviewMode={!!reviewMode}>
                <div className="relative">
                  <select 
                    value={prop.sharedTypeId || ''} 
                    onChange={e => handleUpdate({ sharedTypeId: e.target.value })}
                    className="w-full bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-900 rounded-xl px-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-fuchsia-500/10 focus:border-fuchsia-500 outline-none transition-all appearance-none cursor-pointer h-12"
                  >
                    <option value="">-- Velg type --</option>
                    {sharedTypes.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-fuchsia-400 pointer-events-none" />
                </div>
              </PropDiffField>
            )}

          </div>

          {prop.type !== 'object' && prop.type !== 'array' && prop.type !== 'shared_type' && (
            <PropDiffField label={t.propDefault} currentValue={prop.defaultValue} baselineValue={baselineProp?.defaultValue} reviewMode={!!reviewMode}>
               {renderDefaultInput()}
            </PropDiffField>
          )}

          {renderConstraints()}

          {prop.type === 'relation' && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <PropDiffField label={t.propTargetLayer} currentValue={prop.relationConfig?.targetLayerId} baselineValue={baselineProp?.relationConfig?.targetLayerId} reviewMode={!!reviewMode}>
                  <div className="relative">
                    <select 
                      value={prop.relationConfig?.targetLayerId || ''} 
                      onChange={e => handleUpdate({ relationConfig: { ...(prop.relationConfig || { relationType: 'foreign_key' }), targetLayerId: e.target.value } as any })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer h-12"
                    >
                      <option value="">-- {t.propTargetLayer} --</option>
                      {allLayers.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </PropDiffField>

                <PropDiffField label={t.propRelationType} currentValue={prop.relationConfig?.relationType} baselineValue={baselineProp?.relationConfig?.relationType} reviewMode={!!reviewMode}>
                  <div className="relative">
                    <select 
                      value={prop.relationConfig?.relationType || 'foreign_key'} 
                      onChange={e => handleUpdate({ relationConfig: { ...(prop.relationConfig || { targetLayerId: '' }), relationType: e.target.value as any } as any })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer h-12"
                    >
                      <optgroup label={t.relationGroups.standard}>
                        <option value="foreign_key">{t.relationTypes.foreign_key}</option>
                      </optgroup>
                      <optgroup label={t.relationGroups.spatial}>
                        <option value="intersects">{t.relationTypes.intersects}</option>
                        <option value="contains">{t.relationTypes.contains}</option>
                        <option value="within">{t.relationTypes.within}</option>
                        <option value="touches">{t.relationTypes.touches}</option>
                        <option value="crosses">{t.relationTypes.crosses}</option>
                      </optgroup>
                    </select>
                    <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </PropDiffField>
              </div>

              {prop.relationConfig?.relationType === 'foreign_key' && (
                <div className="pt-2">
                  <PropDiffField label="" currentValue={prop.relationConfig?.cascadeDelete} baselineValue={baselineProp?.relationConfig?.cascadeDelete} reviewMode={!!reviewMode}>
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={!!prop.relationConfig?.cascadeDelete} 
                        onChange={e => handleUpdate({ relationConfig: { ...(prop.relationConfig || { targetLayerId: '', relationType: 'foreign_key' }), cascadeDelete: e.target.checked } as any })}
                        className="w-6 h-6 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600" 
                      />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{t.propCascadeDelete}</span>
                    </label>
                  </PropDiffField>
                </div>
              )}
            </div>
          )}

          {prop.type === 'codelist' && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-4 border-b border-slate-200/50">
                <div className="flex flex-wrap items-center gap-6">
                  <PropDiffField label={t.propCodelistMode} currentValue={prop.codelistMode} baselineValue={baselineProp?.codelistMode} reviewMode={!!reviewMode}>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name={`mode-${prop.id}`} checked={prop.codelistMode === 'inline'} onChange={() => handleUpdate({ codelistMode: 'inline' })} className="w-6 h-6 accent-indigo-600" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{t.propCodelistModeInline}</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name={`mode-${prop.id}`} checked={prop.codelistMode === 'external'} onChange={() => handleUpdate({ codelistMode: 'external' })} className="w-6 h-6 accent-indigo-600" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide">{t.propCodelistModeExternal}</span>
                      </label>
                    </div>
                  </PropDiffField>
                </div>
                {prop.codelistMode === 'inline' && !isGhost && (
                   <button onClick={handleAddCodeValue} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-white hover:bg-indigo-600 transition-all bg-indigo-50 px-5 py-3 rounded-xl border border-indigo-100 flex items-center justify-center gap-2">
                     <Plus size={16} /> {t.addValue}
                   </button>
                )}
              </div>

              {prop.codelistMode === 'external' ? (
                <PropDiffField label={t.propCodelistUrl} currentValue={prop.codelistUrl} baselineValue={baselineProp?.codelistUrl} reviewMode={!!reviewMode}>
                  <input type="text" placeholder={t.propCodelistUrlPlaceholder} value={prop.codelistUrl} onChange={e => handleUpdate({ codelistUrl: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-xs focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-12" />
                </PropDiffField>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-[80px_1fr_90px] gap-2 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <span>{t.codeKey}</span>
                    <span>{t.codeLabel}</span>
                    <span className="text-right"></span>
                  </div>
                  
                  <div className="space-y-3">
                    {prop.codelistValues.map((v) => {
                      const isExpanded = expandedDescs[v.id];
                      const baselineVal = baselineProp?.codelistValues.find(bv => bv.id === v.id);
                      return (
                        <div key={v.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm transition-all hover:border-indigo-200">
                          <div className="grid grid-cols-[80px_1fr_90px] items-center gap-2 p-2">
                            <PropDiffField label="" currentValue={v.code} baselineValue={baselineVal?.code} reviewMode={!!reviewMode}>
                              <input 
                                placeholder="ID" 
                                value={v.code} 
                                onChange={e => handleUpdateCodeValue({ ...v, code: e.target.value })} 
                                className="w-full bg-slate-50 border-transparent rounded-lg px-2.5 py-2.5 text-xs font-mono outline-none focus:bg-white focus:border-indigo-100 border h-10" 
                              />
                            </PropDiffField>
                            <PropDiffField label="" currentValue={v.label} baselineValue={baselineVal?.label} reviewMode={!!reviewMode}>
                              <input 
                                placeholder="Navn" 
                                value={v.label} 
                                onChange={e => handleUpdateCodeValue({ ...v, label: e.target.value })} 
                                className="w-full bg-slate-50 border-transparent rounded-lg px-2.5 py-2.5 text-xs font-bold outline-none focus:bg-white focus:border-indigo-100 border h-10" 
                              />
                            </PropDiffField>
                            <div className="flex items-center justify-end gap-1.5">
                               <button 
                                 onClick={() => toggleDesc(v.id)} 
                                 className={`p-2.5 rounded-lg transition-colors ${v.description ? 'text-blue-500 bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
                                 title={t.codeDescription}
                               >
                                 <MessageSquare size={18} />
                               </button>
                               {!isGhost && <button 
                                 onClick={() => handleDeleteCodeValue(v.id)} 
                                 className="p-2.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                               >
                                 <Trash2 size={18} />
                               </button>}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-50 bg-slate-50/30 animate-in slide-in-from-top-1">
                              <PropDiffField label={t.codeDescription} currentValue={v.description} baselineValue={baselineVal?.description} reviewMode={!!reviewMode}>
                                <textarea 
                                  placeholder="..." 
                                  value={v.description} 
                                  onChange={e => handleUpdateCodeValue({ ...v, description: e.target.value })} 
                                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[11px] min-h-[70px] resize-none outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                                />
                              </PropDiffField>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {prop.codelistValues.length === 0 && (
                      <div className="py-12 text-center text-slate-300 italic text-[10px] uppercase tracking-widest font-black border-2 border-dashed border-slate-100 rounded-2xl">
                        Ingen verdier lagt til ennå.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <PropDiffField label={t.propDescription} currentValue={prop.description} baselineValue={baselineProp?.description} reviewMode={!!reviewMode}>
            <textarea placeholder={t.propDescriptionPlaceholder} value={prop.description} onChange={e => handleUpdate({ description: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all min-h-[100px] resize-none leading-relaxed" />
          </PropDiffField>

          {/* --- NESTED SUB-PROPERTIES (OBJECT/ARRAY) --- */}
          {(prop.type === 'object' || prop.type === 'array') && (
            <div className="mt-8 relative">
              <div className={`absolute top-0 bottom-0 left-5 w-0.5 ${getDepthColor()} rounded-full opacity-50`}></div>
              
              <div className="pl-10 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <CornerDownRight size={16} className={depth === 0 ? "text-slate-400" : "text-indigo-400"} />
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {prop.type === 'object' ? 'Objekt-struktur' : 'Array-struktur'}
                  </h4>
                </div>
                
                <div className="space-y-3">
                  {(prop.subProperties || []).map((subProp, idx) => {
                    const subBaseline = baselineProp?.subProperties?.find(p => p.id === subProp.id);
                    return (
                      <PropertyEditor
                        key={subProp.id}
                        prop={subProp}
                        baselineProp={subBaseline}
                        onUpdate={handleUpdateSubProperty}
                        onDelete={handleDeleteSubProperty}
                        onMove={(dir) => handleMoveSubProperty(subProp.id, dir)}
                        isFirst={idx === 0}
                        isLast={idx === (prop.subProperties || []).length - 1}
                        t={t}
                        allLayers={allLayers}
                        sharedTypes={sharedTypes} // Pass down types
                        isGhost={isGhost}
                        reviewMode={reviewMode}
                        depth={depth + 1}
                      />
                    );
                  })}
                </div>

                {!isGhost && (
                  <button 
                    onClick={handleAddSubProperty} 
                    className={`w-full py-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-black text-[9px] uppercase tracking-[0.2em] hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 active:scale-[0.99]`}
                  >
                    <Plus size={14} /> {t.addSubProperty || 'Legg til under-felt'}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default PropertyEditor;