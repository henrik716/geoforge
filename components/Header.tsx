import React from 'react';
import { HelpCircle, Hammer } from 'lucide-react';
import { Language } from '../types';

const Header: React.FC<{
  t: any;
  lang: Language;
  onLangChange: (lang: Language) => void;
  onShowGuide: () => void;
  onHome?: () => void;
}> = ({ t, lang, onLangChange, onShowGuide, onHome }) => {
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