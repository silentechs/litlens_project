"use client";

import { useState } from "react";
import { 
  Bell, 
  Mail, 
  Settings, 
  Plus, 
  Search, 
  Clock, 
  Trash2, 
  Edit2, 
  Check, 
  AlertCircle,
  TrendingUp,
  FileText,
  User,
  Hash
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ResearchAlert {
  id: string;
  name: string;
  type: 'KEYWORDS' | 'AUTHOR' | 'CITATION' | 'PROJECT';
  query: string;
  frequency: 'REAL_TIME' | 'DAILY' | 'WEEKLY';
  lastTriggered: string;
  discoveriesCount: number;
}

const MOCK_ALERTS: ResearchAlert[] = [
  {
    id: "a1",
    name: "LLM Ethics in Healthcare",
    type: 'KEYWORDS',
    query: "('large language models' OR 'generative AI') AND 'clinical ethics'",
    frequency: 'DAILY',
    lastTriggered: "2h ago",
    discoveriesCount: 12
  },
  {
    id: "a2",
    name: "Andrew Wallace - New Pubs",
    type: 'AUTHOR',
    query: "Wallace, B. C.",
    frequency: 'REAL_TIME',
    lastTriggered: "1d ago",
    discoveriesCount: 3
  }
];

export function ResearchAlerts() {
  const [alerts, setAlerts] = useState<ResearchAlert[]>(MOCK_ALERTS);

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Research Intelligence Alerts</h1>
          <p className="text-muted font-serif italic text-xl">Automated surveillance of the scientific horizon.</p>
        </div>
        <button className="btn-editorial flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Create Alert
        </button>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        {/* Alerts List */}
        <main className="col-span-12 md:col-span-8 space-y-8">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Active Surveillance ({alerts.length})</h3>
            <div className="flex gap-4">
              <button className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink transition-colors">Mark All Seen</button>
            </div>
          </div>

          <div className="space-y-6">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </main>

        {/* Intelligence Summary (Aside) */}
        <aside className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-ink text-paper p-8 space-y-8 shadow-editorial">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Weekly Intelligence Digest</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-intel-blue" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-serif italic leading-relaxed">"Clinical Ethics" mentions are up 45% in your watched author networks.</p>
                  <span className="text-[10px] font-mono uppercase text-paper/40">Signal Strength: High</span>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-intel-blue" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-serif italic leading-relaxed">3 authors from your "AI Ethics" project published a new joint paper.</p>
                  <span className="text-[10px] font-mono uppercase text-paper/40">Connection Detected</span>
                </div>
              </div>
            </div>
            <div className="accent-line bg-white opacity-10" />
            <button className="w-full py-4 border border-white/20 text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              <Mail className="w-3 h-3" /> Configure Email Digest
            </button>
          </div>

          <div className="p-8 border border-border space-y-6">
            <div className="flex items-center gap-2 text-muted">
              <Settings className="w-4 h-4" />
              <h4 className="text-xs font-mono uppercase tracking-widest font-bold">Global Settings</h4>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-xs font-serif italic">In-App Notifications</label>
                <div className="w-8 h-4 bg-ink rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-paper rounded-full" /></div>
              </div>
              <div className="flex justify-between items-center">
                <label className="text-xs font-serif italic">Push Notifications</label>
                <div className="w-8 h-4 bg-paper border border-border rounded-full relative"><div className="absolute left-1 top-1 w-2 h-2 bg-border rounded-full" /></div>
              </div>
              <div className="flex justify-between items-center">
                <label className="text-xs font-serif italic">Institutional SSO Sync</label>
                <div className="w-8 h-4 bg-ink rounded-full relative"><div className="absolute right-1 top-1 w-2 h-2 bg-paper rounded-full" /></div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: ResearchAlert }) {
  const typeIcons = {
    KEYWORDS: <Hash className="w-4 h-4" />,
    AUTHOR: <User className="w-4 h-4" />,
    CITATION: <FileText className="w-4 h-4" />,
    PROJECT: <Bell className="w-4 h-4" />
  };

  return (
    <div className="group bg-white border border-border p-8 hover:border-ink transition-all flex justify-between items-start gap-12 relative overflow-hidden">
      {alert.discoveriesCount > 0 && (
        <div className="absolute top-0 right-0 px-4 py-1 bg-intel-blue text-white font-mono text-[10px] uppercase tracking-widest">
          {alert.discoveriesCount} New Discoveries
        </div>
      )}
      
      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="text-intel-blue">{typeIcons[alert.type]}</div>
            <h3 className="text-3xl font-serif leading-none group-hover:underline cursor-pointer">{alert.name}</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-sans text-muted">
            <span className="font-mono text-[10px] uppercase tracking-tighter bg-paper px-2 py-0.5 border border-border">{alert.frequency}</span>
            <span className="w-1 h-1 bg-border rounded-full" />
            <span className="italic flex items-center gap-1 font-serif">
              <Clock className="w-3 h-3" /> Last check: {alert.lastTriggered}
            </span>
          </div>
        </div>

        <div className="bg-paper/50 p-4 border border-transparent group-hover:border-border transition-all">
          <p className="font-mono text-xs text-muted leading-relaxed break-all">
            {alert.query}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-4 pt-8">
        <div className="flex gap-2">
          <button className="p-3 border border-border hover:border-ink hover:bg-paper transition-all">
            <Edit2 className="w-4 h-4 text-muted" />
          </button>
          <button className="p-3 border border-border hover:border-rose-600 hover:bg-rose-50 transition-all group/del">
            <Trash2 className="w-4 h-4 text-muted group-hover/del:text-rose-600" />
          </button>
        </div>
        <button className="btn-editorial text-xs px-6 py-2">View Discoveries</button>
      </div>
    </div>
  );
}

