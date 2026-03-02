import React, { useState, useRef } from 'react';
import {
  ChevronDown, ChevronUp, Trash2, Asterisk,
  ArrowUp, ArrowDown, Lock, Plus, Link, CornerDownRight
} from 'lucide-react';
import { ModelProperty, PropertyType, PropertyConstraints, SharedType } from '../types';
import { TYPE_CONFIG, createEmptyProperty } from '../constants';
import { ModelChange } from '../utils/diffUtils';
import ConstraintsEditor from './property/ConstraintsEditor';
import CodelistEditor from './property/CodelistEditor';

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



  // Recursive sub-property handlers
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

  // Depth color coding for nested properties
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

          <ConstraintsEditor prop={prop} onUpdate={onUpdate} t={t} />

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
            <CodelistEditor prop={prop} baselineProp={baselineProp} onUpdate={onUpdate} isGhost={isGhost} reviewMode={reviewMode} t={t} />
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