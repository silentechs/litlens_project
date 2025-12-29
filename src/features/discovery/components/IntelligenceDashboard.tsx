"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAlerts } from "@/features/alerts/api/queries";
import { useLibraryItems } from "@/features/library/api/queries";
import {
  Search,
  Bell,
  BookMarked,
  Network,
  FileText,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Clock,
  Plus,
  ExternalLink,
  Loader2,
  AlertCircle,
  BookOpen,
  Users,
  Hash,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function IntelligenceDashboard() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch alerts with discovery count
  const { data: alertsData, isLoading: isLoadingAlerts } = useAlerts();
  const alerts = alertsData || [];
  const activeAlerts = alerts.filter((a: any) => a.isActive);
  const totalDiscoveries = alerts.reduce((sum: number, a: any) => sum + (a.discoveryCount || 0), 0);

  // Fetch recent library items
  const { data: libraryData, isLoading: isLoadingLibrary } = useLibraryItems({ limit: 3, sortBy: "addedAt" });
  const recentLibraryItems = libraryData?.items || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/discover?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Header */}
      <header className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-6xl font-serif">Research Intelligence</h1>
          <p className="text-muted font-serif italic text-xl max-w-2xl">
            Discover, track, and synthesize the scholarly landscape. Your intelligent assistant for evidence-based research.
          </p>
        </div>

        {/* Quick Search */}
        <form onSubmit={handleSearch} className="max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search millions of papers..."
              className="w-full bg-white border border-border pl-12 pr-4 py-4 font-serif text-lg placeholder:text-muted/40 focus:border-ink focus:shadow-editorial outline-none transition-all"
            />
            <Button
              type="submit"
              disabled={!searchQuery.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-ink text-paper hover:bg-ink/90"
            >
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </div>
        </form>
      </header>

      <div className="accent-line" />

      {/* Quick Access Grid */}
      <div className="editorial-grid gap-6">
        <QuickAccessCard
          href="/discover"
          icon={<Search className="w-6 h-6" />}
          title="Discover"
          description="Search academic databases and find relevant papers"
          gradient="from-blue-500/10 to-indigo-500/10"
          iconColor="text-blue-600"
        />
        <QuickAccessCard
          href="/alerts"
          icon={<Bell className="w-6 h-6" />}
          title="Alerts"
          description="Set up automated research monitoring"
          badge={totalDiscoveries > 0 ? `${totalDiscoveries} new` : undefined}
          gradient="from-amber-500/10 to-orange-500/10"
          iconColor="text-amber-600"
        />
        <QuickAccessCard
          href="/library"
          icon={<BookMarked className="w-6 h-6" />}
          title="Library"
          description="Access your saved papers and collections"
          gradient="from-emerald-500/10 to-teal-500/10"
          iconColor="text-emerald-600"
        />
        <QuickAccessCard
          href="/graphs"
          icon={<Network className="w-6 h-6" />}
          title="Graphs"
          description="Visualize citation networks and topic clusters"
          gradient="from-purple-500/10 to-pink-500/10"
          iconColor="text-purple-600"
        />
        <QuickAccessCard
          href="/writing"
          icon={<FileText className="w-6 h-6" />}
          title="Writing"
          description="AI-assisted research writing and synthesis"
          gradient="from-rose-500/10 to-red-500/10"
          iconColor="text-rose-600"
        />
        <QuickAccessCard
          href="/analytics"
          icon={<TrendingUp className="w-6 h-6" />}
          title="Analytics"
          description="Track your research progress and metrics"
          gradient="from-cyan-500/10 to-sky-500/10"
          iconColor="text-cyan-600"
        />
      </div>

      {/* Intelligence Briefing */}
      <div className="editorial-grid gap-8">
        {/* Active Alerts Panel */}
        <div className="col-span-12 md:col-span-6 bg-ink text-paper p-8 space-y-6 shadow-editorial">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                Research Surveillance
              </h3>
              <h2 className="text-2xl font-serif">Active Alerts</h2>
            </div>
            <Link href="/alerts">
              <Button variant="outline" size="sm" className="border-paper/20 text-paper hover:bg-paper/10">
                Manage
              </Button>
            </Link>
          </div>

          {isLoadingAlerts ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-paper/40" />
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <Bell className="w-8 h-8 mx-auto text-paper/20" />
              <p className="font-serif italic text-paper/60">No active alerts configured</p>
              <Link href="/alerts">
                <Button size="sm" className="bg-paper text-ink hover:bg-paper/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Alert
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAlerts.slice(0, 3).map((alert: any) => (
                <AlertSnippet key={alert.id} alert={alert} />
              ))}
              {activeAlerts.length > 3 && (
                <Link href="/alerts" className="block text-center">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-paper/40 hover:text-paper/60">
                    +{activeAlerts.length - 3} more alerts
                  </span>
                </Link>
              )}
            </div>
          )}

          {totalDiscoveries > 0 && (
            <div className="pt-4 border-t border-paper/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-intel-blue rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-serif">
                    <strong>{totalDiscoveries} new discoveries</strong> this week
                  </p>
                  <p className="text-[10px] font-mono uppercase text-paper/40">Signal detected</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Library Panel */}
        <div className="col-span-12 md:col-span-6 bg-white border border-border p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                Personal Collection
              </h3>
              <h2 className="text-2xl font-serif">Recent Additions</h2>
            </div>
            <Link href="/library">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>

          {isLoadingLibrary ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted" />
            </div>
          ) : recentLibraryItems.length === 0 ? (
            <div className="py-8 text-center space-y-3">
              <BookMarked className="w-8 h-8 mx-auto text-muted/20" />
              <p className="font-serif italic text-muted">Your library is empty</p>
              <Link href="/discover">
                <Button size="sm" className="bg-ink text-paper hover:bg-ink/90">
                  <Search className="w-4 h-4 mr-2" />
                  Start Searching
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentLibraryItems.map((item: any) => (
                <LibraryItemSnippet key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="bg-intel-blue/5 border border-intel-blue/20 p-8 space-y-6 rounded-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white border border-intel-blue/20 flex items-center justify-center shrink-0 shadow-sm">
            <Lightbulb className="w-6 h-6 text-intel-blue" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-serif font-bold text-intel-blue">Getting Started</h3>
            <p className="text-intel-blue/70 font-serif italic leading-relaxed max-w-3xl">
              The Intelligence module helps you stay ahead of the research curve. Set up <Link href="/alerts" className="underline">research alerts</Link> to monitor 
              new publications in your field, save papers to your <Link href="/library" className="underline">library</Link> for easy access, 
              and use <Link href="/graphs" className="underline">network visualization</Link> to understand research landscapes.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <TipCard
            icon={<Bell className="w-4 h-4" />}
            title="Create Your First Alert"
            description="Monitor keywords, authors, or topics automatically"
            href="/alerts"
          />
          <TipCard
            icon={<Search className="w-4 h-4" />}
            title="Search Semantic Scholar"
            description="Find papers across 200M+ research articles"
            href="/discover"
          />
          <TipCard
            icon={<Network className="w-4 h-4" />}
            title="Map Your Research"
            description="Visualize connections in your review"
            href="/graphs"
          />
        </div>
      </div>
    </div>
  );
}

function QuickAccessCard({
  href,
  icon,
  title,
  description,
  badge,
  gradient,
  iconColor,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  gradient: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className="col-span-12 sm:col-span-6 md:col-span-4 group relative bg-white border border-border p-6 hover:border-ink hover:shadow-editorial transition-all overflow-hidden"
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity", gradient)} />
      <div className="relative space-y-4">
        <div className="flex justify-between items-start">
          <div className={cn("w-12 h-12 bg-paper border border-border flex items-center justify-center group-hover:border-ink transition-colors", iconColor)}>
            {icon}
          </div>
          {badge && (
            <span className="px-2 py-1 bg-intel-blue text-white text-[10px] font-mono uppercase rounded-full">
              {badge}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-serif font-bold group-hover:underline">{title}</h3>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
          </div>
          <p className="text-sm text-muted font-serif italic">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function AlertSnippet({ alert }: { alert: { alertType: string; name: string; lastTriggeredAt?: string | Date | null; isActive: boolean; discoveryCount?: number } }) {
  const lastTriggered = alert.lastTriggeredAt
    ? formatDistanceToNow(new Date(alert.lastTriggeredAt), { addSuffix: true })
    : "Never";

  const typeIconMap: Record<string, React.ReactNode> = {
    KEYWORD_TREND: <Hash className="w-3 h-3" />,
    AUTHOR_ACTIVITY: <Users className="w-3 h-3" />,
    CITATION_UPDATE: <FileText className="w-3 h-3" />,
    PROJECT_UPDATE: <Bell className="w-3 h-3" />,
  };
  const typeIcon = typeIconMap[alert.alertType] || <Bell className="w-3 h-3" />;

  return (
    <div className="flex items-start gap-3 p-3 bg-paper/5 rounded-sm hover:bg-paper/10 transition-colors">
      <div className="w-8 h-8 bg-paper/10 rounded-full flex items-center justify-center shrink-0 text-paper/60">
        {typeIcon}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-serif font-bold truncate">{alert.name}</h4>
        <div className="flex items-center gap-2 text-[10px] font-mono text-paper/40">
          <Clock className="w-3 h-3" />
          <span>{lastTriggered}</span>
          {alert.discoveryCount && alert.discoveryCount > 0 && (
            <>
              <span>•</span>
              <span className="text-intel-blue">{alert.discoveryCount} new</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryItemSnippet({ item }: { item: any }) {
  const addedAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });
  const authors = item.work.authors?.map((a: any) => a.name).join(", ") || "Unknown";

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-paper transition-colors rounded-sm">
      <div className="w-8 h-8 bg-intel-blue/10 rounded-full flex items-center justify-center shrink-0 text-intel-blue">
        <BookOpen className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-serif font-bold line-clamp-1 hover:underline cursor-pointer">
          {item.work.title}
        </h4>
        <p className="text-xs text-muted truncate">{authors}</p>
        <p className="text-[10px] font-mono text-muted/60 flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />
          {addedAgo}
        </p>
      </div>
    </div>
  );
}

function TipCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-4 bg-white border border-intel-blue/10 rounded-sm hover:border-intel-blue/30 hover:shadow-sm transition-all group"
    >
      <div className="w-8 h-8 bg-intel-blue/10 rounded-full flex items-center justify-center shrink-0 text-intel-blue group-hover:bg-intel-blue group-hover:text-white transition-colors">
        {icon}
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-serif font-bold group-hover:underline">{title}</h4>
        <p className="text-xs text-intel-blue/60 font-serif italic">{description}</p>
      </div>
    </Link>
  );
}

