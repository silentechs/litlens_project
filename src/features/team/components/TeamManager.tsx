import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
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

interface TeamMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'LEAD' | 'REVIEWER' | 'OBSERVER';
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    institution: string | null;
  };
  stats: {
    total: number;
    included: number;
    excluded: number;
    maybe: number;
  };
}

interface MembersResponse {
  members: TeamMember[];
  total: number;
}

export function TeamManager() {
  const params = useParams();
  const projectId = params.id as string;

  const { data, isLoading } = useQuery<MembersResponse>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to fetch team members");
      return res.json();
    },
    enabled: !!projectId,
  });

  const teamMembers = data?.members || [];

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
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {isLoading ? "Loading Scholars..." : `Active Members (${teamMembers.length})`}
            </h3>
            <div className="relative group">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-muted group-focus-within:text-ink transition-colors" />
              <input type="text" placeholder="Find member..." className="bg-transparent pl-6 py-1 outline-none text-xs font-serif italic placeholder:text-muted/40" />
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center font-serif italic text-muted">Retrieving project roster...</div>
            ) : teamMembers.length === 0 ? (
              <div className="p-12 text-center font-serif italic text-muted">No members found in this collective.</div>
            ) : (
              teamMembers.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))
            )}
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
                <Activity className="w-3 h-3" /> Collective Output
              </h4>
              <div className="space-y-4">
                {teamMembers.map(m => (
                  <ActivityRow
                    key={m.id}
                    user={m.user.name || m.user.email}
                    action={`screened ${m.stats.total} studies (${m.stats.included} included)`}
                    time={formatDistanceToNow(new Date(m.joinedAt), { addSuffix: true })}
                  />
                ))}
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
  const initial = member.user.name ? member.user.name[0].toUpperCase() : member.user.email[0].toUpperCase();

  return (
    <div className="group bg-white border border-border p-6 hover:border-ink transition-all flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-paper border border-border flex items-center justify-center font-serif text-xl italic font-bold overflow-hidden">
            {member.user.image ? (
              <img src={member.user.image} alt={member.user.name || "Avatar"} className="w-full h-full object-cover" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-white rounded-full" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h4 className="text-2xl font-serif leading-none group-hover:underline cursor-pointer">{member.user.name || "Anonymous Scholar"}</h4>
          </div>
          <div className="flex items-center gap-4 text-xs font-sans text-muted">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {member.user.email}</span>
            {member.user.institution && <span className="flex items-center gap-1 text-intel-blue font-mono text-[10px] tracking-tighter"><Globe className="w-3 h-3" /> {member.user.institution}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">Role</div>
          <div className="font-serif italic font-bold text-lg">{member.role}</div>
        </div>
        <div className="h-8 w-[1px] bg-border" />
        <div className="text-right w-32">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1">Decisions</div>
          <div className="font-serif italic text-sm text-muted">{member.stats.total} total</div>
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

