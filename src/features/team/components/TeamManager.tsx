"use client";

import { useState } from "react";
import { 
  Users, 
  Mail, 
  Shield, 
  MoreHorizontal, 
  Plus, 
  UserPlus, 
  Search,
  Globe,
  Settings,
  History,
  Activity,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'REVIEWER' | 'OBSERVER';
  status: 'ACTIVE' | 'PENDING';
  lastActive: string;
  orcid?: string;
}

const MOCK_TEAM: TeamMember[] = [
  { id: "u1", name: "Zak A.", email: "zak@example.com", role: 'OWNER', status: 'ACTIVE', lastActive: "Just now", orcid: "0000-0002-1825-0097" },
  { id: "u2", name: "Mina S.", email: "mina@university.edu", role: 'ADMIN', status: 'ACTIVE', lastActive: "2h ago" },
  { id: "u3", name: "Alex L.", email: "alex.l@research.org", role: 'REVIEWER', status: 'PENDING', lastActive: "N/A" }
];

export function TeamManager() {
  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Project Collective</h1>
          <p className="text-muted font-serif italic text-xl">Governance and collaboration management for the review team.</p>
        </div>
        <button className="btn-editorial flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Invite Scholar
        </button>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        {/* Active Team */}
        <main className="col-span-12 md:col-span-8 space-y-8">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Active Members ({MOCK_TEAM.length})</h3>
            <div className="relative group">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-muted group-focus-within:text-ink transition-colors" />
              <input type="text" placeholder="Find member..." className="bg-transparent pl-6 py-1 outline-none text-xs font-serif italic placeholder:text-muted/40" />
            </div>
          </div>

          <div className="space-y-4">
            {MOCK_TEAM.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </main>

        {/* Roles & Permissions Reference */}
        <aside className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-white border border-border p-8 space-y-8">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">Governance Matrix</h3>
            
            <div className="space-y-6">
              <RoleDefinition 
                role="Adjudicator" 
                desc="Can resolve conflicts and override decisions. Access to full project settings." 
              />
              <RoleDefinition 
                role="Reviewer" 
                desc="Blind title/abstract screening and full-text extraction." 
              />
              <RoleDefinition 
                role="Observer" 
                desc="Read-only access to progress and analytics. Cannot make decisions." 
              />
            </div>

            <div className="accent-line opacity-10" />

            <div className="space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-widest text-muted flex items-center gap-2">
                <Activity className="w-3 h-3" /> Recent Activity
              </h4>
              <div className="space-y-4">
                <ActivityRow user="Mina S." action="resolved 12 conflicts" time="2h ago" />
                <ActivityRow user="Zak A." action="added 1,248 studies" time="1d ago" />
              </div>
            </div>
          </div>

          <div className="p-8 border border-border bg-intel-blue/5 border-intel-blue/20 space-y-4">
            <div className="flex items-center gap-2 text-intel-blue">
              <Globe className="w-4 h-4" />
              <span className="font-serif font-bold italic">Open Science</span>
            </div>
            <p className="text-xs font-serif italic text-intel-blue/70 leading-relaxed">
              LitLens supports ORCID-linked accounts to ensure provenance and recognition for all contributions to the review.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <div className="group bg-white border border-border p-6 hover:border-ink transition-all flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-paper border border-border flex items-center justify-center font-serif text-xl italic font-bold">
            {member.name[0]}
          </div>
          {member.status === 'ACTIVE' && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full" />}
        </div>
        
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h4 className="text-2xl font-serif leading-none group-hover:underline cursor-pointer">{member.name}</h4>
            {member.status === 'PENDING' && <span className="text-[8px] font-mono uppercase tracking-widest bg-paper px-2 py-0.5 rounded-full border border-border text-muted">Pending Invite</span>}
          </div>
          <div className="flex items-center gap-4 text-xs font-sans text-muted">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {member.email}</span>
            {member.orcid && <span className="flex items-center gap-1 text-emerald-600 font-mono text-[10px] tracking-tighter"><Globe className="w-3 h-3" /> ORCID: {member.orcid}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">Role</div>
          <div className="font-serif italic font-bold text-lg">{member.role}</div>
        </div>
        <div className="h-8 w-[1px] bg-border" />
        <div className="text-right w-24">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">Active</div>
          <div className="font-serif italic text-sm text-muted">{member.lastActive}</div>
        </div>
        <button className="p-2 hover:bg-paper rounded-full transition-colors">
          <MoreHorizontal className="w-5 h-5 text-muted hover:text-ink" />
        </button>
      </div>
    </div>
  );
}

function RoleDefinition({ role, desc }: { role: string, desc: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="w-3 h-3 text-intel-blue" />
        <span className="font-serif font-bold italic">{role}</span>
      </div>
      <p className="text-xs font-serif italic text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function ActivityRow({ user, action, time }: { user: string, action: string, time: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <p className="text-[11px] font-serif italic text-muted leading-tight">
        <span className="text-ink font-bold">{user}</span> {action}
      </p>
      <span className="text-[9px] font-mono uppercase tracking-tighter text-muted shrink-0">{time}</span>
    </div>
  );
}

