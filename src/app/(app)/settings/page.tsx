"use client";

import { Globe } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";

import { useUserPreferences, useUpdateUserPreferences } from "@/features/user/api/queries";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferencesMutation = useUpdateUserPreferences();

  const user = session?.user;
  const initial = user?.name ? user.name[0].toUpperCase() : (user?.email ? user.email[0].toUpperCase() : "?");

  const handleToggle = (key: string, currentValue: boolean) => {
    updatePreferencesMutation.mutate({ [key]: !currentValue });
  };

  return (
    <div className="space-y-12 pb-20">
      <header className="space-y-4">
        <h1 className="text-6xl font-serif">Settings</h1>
        <p className="text-muted font-serif italic text-xl">Manage your academic identity and workspace preferences.</p>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        <main className="col-span-12 md:col-span-8 space-y-12">
          <section className="space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border pb-4">Academic Identity</h3>
            <div className="bg-white border border-border p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-paper border border-border flex items-center justify-center font-serif text-xl italic font-bold overflow-hidden">
                    {user?.image ? (
                      <Image src={user.image} alt={user.name || "User Avatar"} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <span>{initial}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-serif font-bold italic text-lg">{user?.name || "Anonymous User"}</h4>
                    <p className="text-sm text-muted">{user?.email || "No email provided"}</p>
                  </div>
                </div>
                <button className="text-xs font-mono uppercase tracking-widest text-intel-blue hover:underline">Edit Profile</button>
              </div>
              <div className="accent-line opacity-5" />
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 text-emerald-600">
                  <Globe className="w-4 h-4" />
                  <span className="font-mono text-[10px] uppercase tracking-widest font-bold">ORCID Connected</span>
                </div>
                <span className="font-mono text-xs text-muted">0000-0002-1825-0097</span>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted border-b border-border pb-4">Notifications</h3>
            {isLoading ? (
              <div className="py-12 text-center text-muted italic font-serif">Loading preferences...</div>
            ) : (
              <div className="space-y-4">
                <SettingToggle
                  label="Email Summaries"
                  description="Receive weekly digests of new research discoveries."
                  active={preferences?.emailNotifications}
                  onToggle={() => handleToggle("emailNotifications", !!preferences?.emailNotifications)}
                />
                <SettingToggle
                  label="In-App Alerts"
                  description="Notify me immediately when conflicts or new works are detected."
                  active={preferences?.inAppNotifications}
                  onToggle={() => handleToggle("inAppNotifications", !!preferences?.inAppNotifications)}
                />
                <SettingToggle
                  label="Push Notifications"
                  description="Receive browser push notifications for urgent project updates."
                  active={preferences?.pushNotifications}
                  onToggle={() => handleToggle("pushNotifications", !!preferences?.pushNotifications)}
                />
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function SettingToggle({ label, description, active, onToggle }: { label: string, description: string, active?: boolean, onToggle?: () => void }) {
  return (
    <div className="flex justify-between items-center p-8 bg-white border border-border group hover:border-ink transition-all">
      <div className="space-y-1">
        <h4 className="font-serif font-bold italic text-lg">{label}</h4>
        <p className="text-sm font-serif italic text-muted">{description}</p>
      </div>
      <div
        onClick={onToggle}
        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${active ? 'bg-ink' : 'bg-paper border border-border'}`}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${active ? 'right-1 bg-paper' : 'left-1 bg-border'}`} />
      </div>
    </div>
  );
}

