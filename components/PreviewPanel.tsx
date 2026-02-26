import React, { useState } from 'react';
import { 
  Eye, Code2, Share2, Database, Github
} from 'lucide-react';
import { DataModel } from '../types';
import VisualTab from './preview/VisualTab';
import ExportTab from './preview/ExportTab';
import TutorialTab from './preview/TutorialTab';
import SchemaTab from './preview/SchemaTab';
import GithubTab from './preview/GithubTab';

interface PreviewPanelProps {
  model: DataModel;
  baselineModel: DataModel | null;
  githubConfig: { token: string; repo: string; path: string; branch: string };
  onImport: (model: DataModel) => void;
  onUpdate: (model: DataModel) => void;
  onSetBaseline: (model: DataModel) => void;
  onUpdateGithubConfig: (config: any) => void;
  t: any;
  lang: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  model, baselineModel, githubConfig, onImport, onUpdate, onSetBaseline, onUpdateGithubConfig, t, lang 
}) => {
  const [tab, setTab] = useState<'visual' | 'schema' | 'export' | 'tutorial' | 'github'>('visual');

  return (
    <div className="flex flex-col w-full h-full bg-white overflow-hidden min-w-0">
      <div className="flex-none px-4 md:px-6 pt-5 border-b border-slate-100 overflow-x-auto no-scrollbar scroll-smooth">
        <div className="flex gap-4 md:gap-6 pb-px min-w-max">
          {[
            { id: 'visual', icon: Eye, label: t.visualTab },
            { id: 'export', icon: Share2, label: t.exportTab },
            { id: 'tutorial', icon: Database, label: t.tutorialTab },
            { id: 'schema', icon: Code2, label: t.schemaTab },
            { id: 'github', icon: Github, label: t.githubTab }
          ].map(tabItem => (
            <button 
              key={tabItem.id}
              onClick={() => setTab(tabItem.id as any)} 
              className={`flex items-center gap-2 pb-4 text-[10px] md:text-xs font-black uppercase tracking-widest relative transition-colors h-12 ${tab === tabItem.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <tabItem.icon size={16} className="shrink-0" />
              <span className="whitespace-nowrap">{tabItem.label}</span>
              {tab === tabItem.id && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/30 custom-scrollbar min-w-0 min-h-0">
        {tab === 'visual' && <VisualTab model={model} t={t} />}
        {tab === 'export' && <ExportTab model={model} t={t} lang={lang} />}
        {tab === 'tutorial' && <TutorialTab model={model} t={t} lang={lang} />}
        {tab === 'schema' && <SchemaTab model={model} t={t} />}
        {tab === 'github' && (
          <GithubTab 
            model={model} 
            baselineModel={baselineModel} 
            githubConfig={githubConfig}
            onSetBaseline={onSetBaseline} 
            onUpdate={onUpdate}
            onUpdateGithubConfig={onUpdateGithubConfig}
            t={t} 
          />
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
