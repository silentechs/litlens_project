"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  Shield,
  MoreHorizontal,
  UserPlus,
  Search,
  Globe,
  Activity,
  Trash2,
} from "lucide-react";
import { CommonDialog } from "@/components/ui/common-dialog";
import { InviteMemberModal } from "./InviteMemberModal";
import { useRemoveMember, useUpdateMemberRole } from "../api/queries";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";

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

interface ProjectInvitation {
  id: string;
  email: string;
  role: 'OWNER' | 'LEAD' | 'REVIEWER' | 'OBSERVER';
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface MembersResponse {
  members: TeamMember[];
  invitations: ProjectInvitation[];
  total: number;
}

export function TeamManager() {
  const params = useParams();
  const projectId = params.id as string;
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const { data, isLoading } = useQuery<MembersResponse>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (!res.ok) throw new Error("Failed to fetch team members");
      const json = await res.json();
      return json.data;
    },
    enabled: !!projectId,
  });

  const teamMembers = data?.members || [];

  return (
    <>
      <div className="space-y-12 pb-20">
        <header className="flex justify-between items-end">
          <div className="space-y-4">
            <h1 className="text-6xl font-serif">Project Collective</h1>
            <p className="text-muted font-serif italic text-xl">Governance and collaboration management for the review team.</p>
          </div>
          <button
            onClick={() => setIsInviteOpen(true)}
            className="btn-editorial flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Invite Scholar
          </button>
        </header>

        <div className="accent-line" />

        <div className="editorial-grid gap-12">
          <main className="col-span-12 md:col-span-8 space-y-12">
            {/* Pending Invitations */}
            {data?.invitations && data.invitations.length > 0 && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-intel-blue flex items-center gap-2">
                    <UserPlus className="w-3 h-3" />
                    Pending Invitations ({data.invitations.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {data.invitations.map((invite) => (
                    <div key={invite.id} className="group bg-paper border border-border/50 p-4 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white border border-border border-dashed flex items-center justify-center text-muted">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-serif italic text-lg text-ink">{invite.email}</p>
                          <p className="text-[10px] font-mono uppercase text-muted tracking-wider">
                            Invited {formatDistanceToNow(new Date(invite.createdAt))} ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1">Role</div>
                          <div className="font-serif italic font-bold text-sm text-intel-blue">{invite.role}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1">Expires</div>
                          <div className="font-serif italic text-sm text-rose-500/70">{formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}</div>
                        </div>
                        {/* Placeholder for revoke action if needed later */}
                        <div className="w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Team */}
            <div className="space-y-8">
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
                  <div className="p-12 text-center font-serif italic text-muted">No active members in this collective.</div>
                ) : (
                  teamMembers.map((member) => (
                    <MemberCard key={member.id} member={member} projectId={projectId} />
                  ))
                )}
              </div>
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

      <InviteMemberModal
        projectId={projectId}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </>
  );
}

function MemberCard({ member, projectId }: { member: TeamMember, projectId: string }) {
  const initial = member.user.name ? member.user.name[0].toUpperCase() : member.user.email[0].toUpperCase();
  const removeMember = useRemoveMember(projectId);
  const updateRole = useUpdateMemberRole(projectId);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const handleRoleChange = (role: string) => {
    updateRole.mutate({ memberId: member.id, role: role as 'OWNER' | 'LEAD' | 'REVIEWER' | 'OBSERVER' }, {
      onSuccess: () => toast.success("Role updated successfully"),
      onError: (err) => toast.error(err.message)
    });
  };

  const handleRemove = () => {
    removeMember.mutate({ memberId: member.id }, {
      onSuccess: () => {
        toast.success("Member removed");
        setShowRemoveConfirm(false);
      },
      onError: (err) => toast.error(err.message)
    });
  };

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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 hover:bg-paper rounded-full transition-colors outline-none cursor-pointer">
              <MoreHorizontal className="w-5 h-5 text-muted hover:text-ink" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Member Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Shield className="w-4 h-4 mr-2" />
                <span>Change Role</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={member.role} onValueChange={handleRoleChange}>
                  <DropdownMenuRadioItem value="LEAD">Project Lead</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="REVIEWER">Reviewer</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="OBSERVER">Observer</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowRemoveConfirm(true)} className="text-rose-500 focus:text-rose-600 focus:bg-rose-50">
              <Trash2 className="w-4 h-4 mr-2" />
              <span>Remove Member</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <CommonDialog
          isOpen={showRemoveConfirm}
          onClose={() => setShowRemoveConfirm(false)}
          onConfirm={handleRemove}
          title="Remove Member"
          description={`Are you sure you want to remove "${member.user.name || member.user.email}" from the project? This reviewer will lose access to all screening tasks.`}
          confirmLabel="Remove"
          variant="destructive"
          loading={removeMember.isPending}
        />
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
