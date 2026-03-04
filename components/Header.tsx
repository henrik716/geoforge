import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Hammer, Sparkles, X } from 'lucide-react';
import { Language } from '../types';
import { AiProvider, getProvider, setProvider, getApiKey, saveApiKey } from '../utils/aiService';

const Header: React.FC<{
  t: any;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onShowGuide: () => void;
  onHome?: () => void;
}> = ({ t, lang, onLangChange, onShowGuide, onHome }) => {
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [providerDraft, setProviderDraft] = useState<AiProvider>(getProvider());
  const [keyDraft, setKeyDraft] = useState('');
  const [hasKey, setHasKey] = useState(() => !!getApiKey());
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAiPanel) return;
    setProviderDraft(getProvider());
    setKeyDraft('');
    setHasKey(!!getApiKey());
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowAiPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAiPanel]);

  const handleSave = () => {
    if (!keyDraft.trim()) return;
    saveApiKey(keyDraft, providerDraft);
    setProvider(providerDraft);
    setHasKey(true);
    setKeyDraft('');
    setShowAiPanel(false);
  };

  const handleClear = () => {
    localStorage.removeItem(`geoforge-ai-key-${getProvider()}`);
    setHasKey(false);
    setKeyDraft('');
  };

  return (
    <header className="flex-none h-14 md:h-16 bg-white border-b border-slate-200 px-3 md:px-6 flex items-center justify-between z-[200] shadow-sm relative">

      {/* Added 'text-left' here to fix the button's default center alignment */}
      <button onClick={onHome} className="flex items-center gap-2 md:gap-4 overflow-hidden min-w-0 hover:opacity-80 transition-opacity text-left">
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 bg-indigo-600 shrink-0">
          <Hammer size={18} className="md:w-[22px] md:h-[22px]" />
        </div>
        <div className="overflow-hidden min-w-0">
          <h1 className="text-xs md:text-base font-black leading-tight truncate tracking-tight text-slate-800">{t.appTitle}</h1>
          <p className="text-[8px] md:text-[10px] text-slate-400 font-black uppercase tracking-[0.05em] md:tracking-[0.2em] truncate">{t.appSubtitle}</p>
        </div>
      </button>

      <div className="flex items-center gap-1 md:gap-3 shrink-0">

        {/* AI settings button */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setShowAiPanel(v => !v)}
            title={t.ai?.keyConfigured || 'AI settings'}
            className={`p-2 md:p-3 rounded-xl transition-all flex items-center gap-1.5 ${hasKey ? 'text-indigo-500 hover:bg-indigo-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'}`}
          >
            <Sparkles size={18} className="md:w-[20px] md:h-[20px]" />
            {hasKey && <span className="hidden md:block text-[9px] font-black uppercase tracking-widest">{getProvider()}</span>}
          </button>

          {showAiPanel && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 z-[300] animate-in zoom-in-95 slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black text-slate-700">{t.ai?.enterKey || 'AI API key'}</p>
                <button onClick={() => setShowAiPanel(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><X size={14} /></button>
              </div>

              {/* Provider toggle */}
              <div className="flex gap-2 mb-4">
                {(['claude', 'gemini'] as AiProvider[]).map(p => (
                  <button
                    key={p}
                    onClick={() => { setProviderDraft(p); setKeyDraft(''); setHasKey(!!getApiKey(p)); }}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${providerDraft === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {p === 'claude' ? 'Claude' : 'Gemini'}
                  </button>
                ))}
              </div>

              {/* Key status / input */}
              {hasKey && !keyDraft ? (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-3">
                  <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                    {t.ai?.keyConfigured || 'Key configured'} ✓
                  </span>
                  <button onClick={handleClear} className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest transition-colors">
                    {lang === 'no' ? 'Fjern' : 'Clear'}
                  </button>
                </div>
              ) : null}

              <input
                type="password"
                placeholder={providerDraft === 'claude' ? 'sk-ant-api03-…' : 'AIza…'}
                value={keyDraft}
                onChange={e => setKeyDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-indigo-500 mb-3 transition-colors"
                autoFocus={!hasKey}
              />

              <button
                onClick={handleSave}
                disabled={!keyDraft.trim()}
                className="w-full bg-indigo-600 text-white text-[10px] font-black py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t.ai?.saveKey || 'Save key'}
              </button>

              <p className="text-[9px] text-slate-400 mt-3 leading-relaxed">{t.ai?.keyStoredLocally || 'Stored in your browser only.'}</p>
            </div>
          )}
        </div>

        <button aria-label="Hjelp" onClick={onShowGuide} className="p-2 md:p-3 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0">
          <HelpCircle size={18} className="md:w-[22px] md:h-[22px]" />
        </button>

        <div className="flex items-center bg-slate-100 rounded-lg md:rounded-2xl p-0.5 md:p-1 border border-slate-200 shrink-0">
          <button onClick={() => onLangChange('no')} className={`px-1.5 md:px-3 py-1 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-xl transition-all ${lang === 'no' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>NO</button>
          <button onClick={() => onLangChange('en')} className={`px-1.5 md:px-3 py-1 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-md md:rounded-xl transition-all ${lang === 'en' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>EN</button>
        </div>
      </div>
    </header>
  );
};

export default Header;