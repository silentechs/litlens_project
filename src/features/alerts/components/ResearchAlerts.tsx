"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Mail,
  Settings,
  Plus,
  Clock,
  Trash2,
  Edit2,
  Check,
  TrendingUp,
  FileText,
  User,
  Hash,
  Loader2,
  X,
  Eye,
  Search,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert } from "@/features/alerts/api/queries";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommonDialog } from "@/components/ui/common-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// Types
type AlertType = "KEYWORD_TREND" | "AUTHOR_ACTIVITY" | "CITATION_UPDATE" | "PROJECT_UPDATE";
type AlertFrequency = "REAL_TIME" | "DAILY" | "WEEKLY";

interface AlertFormData {
  name: string;
  alertType: AlertType;
  keywords: string[];
  searchQuery: string;
  frequency: AlertFrequency;
  isActive: boolean;
}

const ALERT_TYPE_CONFIG = {
  KEYWORD_TREND: { icon: Hash, label: "Keywords", description: "Track specific terms and concepts" },
  AUTHOR_ACTIVITY: { icon: User, label: "Author", description: "Follow researcher publications" },
  CITATION_UPDATE: { icon: FileText, label: "Citation", description: "Monitor paper citations" },
  PROJECT_UPDATE: { icon: Bell, label: "Project", description: "Track project-related research" },
};

const FREQUENCY_OPTIONS = [
  { value: "REAL_TIME", label: "Real-time", description: "Instant notifications" },
  { value: "DAILY", label: "Daily", description: "Once per day digest" },
  { value: "WEEKLY", label: "Weekly", description: "Weekly summary" },
];

const DEFAULT_FORM: AlertFormData = {
  name: "",
  alertType: "KEYWORD_TREND",
  keywords: [],
  searchQuery: "",
  frequency: "DAILY",
  isActive: true,
};

export function ResearchAlerts() {
  const router = useRouter();
  const { data: alertsData, isLoading, refetch } = useAlerts();
  const createAlertMutation = useCreateAlert();
  const updateAlertMutation = useUpdateAlert();
  const deleteAlertMutation = useDeleteAlert();

  const alerts = alertsData || [];

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any | null>(null);
  const [alertToDelete, setAlertToDelete] = useState<string | null>(null);
  const [showEmailSettings, setShowEmailSettings] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AlertFormData>(DEFAULT_FORM);
  const [keywordInput, setKeywordInput] = useState("");

  // Notification preferences (local state - would be persisted via user preferences API)
  const [notificationPrefs, setNotificationPrefs] = useState({
    inApp: true,
    push: false,
    email: true,
    emailFrequency: "DAILY" as AlertFrequency,
  });

  // Reset form when modal closes
  useEffect(() => {
    if (!showCreateModal && !editingAlert) {
      setFormData(DEFAULT_FORM);
      setKeywordInput("");
    }
  }, [showCreateModal, editingAlert]);

  // Populate form when editing
  useEffect(() => {
    if (editingAlert) {
      setFormData({
        name: editingAlert.name || "",
        alertType: editingAlert.alertType || "KEYWORD_TREND",
        keywords: editingAlert.keywords || [],
        searchQuery: editingAlert.searchQuery || "",
        frequency: editingAlert.frequency || "DAILY",
        isActive: editingAlert.isActive ?? true,
      });
    }
  }, [editingAlert]);

  // Handlers
  const handleAddKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim().toLowerCase()],
      }));
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword),
    }));
  };

  const handleCreateAlert = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter an alert name");
      return;
    }

    if (formData.alertType === "KEYWORD_TREND" && formData.keywords.length === 0 && !formData.searchQuery.trim()) {
      toast.error("Please add at least one keyword or search query");
      return;
    }

    try {
      await createAlertMutation.mutateAsync({
        name: formData.name,
        alertType: formData.alertType,
        keywords: formData.keywords,
        searchQuery: formData.searchQuery || undefined,
        frequency: formData.frequency,
      });
      toast.success("Alert created successfully");
      setShowCreateModal(false);
      setFormData(DEFAULT_FORM);
    } catch (error) {
      toast.error("Failed to create alert");
    }
  };

  const handleUpdateAlert = async () => {
    if (!editingAlert) return;

    try {
      await updateAlertMutation.mutateAsync({
        id: editingAlert.id,
        name: formData.name,
        alertType: formData.alertType,
        keywords: formData.keywords,
        searchQuery: formData.searchQuery || undefined,
        frequency: formData.frequency,
        isActive: formData.isActive,
      });
      toast.success("Alert updated successfully");
      setEditingAlert(null);
    } catch (error) {
      toast.error("Failed to update alert");
    }
  };

  const handleDeleteAlert = async () => {
    if (!alertToDelete) return;

    try {
      await deleteAlertMutation.mutateAsync(alertToDelete);
      toast.success("Alert deleted successfully");
      setAlertToDelete(null);
    } catch (error) {
      toast.error("Failed to delete alert");
    }
  };

  const handleToggleActive = async (alert: any) => {
    try {
      await updateAlertMutation.mutateAsync({
        id: alert.id,
        isActive: !alert.isActive,
      });
      toast.success(alert.isActive ? "Alert paused" : "Alert activated");
    } catch (error) {
      toast.error("Failed to update alert");
    }
  };

  const handleViewDiscoveries = (alert: any) => {
    // Navigate to Discover page with the alert's search query
    const query = alert.searchQuery || alert.keywords?.join(" OR ") || "";
    if (query) {
      router.push(`/discover?q=${encodeURIComponent(query)}`);
    }
  };

  const handleMarkAllSeen = async () => {
    // Mark all alerts as seen (reset discovery count)
    // This would typically be an API call
    toast.success("All discoveries marked as seen");
  };

  const handleSaveNotificationPrefs = () => {
    // Save notification preferences via API
    toast.success("Notification preferences saved");
    setShowEmailSettings(false);
  };

  // Calculate stats
  const totalDiscoveries = alerts.reduce((sum: number, a: any) => sum + (a.discoveryCount || 0), 0);
  const activeAlerts = alerts.filter((a: any) => a.isActive).length;

  return (
    <div className="space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Research Intelligence Alerts</h1>
          <p className="text-muted font-serif italic text-xl">Automated surveillance of the scientific horizon.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-editorial flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Alert
        </button>
      </header>

      <div className="accent-line" />

      <div className="editorial-grid gap-12">
        {/* Alerts List */}
        <main className="col-span-12 md:col-span-8 space-y-8">
          <div className="flex justify-between items-center border-b border-border pb-4">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {isLoading ? "Synchronizing High-Frequency Feeds..." : `Active Surveillance (${activeAlerts} of ${alerts.length})`}
            </h3>
            <div className="flex gap-4">
              {totalDiscoveries > 0 && (
                <button
                  onClick={handleMarkAllSeen}
                  className="text-[10px] font-mono uppercase tracking-widest text-muted hover:text-ink transition-colors"
                >
                  Mark All Seen
                </button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted" />
                <p className="mt-4 font-serif italic text-muted">Awaiting signal from scholarly repositories...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-20 text-center space-y-4 bg-white border border-border/50">
                <Bell className="w-12 h-12 mx-auto text-muted opacity-20" />
                <p className="font-serif italic text-2xl text-muted">No active surveillance filters found.</p>
                <p className="text-sm text-muted/60 font-serif max-w-sm mx-auto">
                  Configure custom alerts to automatically scour the deep web for relevant evidence in your field.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-editorial mt-4"
                >
                  Initialize First Alert
                </button>
              </div>
            ) : (
              alerts.map((alert: any) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={() => setEditingAlert(alert)}
                  onDelete={() => setAlertToDelete(alert.id)}
                  onToggleActive={() => handleToggleActive(alert)}
                  onViewDiscoveries={() => handleViewDiscoveries(alert)}
                />
              ))
            )}
          </div>
        </main>

        {/* Intelligence Summary (Aside) */}
        <aside className="col-span-12 md:col-span-4 space-y-8">
          <div className="bg-ink text-paper p-8 space-y-8 shadow-editorial">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Weekly Intelligence Digest</h3>
            <div className="space-y-6">
              {totalDiscoveries > 0 ? (
                <>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-intel-blue" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-serif italic leading-relaxed">
                        <strong>{totalDiscoveries} new discoveries</strong> across your {activeAlerts} active alerts this week.
                      </p>
                      <span className="text-[10px] font-mono uppercase text-paper/40">Signal Strength: High</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-intel-blue" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-serif italic leading-relaxed">
                        Most active alert: <strong>{alerts[0]?.name || "None"}</strong>
                      </p>
                      <span className="text-[10px] font-mono uppercase text-paper/40">Connection Detected</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm font-serif italic text-paper/60">
                  No new discoveries this week. Create alerts to start monitoring.
                </p>
              )}
            </div>
            <div className="accent-line bg-white opacity-10" />
            <button
              onClick={() => setShowEmailSettings(true)}
              className="w-full py-4 border border-white/20 text-[10px] font-mono uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-3 h-3" /> Configure Email Digest
            </button>
          </div>

          <div className="p-8 border border-border space-y-6 bg-white">
            <div className="flex items-center gap-2 text-muted">
              <Settings className="w-4 h-4" />
              <h4 className="text-xs font-mono uppercase tracking-widest font-bold">Notification Settings</h4>
            </div>
            <div className="space-y-4">
              <ToggleSwitch
                label="In-App Notifications"
                enabled={notificationPrefs.inApp}
                onChange={(enabled) => setNotificationPrefs(prev => ({ ...prev, inApp: enabled }))}
              />
              <ToggleSwitch
                label="Push Notifications"
                enabled={notificationPrefs.push}
                onChange={(enabled) => setNotificationPrefs(prev => ({ ...prev, push: enabled }))}
              />
              <ToggleSwitch
                label="Email Notifications"
                enabled={notificationPrefs.email}
                onChange={(enabled) => setNotificationPrefs(prev => ({ ...prev, email: enabled }))}
              />
            </div>
            <Button
              onClick={handleSaveNotificationPrefs}
              variant="outline"
              className="w-full mt-4 text-xs"
            >
              Save Preferences
            </Button>
          </div>
        </aside>
      </div>

      {/* Create/Edit Alert Modal */}
      <Dialog
        open={showCreateModal || !!editingAlert}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingAlert(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingAlert ? "Edit Alert" : "Create New Alert"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Alert Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Alert Name
              </label>
              <Input
                placeholder="e.g., Machine Learning in Healthcare"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="font-serif text-lg"
                autoFocus
              />
            </div>

            {/* Alert Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Alert Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ALERT_TYPE_CONFIG).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setFormData(prev => ({ ...prev, alertType: type as AlertType }))}
                      className={cn(
                        "p-4 border rounded-sm text-left transition-all",
                        formData.alertType === type
                          ? "border-intel-blue bg-intel-blue/5"
                          : "border-border hover:border-ink"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-4 h-4 text-intel-blue" />
                        <span className="font-serif font-bold text-sm">{config.label}</span>
                      </div>
                      <p className="text-[10px] text-muted font-serif italic">{config.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Keywords
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddKeyword())}
                  className="flex-1"
                />
                <Button onClick={handleAddKeyword} variant="outline" size="icon">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-3 py-1 bg-intel-blue/10 text-intel-blue text-xs font-mono rounded-full flex items-center gap-1"
                    >
                      {keyword}
                      <button onClick={() => handleRemoveKeyword(keyword)} className="hover:text-intel-blue/70">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Search Query */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Advanced Query (Optional)
              </label>
              <Input
                placeholder="e.g., ('machine learning' OR 'deep learning') AND healthcare"
                value={formData.searchQuery}
                onChange={(e) => setFormData(prev => ({ ...prev, searchQuery: e.target.value }))}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted font-serif italic">
                Use Boolean operators (AND, OR, NOT) for complex queries
              </p>
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                Check Frequency
              </label>
              <div className="flex gap-3">
                {FREQUENCY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFormData(prev => ({ ...prev, frequency: option.value as AlertFrequency }))}
                    className={cn(
                      "flex-1 p-3 border rounded-sm text-center transition-all",
                      formData.frequency === option.value
                        ? "border-intel-blue bg-intel-blue/5"
                        : "border-border hover:border-ink"
                    )}
                  >
                    <span className="font-serif font-bold text-sm block">{option.label}</span>
                    <span className="text-[10px] text-muted">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Toggle (Edit mode only) */}
            {editingAlert && (
              <div className="pt-4 border-t border-border">
                <ToggleSwitch
                  label="Alert Active"
                  enabled={formData.isActive}
                  onChange={(enabled) => setFormData(prev => ({ ...prev, isActive: enabled }))}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                setEditingAlert(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingAlert ? handleUpdateAlert : handleCreateAlert}
              disabled={createAlertMutation.isPending || updateAlertMutation.isPending}
              className="bg-ink text-paper hover:bg-ink/90"
            >
              {(createAlertMutation.isPending || updateAlertMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : editingAlert ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {editingAlert ? "Save Changes" : "Create Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Settings Modal */}
      <Dialog open={showEmailSettings} onOpenChange={setShowEmailSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Email Digest Settings</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <ToggleSwitch
              label="Enable Email Digest"
              enabled={notificationPrefs.email}
              onChange={(enabled) => setNotificationPrefs(prev => ({ ...prev, email: enabled }))}
            />

            {notificationPrefs.email && (
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted">
                  Digest Frequency
                </label>
                <select
                  value={notificationPrefs.emailFrequency}
                  onChange={(e) => setNotificationPrefs(prev => ({
                    ...prev,
                    emailFrequency: e.target.value as AlertFrequency
                  }))}
                  className="w-full h-10 px-3 border border-border rounded-sm font-serif bg-white focus:border-ink outline-none"
                >
                  <option value="DAILY">Daily Digest</option>
                  <option value="WEEKLY">Weekly Summary</option>
                </select>
              </div>
            )}

            <p className="text-sm text-muted font-serif italic">
              Digest emails will be sent to your registered email address with a summary of all new discoveries.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailSettings(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotificationPrefs} className="bg-ink text-paper hover:bg-ink/90">
              <Mail className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <CommonDialog
        isOpen={!!alertToDelete}
        onClose={() => setAlertToDelete(null)}
        onConfirm={handleDeleteAlert}
        title="Delete Alert"
        description="Are you sure you want to delete this alert? This action cannot be undone and all discovery history will be lost."
        confirmLabel="Delete Alert"
        variant="destructive"
        loading={deleteAlertMutation.isPending}
      />
    </div>
  );
}

// Alert Card Component
function AlertCard({
  alert,
  onEdit,
  onDelete,
  onToggleActive,
  onViewDiscoveries,
}: {
  alert: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onViewDiscoveries: () => void;
}) {
  const typeConfig = ALERT_TYPE_CONFIG[alert.alertType as AlertType] || ALERT_TYPE_CONFIG.KEYWORD_TREND;
  const Icon = typeConfig.icon;

  const lastTriggered = alert.lastTriggeredAt
    ? formatDistanceToNow(new Date(alert.lastTriggeredAt), { addSuffix: true })
    : "Never";

  const queryDisplay = alert.searchQuery || alert.keywords?.join(", ") || "No query defined";

  return (
    <div className={cn(
      "group bg-white border border-border p-8 hover:border-ink transition-all flex justify-between items-start gap-12 relative overflow-hidden",
      !alert.isActive && "opacity-60"
    )}>
      {alert.discoveryCount > 0 && (
        <div className="absolute top-0 right-0 px-4 py-1 bg-intel-blue text-white font-mono text-[10px] uppercase tracking-widest">
          {alert.discoveryCount} New Discoveries
        </div>
      )}

      <div className="space-y-6 flex-1">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="text-intel-blue">
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-3xl font-serif leading-none group-hover:underline cursor-pointer" onClick={onEdit}>
              {alert.name}
            </h3>
            {!alert.isActive && (
              <span className="px-2 py-0.5 bg-muted/20 text-muted text-[10px] font-mono uppercase rounded">
                Paused
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs font-sans text-muted">
            <span className="font-mono text-[10px] uppercase tracking-tighter bg-paper px-2 py-0.5 border border-border">
              {alert.frequency}
            </span>
            <span className="w-1 h-1 bg-border rounded-full" />
            <span className="italic flex items-center gap-1 font-serif">
              <Clock className="w-3 h-3" /> Last check: {lastTriggered}
            </span>
          </div>
        </div>

        <div className="bg-paper/50 p-4 border border-transparent group-hover:border-border transition-all">
          <p className="font-mono text-xs text-muted leading-relaxed break-all">
            {queryDisplay}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-4 pt-8">
        <div className="flex gap-2">
          <button
            onClick={onToggleActive}
            className={cn(
              "p-3 border transition-all",
              alert.isActive
                ? "border-border hover:border-amber-500 hover:bg-amber-50"
                : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            )}
            title={alert.isActive ? "Pause alert" : "Activate alert"}
          >
            {alert.isActive ? (
              <AlertCircle className="w-4 h-4 text-amber-500" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-3 border border-border hover:border-ink hover:bg-paper transition-all"
          >
            <Edit2 className="w-4 h-4 text-muted" />
          </button>
          <button
            onClick={onDelete}
            className="p-3 border border-border hover:border-rose-600 hover:bg-rose-50 transition-all group/del"
          >
            <Trash2 className="w-4 h-4 text-muted group-hover/del:text-rose-600" />
          </button>
        </div>
        <button
          onClick={onViewDiscoveries}
          className="btn-editorial text-xs px-6 py-2 flex items-center gap-2"
        >
          <Eye className="w-3 h-3" />
          View Discoveries
        </button>
      </div>
    </div>
  );
}

// Toggle Switch Component
function ToggleSwitch({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex justify-between items-center">
      <label className="text-sm font-serif italic">{label}</label>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          "w-10 h-5 rounded-full relative transition-colors",
          enabled ? "bg-ink" : "bg-paper border border-border"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full transition-all",
            enabled ? "right-0.5 bg-paper" : "left-0.5 bg-border"
          )}
        />
      </button>
    </div>
  );
}
