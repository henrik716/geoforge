import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, Table, Copy, Check, 
  Terminal, RefreshCw, Database, 
  X, Info, ExternalLink, HelpCircle, ArrowRightLeft, 
  Layers, CheckCircle2, ListChecks, ArrowDown, Lock, ChevronDown, ChevronRight, Wand2,
  Server, Shield, Globe, CloudDownload, Link2, Search, Settings2, FileCode, BookOpen
} from 'lucide-react';
import { DataModel } from '../types';
import { processAnyFile } from '../utils/importUtils';

declare var initSqlJs: any;

interface LayerMapping {
  sourceLayer: string;
  fieldMappings: Record<string, string>; // modelPropId -> sourceFieldName
  valueMappings: Record<string, Record<string, string>>; // modelPropId -> { sourceVal: targetVal }
}

interface DataMapperProps {
  model: DataModel;
  t: any;
}

const DataMapper: React.FC<DataMapperProps> = ({ model, t }) => {
  const [sourceLayers, setSourceLayers] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<Record<string, string[]>>({}); // layerName -> fieldNames
  const [uniqueValues, setUniqueValues] = useState<Record<string, Record<string, string[]>>>({}); // layerName -> fieldName -> uniqueValues
  const [mappings, setMappings] = useState<Record<string, LayerMapping>>({}); // modelLayerId -> mapping
  const [activeModelLayerId, setActiveModelLayerId] = useState<string>(model.layers[0]?.id || '');
  const [sourceFilename, setSourceFilename] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [openValueMapId, setOpenValueMapId] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PostGIS Specific State
  const [targetType, setTargetType] = useState<'gpkg' | 'postgis'>('gpkg');
  const [pgConfig, setPgConfig] = useState({
    host: 'localhost',
    port: '5432',
    dbname: '',
    user: 'postgres',
    password: '',
    schema: 'public'
  });

  const activeLayer = model.layers.find(l => l.id === activeModelLayerId) || model.layers[0];
  const activeMapping = mappings[activeModelLayerId] || { sourceLayer: '', fieldMappings: {}, valueMappings: {} };

  // Calculate current progress for stepper
  const getStep = () => {
    if (!sourceFilename) return 1;
    if (!activeMapping.sourceLayer) return 2;
    const mappedLayerCount = Object.keys(mappings).filter(id => mappings[id].sourceLayer).length;
    if (mappedLayerCount > 0) return 3; // On step 3 currently
    return 2;
  };
  const currentStep = getStep();

  const processGeoJsonData = (json: any) => {
    let fields: string[] = [];
    let values: Record<string, Set<string>> = {};
    
    const features = json.features || (Array.isArray(json) ? json : []);
    if (features.length > 0) {
      const first = (features[0].properties || features[0]);
      fields = Object.keys(first);
      
      features.slice(0, 100).forEach((f: any) => {
         const p = f.properties || f;
         fields.forEach(field => {
            if (!values[field]) values[field] = new Set();
            if (p[field] !== undefined && p[field] !== null) values[field].add(String(p[field]));
         });
      });
    }
    setSourceLayers(['default']);
    setAllFields({ 'default': fields });
    setUniqueValues({ 'default': Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Array.from(v)])) });
    setMappings({});
  };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceFilename(file.name);
    setSourceUrl('');
    setIsLoading(true);

    try {
      // 1. Bruk den kraftige funksjonen for å hente ut struktur (tabeller og kolonner)
      // Dette gir automatisk støtte for GML, XML, Shapefiles etc.
      const { model: sourceModel } = await processAnyFile(file);

      const layers: string[] = [];
      const fieldsMap: Record<string, string[]> = {};
      const valuesMap: Record<string, Record<string, string[]>> = {};

      sourceModel.layers.forEach(layer => {
        layers.push(layer.name);
        fieldsMap[layer.name] = layer.properties.map(p => p.name);
        valuesMap[layer.name] = {};
      });

      // 2. Forsøk å hente ut unike data-verdier for tryllestav-verktøyet (hvis formatet støttes direkte)
      try {
        if (file.name.endsWith('.gpkg') || file.name.endsWith('.sqlite')) {
          const SQL = await initSqlJs({ locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm` });
          const arrayBuffer = await file.arrayBuffer();
          const db = new SQL.Database(new Uint8Array(arrayBuffer));

          for (const layerName of layers) {
            const fields = fieldsMap[layerName] || [];
            for (const field of fields) {
              try {
                const distinctRes = db.exec(`SELECT DISTINCT "${field}" FROM "${layerName}" LIMIT 50`);
                if (distinctRes.length > 0) {
                  valuesMap[layerName][field] = distinctRes[0].values.map(v => String(v[0])).filter(v => v !== 'null' && v !== '');
                }
              } catch (e) { /* Ignorer feil på enkeltkolonner */ }
            }
          }
        } else if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
          const text = await file.text();
          const json = JSON.parse(text);
          const features = json.features || (Array.isArray(json) ? json : []);
          
          if (features.length > 0 && layers.length > 0) {
            const layerName = layers[0]; 
            const fields = fieldsMap[layerName] || [];
            const valSets: Record<string, Set<string>> = {};
            fields.forEach(f => valSets[f] = new Set());

            features.slice(0, 100).forEach((f: any) => {
              const p = f.properties || f;
              fields.forEach(field => {
                if (p[field] !== undefined && p[field] !== null) {
                  valSets[field].add(String(p[field]));
                }
              });
            });
            
            Object.keys(valSets).forEach(k => {
              valuesMap[layerName][k] = Array.from(valSets[k]);
            });
          }
        }
      } catch (valueErr) {
        console.warn("Kunne ikke hente unike verdier for mapping, men strukturen ble lastet OK.", valueErr);
      }

      // 3. Oppdater state i komponenten
      setSourceLayers(layers);
      setAllFields(fieldsMap);
      setUniqueValues(valuesMap);
      setMappings({});

    } catch (err) {
      alert(t.importGisError || "Kunne ikke lese filen");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!sourceUrl) return;
    setIsLoading(true);
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error("Fetch failed");
      const json = await response.json();
      setSourceFilename(sourceUrl.split('/').pop()?.split('?')[0] || "API Data");
      processGeoJsonData(json);
      setShowUrlInput(false);
    } catch (err) {
      alert(t.fetchError);
    } finally {
      setIsLoading(false);
    }
  };

  const updateLayerMapping = (sourceLayer: string) => {
    setMappings(prev => ({
      ...prev,
      [activeModelLayerId]: { sourceLayer, fieldMappings: {}, valueMappings: {} }
    }));
  };

  const updateFieldMapping = (propId: string, sourceField: string) => {
    setMappings(prev => {
      const current = prev[activeModelLayerId] || { sourceLayer: '', fieldMappings: {}, valueMappings: {} };
      const newValueMappings = { ...current.fieldMappings };
      delete newValueMappings[propId];

      return {
        ...prev,
        [activeModelLayerId]: {
          ...current,
          fieldMappings: { ...current.fieldMappings, [propId]: sourceField },
          valueMappings: { ...current.valueMappings }
        }
      };
    });
  };

  const updateValueMapping = (propId: string, sourceVal: string, targetVal: string) => {
    setMappings(prev => {
      const current = prev[activeModelLayerId] || { sourceLayer: '', fieldMappings: {}, valueMappings: {} };
      const currentPropValueMap = current.valueMappings[propId] || {};
      
      return {
        ...prev,
        [activeModelLayerId]: {
          ...current,
          valueMappings: {
            ...current.valueMappings,
            [propId]: { ...currentPropValueMap, [sourceVal]: targetVal }
          }
        }
      };
    });
  };

  const handleAutoMap = () => {
    if (!activeLayer || !activeMapping.sourceLayer) return;
    const availableFields = allFields[activeMapping.sourceLayer] || [];
    const newFieldMappings = { ...activeMapping.fieldMappings };
    
    activeLayer.properties.forEach(prop => {
      const match = availableFields.find(sf => 
        sf.toLowerCase() === prop.name.toLowerCase() || 
        sf.toLowerCase() === prop.title.toLowerCase()
      );
      if (match) newFieldMappings[prop.id] = match;
    });

    setMappings(prev => ({
      ...prev,
      [activeModelLayerId]: { ...activeMapping, fieldMappings: newFieldMappings }
    }));
  };

  const generateOgrCommand = () => {
    const lines: string[] = [];
    
    const targetOutput = targetType === 'gpkg' 
      ? `"${model.name.replace(/\s/g, '_')}.gpkg"`
      : `PG:"host=${pgConfig.host} port=${pgConfig.port} dbname=${pgConfig.dbname || 'database'} user=${pgConfig.user} password=${pgConfig.password || 'password'}"`;

    const formatFlag = targetType === 'gpkg' ? '-f GPKG' : '-f PostgreSQL';
    const sourceString = sourceUrl ? `"${sourceUrl}"` : `"${sourceFilename}"`;

    Object.entries(mappings).forEach(([layerId, m]) => {
      const mapping = m as LayerMapping;
      if (!mapping.sourceLayer) return;
      const modelLayer = model.layers.find(l => l.id === layerId);
      if (!modelLayer) return;

      const targetLayerName = modelLayer.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      
      const selectFields = modelLayer.properties
        .filter(p => mapping.fieldMappings[p.id])
        .map(p => {
          const sourceF = mapping.fieldMappings[p.id];
          const vMap = mapping.valueMappings[p.id];
          
          if (vMap && Object.keys(vMap).length > 0) {
             let caseSql = `CASE `;
             Object.entries(vMap).forEach(([src, trg]) => {
                const trgVal = trg ? `'${trg}'` : 'NULL';
                caseSql += `WHEN "${sourceF}" = '${src}' THEN ${trgVal} `;
             });
             caseSql += `ELSE "${sourceF}" END`;
             return `${caseSql} AS "${p.name}"`;
          }
          
          return `"${sourceF}" AS "${p.name}"`;
        });
      
      const geomCol = modelLayer.geometryColumnName || 'geometri';
      const sql = `SELECT ${selectFields.length > 0 ? selectFields.join(', ') + ', ' : ''}geometry FROM "${mapping.sourceLayer}"`;
      
      lines.push(`ogr2ogr ${formatFlag} ${targetOutput} ${sourceString} \\
  -nln "${targetLayerName}" \\
  -nlt ${modelLayer.geometryType.toUpperCase()} \\
  -sql '${sql}' \\
  ${targetType === 'postgis' ? `-lco SCHEMA=${pgConfig.schema} ` : ''}-update -append \\
  -lco GEOMETRY_NAME=${geomCol}`);
    });

    return lines.join('\n\n');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateOgrCommand());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mappedLayerCount = Object.keys(mappings).filter(id => mappings[id].sourceLayer).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 pb-40 px-2 md:px-4 animate-in fade-in duration-700">
      
      {/* 0. GDAL INFO SECTION */}
      <section className="bg-white p-6 md:p-10 rounded-[32px] border-l-8 border-l-blue-600 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-start">
         <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
            <BookOpen size={32} />
         </div>
         <div className="space-y-3">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">{t.mapper.aboutGdal.title}</h2>
            <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed">
              {t.mapper.aboutGdal.desc}
            </p>
         </div>
      </section>

      {/* 1. PROGRESS STEPPER */}
      <div className="flex items-center justify-between px-4 sm:px-12 py-8 bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
        {[
          { id: 1, label: t.mapper.step1.split('. ')[1] || 'Source', icon: Upload },
          { id: 2, label: t.mapper.step2.split('. ')[1] || 'Target', icon: Table },
          { id: 3, label: t.mapper.step3.split('. ')[1] || 'Map', icon: ArrowRightLeft },
          { id: 4, label: t.mapper.step4.split('. ')[1] || 'Script', icon: FileCode },
        ].map((step, idx, arr) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2 relative z-10">
               <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${currentStep >= step.id ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-50 text-slate-300'}`}>
                  {currentStep > step.id ? <Check size={20} strokeWidth={3} /> : <step.icon size={18} />}
               </div>
               <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:block ${currentStep >= step.id ? 'text-indigo-900' : 'text-slate-400'}`}>
                  {step.label}
               </span>
            </div>
            {idx < arr.length - 1 && (
              <div className="flex-1 h-1 mx-2 md:mx-4 rounded-full bg-slate-100 overflow-hidden relative">
                 <div className={`absolute inset-0 bg-indigo-600 transition-all duration-700 ${currentStep > step.id ? 'w-full' : 'w-0'}`} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 1: SOURCE SELECTION */}
      <section className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm space-y-6 md:space-y-10">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                 <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
                   <Upload size={28} />
                 </div>
                 <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{t.mapper.step1}</h3>
                    <p className="text-xs text-slate-500 font-medium">{t.mapper.uploadHint}</p>
                 </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => { setShowUrlInput(false); fileInputRef.current?.click(); }}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 ${sourceFilename && !sourceUrl ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                >
                  {isLoading && !sourceUrl ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
                  {t.mapper.uploadSource}
                </button>
                <button 
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest active:scale-95 ${sourceUrl ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}
                >
                  <Globe size={16} />
                  {t.mapper.uploadUrl}
                </button>
              </div>
           </div>

           {showUrlInput && (
              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-blue-100 flex flex-col sm:flex-row gap-3 animate-in slide-in-from-top-2">
                 <input 
                   type="text" 
                   value={sourceUrl} 
                   onChange={e => setSourceUrl(e.target.value)} 
                   placeholder={t.urlPlaceholder} 
                   className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:border-blue-500" 
                 />
                 <button onClick={handleUrlFetch} disabled={isLoading || !sourceUrl} className="px-6 py-3.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50">
                    {t.fetchUrl}
                 </button>
              </div>
           )}

           {sourceFilename && (
              <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl border border-emerald-100 w-fit animate-in zoom-in-95">
                 <CheckCircle2 size={16} />
                 <span className="text-[10px] font-black uppercase tracking-widest truncate max-w-[200px] sm:max-w-[300px]">{sourceFilename}</span>
                 <button onClick={() => { setSourceFilename(''); setSourceUrl(''); setMappings({}); }} className="ml-2 hover:text-rose-600 transition-colors"><X size={16}/></button>
              </div>
           )}
           <input type="file" ref={fileInputRef} className="hidden" accept=".geojson,.json,.gpkg,.sqlite,.gml,.xml" onChange={handleFileUpload} />
      </section>

      {/* STEP 2: LAYER MATCHING */}
      <section className={`transition-all duration-500 ${!sourceFilename ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
         <div className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center gap-6">
               <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
                 <Table size={28} />
               </div>
               <div>
                  <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{t.mapper.step2}</h3>
                  <p className="text-xs text-slate-500 font-medium">{t.mapper.multiLayerHint}</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
               <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{t.mapper.selectTargetLayer}</label>
                  <div className="flex flex-wrap gap-2">
                     {model.layers.map(l => {
                        const isMapped = !!mappings[l.id]?.sourceLayer;
                        return (
                          <button 
                            key={l.id} 
                            onClick={() => setActiveModelLayerId(l.id)}
                            className={`px-4 py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${activeModelLayerId === l.id ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}
                          >
                            <Layers size={14} />
                            {l.name}
                            {isMapped && <CheckCircle2 size={12} className="text-emerald-400" />}
                          </button>
                        );
                     })}
                  </div>
               </div>

               <div className="space-y-4 p-6 bg-slate-50 rounded-[24px] border border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-blue-500">{t.mapper.selectSourceLayer}</label>
                  <div className="relative">
                    <select 
                      value={activeMapping.sourceLayer} 
                      onChange={e => updateLayerMapping(e.target.value)} 
                      className="w-full bg-white border border-slate-200 rounded-xl px-5 py-4 text-xs font-black text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none cursor-pointer"
                    >
                       <option value="">-- {t.mapper.selectSourceLayer} --</option>
                       {sourceLayers.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronDown size={18} /></div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* STEP 3: FIELD MAPPING TABLE */}
      <section className={`transition-all duration-500 ${!activeMapping.sourceLayer ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
         <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-6 md:px-10 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
               <div className="flex items-center gap-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
                    <ArrowRightLeft size={28} />
                  </div>
                  <div>
                     <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-none mb-1">{t.mapper.step3}</h3>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{activeLayer?.name}</p>
                  </div>
               </div>
               <button onClick={handleAutoMap} className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-200">
                  <Wand2 size={16}/> {t.mapper.autoMap}
               </button>
            </div>
            
            <div className="overflow-x-auto min-h-[400px]">
               <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-1/3">{t.mapper.targetFields}</th>
                      <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Type</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{t.mapper.sourceFields}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32 text-right">{t.mapper.mapValues}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {!activeLayer || activeLayer.properties.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-300 italic text-sm uppercase font-black tracking-widest">{t.mapper.noPropsTarget}</td>
                      </tr>
                    ) : (
                      activeLayer.properties.map(prop => {
                        const mappedField = activeMapping.fieldMappings[prop.id];
                        const isValueMappable = (prop.type === 'codelist' || (prop.constraints?.enumeration && prop.constraints.enumeration.length > 0)) && !!mappedField;
                        const valueMapCount = Object.keys(activeMapping.valueMappings[prop.id] || {}).length;

                        return (
                          <tr key={prop.id} className={`hover:bg-slate-50/80 transition-colors group ${mappedField ? 'bg-emerald-50/10' : ''}`}>
                            <td className="px-6 py-3">
                               <div className="font-black text-slate-800 text-sm mono">{prop.name}</div>
                               <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{prop.title}</div>
                            </td>
                            <td className="px-4 py-3">
                               <span className="text-[9px] font-black uppercase tracking-[0.1em] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                 {t.types[prop.type]}
                               </span>
                            </td>
                            <td className="px-6 py-3">
                               <div className="relative group/select">
                                  <select 
                                    value={mappedField || ''} 
                                    onChange={e => updateFieldMapping(prop.id, e.target.value)}
                                    className={`w-full py-2.5 px-4 pr-10 rounded-xl text-xs font-bold border transition-all outline-none appearance-none cursor-pointer ${mappedField ? 'bg-white border-emerald-400 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                  >
                                     <option value="">{t.mapper.unmapped}</option>
                                     {(allFields[activeMapping.sourceLayer] || []).map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                                  <ChevronDown size={14} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${mappedField ? 'text-emerald-500' : 'text-slate-300'}`} />
                               </div>
                            </td>
                            <td className="px-6 py-3 text-right">
                               {isValueMappable ? (
                                  <button 
                                    onClick={() => setOpenValueMapId(prop.id)}
                                    className={`p-2.5 rounded-xl border transition-all relative ${valueMapCount > 0 ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-sm' : 'bg-white border-slate-200 text-slate-300 hover:text-amber-500 hover:border-amber-300'}`}
                                    title={t.mapper.mapValues}
                                  >
                                    <Wand2 size={18} />
                                    {valueMapCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center border-2 border-white">{valueMapCount}</span>}
                                  </button>
                               ) : (
                                  <div className="p-2.5 text-slate-100"><Wand2 size={18} /></div>
                               )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
               </table>
            </div>
         </div>
      </section>

      {/* FIXED OVERLAY MODAL FOR VALUE MAPPING */}
      {openValueMapId && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-400">
             {/* Modal Header */}
             <div className="p-8 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{t.mapper.mapValues}</h3>
                   <p className="text-xs text-amber-600 font-bold uppercase tracking-widest mt-1">
                      {activeLayer?.properties.find(p => p.id === openValueMapId)?.name}
                   </p>
                </div>
                <button onClick={() => setOpenValueMapId(null)} className="p-3 bg-white hover:bg-rose-50 hover:text-rose-600 rounded-2xl transition-all shadow-sm">
                   <X size={24}/>
                </button>
             </div>
             
             {/* Modal Content */}
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                <div className="grid grid-cols-2 gap-8 px-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                   <span>Source Unique Value</span>
                   <span>Map to Target</span>
                </div>
                <div className="space-y-3">
                   {(uniqueValues[activeMapping.sourceLayer]?.[activeMapping.fieldMappings[openValueMapId]] || []).map(srcVal => {
                      const prop = activeLayer?.properties.find(p => p.id === openValueMapId)!;
                      const currentTarget = activeMapping.valueMappings[openValueMapId]?.[srcVal] || '';
                      const allowedValues = prop.type === 'codelist' ? prop.codelistValues : (prop.constraints?.enumeration?.map(v => ({ code: v, label: v })) || []);
                      
                      return (
                        <div key={srcVal} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-4 bg-slate-50 border border-slate-100 rounded-3xl group/val hover:bg-slate-100/50 transition-colors">
                           <div className="text-xs font-black mono text-slate-700 truncate bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">{srcVal}</div>
                           <div className="relative">
                              <select 
                                value={currentTarget} 
                                onChange={e => updateValueMapping(openValueMapId, srcVal, e.target.value)}
                                className={`w-full py-3 px-5 pr-10 rounded-2xl text-xs font-black border transition-all appearance-none cursor-pointer ${currentTarget ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-slate-200 text-slate-400 focus:border-amber-400'}`}
                              >
                                <option value="">{t.mapper.keepValue}</option>
                                {allowedValues.map(av => <option key={av.code} value={av.code}>{av.label || av.code}</option>)}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover/val:text-amber-500 transition-colors"><ChevronDown size={16}/></div>
                           </div>
                        </div>
                      );
                   })}
                </div>
             </div>
             
             {/* Modal Footer */}
             <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button onClick={() => setOpenValueMapId(null)} className="w-full sm:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black active:scale-95 transition-all">
                   {t.save}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* STEP 4: EXPORT OPTIONS & SCRIPT */}
      <section className={`transition-all duration-500 ${mappedLayerCount === 0 ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden border border-slate-800 flex flex-col relative">
               {!mappedLayerCount && <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"><div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-center"><Lock size={40} className="text-white/40 mx-auto mb-4" /><p className="text-white text-xs font-black uppercase tracking-widest">{t.mapper.mapOneHint}</p></div></div>}
               
               <div className="p-8 bg-slate-800/80 border-b border-slate-700">
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                     <button 
                       onClick={() => setTargetType('gpkg')} 
                       className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${targetType === 'gpkg' ? 'bg-indigo-600 text-white shadow-xl' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                     >
                       <Database size={18}/> GeoPackage
                     </button>
                     <button 
                       onClick={() => setTargetType('postgis')} 
                       className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${targetType === 'postgis' ? 'bg-blue-600 text-white shadow-xl' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                     >
                       <Server size={18}/> PostGIS / Cloud SQL
                     </button>
                  </div>

                  {targetType === 'postgis' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 animate-in slide-in-from-top-4">
                       {[
                         { label: 'Host', key: 'host' },
                         { label: 'Port', key: 'port' },
                         { label: 'Database', key: 'dbname' },
                         { label: 'User', key: 'user' },
                         { label: 'Password', key: 'password', type: 'password' },
                         { label: 'Schema', key: 'schema' }
                       ].map(f => (
                         <div key={f.key} className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{f.label}</label>
                            <input 
                              type={f.type || "text"} 
                              value={(pgConfig as any)[f.key]} 
                              onChange={e => setPgConfig({...pgConfig, [f.key]: e.target.value})} 
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-[11px] text-white outline-none focus:border-blue-500" 
                            />
                         </div>
                       ))}
                    </div>
                  )}
               </div>

               <div className="px-8 py-10 bg-slate-800 border-b border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                     <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-white shadow-2xl transition-all shrink-0 ${targetType === 'gpkg' ? 'bg-amber-500 shadow-amber-900/40' : 'bg-blue-500 shadow-blue-900/40'}`}>
                       <FileCode size={32} />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-white tracking-tight leading-none mb-1">{t.mapper.step4}</h3>
                        <p className="text-xs text-slate-400 font-medium">{t.mapper.generateScript}</p>
                     </div>
                  </div>
                  <button 
                     onClick={copyToClipboard}
                     className={`w-full sm:w-auto px-8 py-4 rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-3 shadow-2xl active:scale-95 ${copied ? 'bg-emerald-600 text-white shadow-emerald-900/40' : 'bg-slate-700 text-slate-300 hover:text-white'}`}
                  >
                     {copied ? <Check size={18} /> : <Copy size={18} />}
                     {copied ? t.copied : t.mapper.copyScript}
                  </button>
               </div>
               
               <div className="p-8 md:p-10 font-mono text-[10px] md:text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap break-all bg-black/40 overflow-y-auto max-h-[400px] custom-scrollbar select-all selection:bg-rose-500/30">
                  {mappedLayerCount > 0 ? generateOgrCommand() : <p className="opacity-20 italic text-center py-20 uppercase font-black tracking-widest">{t.mapper.mapOneHint}</p>}
               </div>
               
               <div className="p-8 bg-slate-800/40 border-t border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.mapper.explanation.title}</h5>
                     <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-slate-500 uppercase"><span className="text-rose-400">-f:</span> {t.mapper.explanation.f}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase"><span className="text-rose-400">-nln:</span> {t.mapper.explanation.nln}</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase"><span className="text-rose-400">-sql:</span> {t.mapper.explanation.sql}</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                     <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t.mapper.howToRun}</h5>
                     <p className="text-[9px] font-bold text-slate-500 leading-relaxed uppercase">{t.mapper.howToRunDesc}</p>
                  </div>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8 h-fit sticky top-8">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0"><Settings2 size={24}/></div>
                  <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">ETL Engine</h4>
               </div>
               
               <div className="space-y-6">
                  <div className="space-y-2">
                     <div className="flex items-center gap-2 text-indigo-700">
                        <Shield size={16} />
                        <h5 className="text-[10px] font-black uppercase tracking-widest">{targetType === 'postgis' ? t.mapper.dbMigration : t.mapper.simpleFileMig}</h5>
                     </div>
                     <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                        {targetType === 'postgis' ? t.mapper.postgisAdvantage : t.mapper.gpkgAdvantage}
                     </p>
                  </div>
                  
                  <div className="space-y-2">
                     <div className="flex items-center gap-2 text-indigo-700">
                        <Globe size={16} />
                        <h5 className="text-[10px] font-black uppercase tracking-widest">{t.mapper.scalableArch}</h5>
                     </div>
                     <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                        {t.mapper.intro}
                     </p>
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-100">
                  <a href="https://gdal.org/programs/ogr2ogr.html" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors group">
                    Official OGR Documentation
                    <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </a>
               </div>
            </div>
         </div>
      </section>
    </div>
  );
};

export default DataMapper;