"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  Brain,
  Search,
  Library,
  Settings,
  Menu,
  X,
  Command,
  LayoutDashboard,
  Users,
  Database,
  LineChart,
  FileText,
  Bell,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useSession, signOut } from "next-auth/react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { useSSE } from "@/hooks/use-sse";

function NavItem({
  icon,
  label,
  isOpen,
  active,
  color,
  href,
  onClick
}: {
  icon: React.ReactNode,
  label: string,
  isOpen: boolean,
  active?: boolean,
  color?: string,
  href: string,
  onClick?: () => void
}) {
  return (
    <Link
      href={href || "/dashboard"}
      onClick={onClick}
      className={cn(
        "w-full flex items-center p-2 rounded-md transition-all group outline-none",
        active ? "bg-paper text-ink shadow-sm border border-border/50" : "text-muted hover:text-ink hover:bg-paper/50",
        color === 'blue' && active && "text-intel-blue bg-intel-blue/5 border-intel-blue/20"
      )}
    >
      <span className={cn(
        active ? "text-ink" : "text-muted group-hover:text-ink transition-colors",
        color === 'blue' && (active ? "text-intel-blue" : "group-hover:text-intel-blue")
      )}>
        {icon}
      </span>
      {isOpen && <span className="ml-3 font-serif italic text-lg leading-none">{label}</span>}
    </Link>
  );
}

function OpsNav({ isOpen, onItemClick }: { isOpen: boolean, onItemClick?: () => void }) {
  const pathname = usePathname();
  const { currentProjectId } = useAppStore();

  // If no project is selected, project-specific links go to the projects list
  const projectBaseUrl = currentProjectId ? `/project/${currentProjectId}` : '/projects';

  return (
    <>
      <NavItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" isOpen={isOpen} active={pathname === '/dashboard'} href="/dashboard" onClick={onItemClick} />
      <NavItem
        icon={<ClipboardList className="w-5 h-5" />}
        label="Projects"
        isOpen={isOpen}
        active={pathname === '/projects' || (pathname.includes('/project') && !pathname.includes('/import') && !pathname.includes('/team') && !pathname.includes('/analytics'))}
        href="/projects"
        onClick={onItemClick}
      />
      <NavItem icon={<Database className="w-5 h-5" />} label="Import" isOpen={isOpen} active={pathname.includes('/import')} href={currentProjectId ? `${projectBaseUrl}/import` : '/projects'} onClick={onItemClick} />
      <NavItem icon={<Users className="w-5 h-5" />} label="Team" isOpen={isOpen} active={pathname.includes('/team')} href={currentProjectId ? `${projectBaseUrl}/team` : '/projects'} onClick={onItemClick} />
      <NavItem icon={<LineChart className="w-5 h-5" />} label="Analytics" isOpen={isOpen} active={pathname.includes('/analytics')} href={currentProjectId ? `${projectBaseUrl}/analytics` : '/projects'} onClick={onItemClick} />
    </>
  );
}

function IntelNav({ isOpen, onItemClick }: { isOpen: boolean, onItemClick?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      <NavItem icon={<Brain className="w-5 h-5" />} label="Intelligence" isOpen={isOpen} active={pathname === '/dashboard'} href="/dashboard" color="blue" onClick={onItemClick} />
      <NavItem icon={<Search className="w-5 h-5" />} label="Discover" isOpen={isOpen} active={pathname.includes('/discover')} href="/discover" color="blue" onClick={onItemClick} />
      <NavItem icon={<Library className="w-5 h-5" />} label="My Library" isOpen={isOpen} active={pathname.includes('/library')} href="/library" color="blue" onClick={onItemClick} />
      <NavItem icon={<Command className="w-5 h-5" />} label="Graphs" isOpen={isOpen} active={pathname.includes('/graphs')} href="/graphs" color="blue" onClick={onItemClick} />
      <NavItem icon={<FileText className="w-5 h-5" />} label="Writing" isOpen={isOpen} active={pathname.includes('/writing')} href="/writing" color="blue" onClick={onItemClick} />
    </>
  );
}

function AvatarMenu() {
  const { data: session } = useSession();
  const user = session?.user;

  // Get initials for avatar fallback
  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    : user?.email?.substring(0, 2).toUpperCase() || "??";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="w-8 h-8 rounded-full bg-paper border border-border flex items-center justify-center overflow-hidden hover:border-ink transition-colors outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name || "User Avatar"} className="w-full h-full object-cover" />
          ) : (
            <div className="text-[10px] font-bold text-muted">{initials}</div>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[220px] bg-white rounded-md p-2 shadow-editorial border border-border z-[100] animate-in fade-in zoom-in duration-200"
          sideOffset={5}
          align="end"
        >
          <div className="px-3 py-2 border-b border-border/50 mb-1">
            <p className="text-xs font-bold font-mono uppercase tracking-widest text-ink">{user?.name || "Anonymous User"}</p>
            <p className="text-[10px] text-muted font-serif italic">{user?.email || "No email provided"}</p>
          </div>

          <DropdownMenu.Item asChild className="group flex items-center px-3 py-2 text-sm text-muted hover:text-ink hover:bg-paper rounded-sm outline-none cursor-pointer transition-colors">
            <Link href="/settings" className="flex items-center w-full">
              <User className="w-4 h-4 mr-3 opacity-60 group-hover:opacity-100" />
              <span className="font-serif italic">View Profile</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item asChild className="group flex items-center px-3 py-2 text-sm text-muted hover:text-ink hover:bg-paper rounded-sm outline-none cursor-pointer transition-colors">
            <Link href="/settings" className="flex items-center w-full">
              <Settings className="w-4 h-4 mr-3 opacity-60 group-hover:opacity-100" />
              <span className="font-serif italic">Settings</span>
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-[1px] bg-border my-1" />

          <DropdownMenu.Item
            className="group flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-sm outline-none cursor-pointer transition-colors"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="w-4 h-4 mr-3 opacity-60 group-hover:opacity-100" />
            <span className="font-serif italic">Sign Out</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { mode, setMode, isSidebarOpen, toggleSidebar, currentProjectId } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Global SSE connection (single EventSource for the whole app)
  useSSE(currentProjectId || undefined);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Command Palette Listener (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-paper overflow-hidden font-sans">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "hidden md:flex bg-white border-r border-border transition-all duration-300 flex-col z-50",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <Link href="/dashboard" className="p-6 flex items-center gap-4 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center text-paper font-serif italic text-xl shrink-0">
            L
          </div>
          {isSidebarOpen && <span className="font-serif text-2xl tracking-tight text-ink truncate">LitLens</span>}
        </Link>

        {/* Mode Switcher */}
        <div className="px-4 mb-8">
          <div className={cn(
            "bg-paper p-1 flex",
            isSidebarOpen ? "rounded-md" : "rounded-sm"
          )}>
            <button
              onClick={() => setMode('OPERATIONS')}
              className={cn(
                "flex-1 flex items-center justify-center p-2 transition-all rounded-sm",
                mode === 'OPERATIONS' ? "bg-white shadow-sm text-ink" : "text-muted hover:text-ink"
              )}
              title="Operations"
            >
              <ClipboardList className="w-4 h-4" />
              {isSidebarOpen && <span className="ml-2 text-[10px] font-mono uppercase tracking-widest font-bold">Ops</span>}
            </button>
            <button
              onClick={() => setMode('INTELLIGENCE')}
              className={cn(
                "flex-1 flex items-center justify-center p-2 transition-all rounded-sm",
                mode === 'INTELLIGENCE' ? "bg-white shadow-sm text-intel-blue" : "text-muted hover:text-intel-blue"
              )}
              title="Intelligence"
            >
              <Brain className="w-4 h-4" />
              {isSidebarOpen && <span className="ml-2 text-[10px] font-mono uppercase tracking-widest font-bold">Intel</span>}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto scrollbar-hide">
          {mode === 'OPERATIONS' ? (
            <OpsNav isOpen={isSidebarOpen} />
          ) : (
            <IntelNav isOpen={isSidebarOpen} />
          )}
        </nav>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <NavItem icon={<Settings className="w-5 h-5" />} label="Settings" isOpen={isSidebarOpen} href="/settings" />
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center p-2 text-muted hover:text-ink transition-colors rounded-md group"
          >
            {isSidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            {isSidebarOpen && <span className="ml-3 font-serif italic">Collapse Navigation</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-[60] md:hidden animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-white z-[70] md:hidden transition-transform duration-500 ease-editorial border-r border-border flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center justify-between border-b border-border/50 mb-8">
          <Link href="/dashboard" className="flex items-center gap-4">
            <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center text-paper font-serif italic text-xl">L</div>
            <span className="font-serif text-2xl tracking-tight text-ink">LitLens</span>
          </Link>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-muted hover:text-ink">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 mb-8">
          <div className="bg-paper p-1 flex rounded-md">
            <button
              onClick={() => setMode('OPERATIONS')}
              className={cn(
                "flex-1 flex items-center justify-center py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-all rounded-sm",
                mode === 'OPERATIONS' ? "bg-white shadow-sm text-ink" : "text-muted"
              )}
            >
              Operations
            </button>
            <button
              onClick={() => setMode('INTELLIGENCE')}
              className={cn(
                "flex-1 flex items-center justify-center py-2 text-[10px] font-mono uppercase tracking-widest font-bold transition-all rounded-sm",
                mode === 'INTELLIGENCE' ? "bg-white shadow-sm text-intel-blue" : "text-muted"
              )}
            >
              Intelligence
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {mode === 'OPERATIONS' ? (
            <OpsNav isOpen={true} onItemClick={() => setIsMobileMenuOpen(false)} />
          ) : (
            <IntelNav isOpen={true} onItemClick={() => setIsMobileMenuOpen(false)} />
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-white flex items-center justify-between px-4 md:px-8 z-40 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 text-muted hover:text-ink md:hidden transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative group hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-ink transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search everything... (Cmd+K)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const query = e.currentTarget.value;
                    if (query.trim()) {
                      router.push(`/discover?q=${encodeURIComponent(query)}`);
                    }
                  }
                }}
                className="bg-paper pl-10 pr-4 py-2 rounded-md text-sm w-48 lg:w-80 border-none focus:ring-1 focus:ring-ink transition-all font-sans outline-none text-ink placeholder:text-muted/50"
              />
            </div>
            <button className="sm:hidden p-2 text-muted hover:text-ink">
              <Search className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <Link href="/notifications" className="p-2 text-muted hover:text-ink relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-intel-blue rounded-full border-2 border-white shadow-sm" />
            </Link>
            <div className="h-6 w-[1px] bg-border mx-1 hidden sm:block" />
            <AvatarMenu />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-paper scroll-smooth relative">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>

        {/* Mode Indicator (Floating) - Hidden on mobile to save space */}
        <div className={cn(
          "absolute bottom-8 right-8 px-4 py-2 rounded-full border text-[10px] font-mono uppercase tracking-widest shadow-editorial backdrop-blur-md z-40 select-none hidden sm:block transition-all duration-500",
          mode === 'OPERATIONS' ? "border-ink bg-white/80 text-ink" : "border-intel-blue bg-intel-blue/10 text-intel-blue"
        )}>
          {mode} MODE // ACTIVE
        </div>
      </main>
    </div>
  );
}
