import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  PlayCircle,
  Compass,
  ListChecks,
  FileCheck2,
  Bug,
  History,
  Settings as SettingsIcon,
  Sparkles,
  Cpu,
  RefreshCw,
  ExternalLink,
  Award,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu
} from 'lucide-react';
import { fetchConfigStatus, ConfigStatus } from '../../api/client';

export const Layout: React.FC = () => {
  const location = useLocation();
  const [config, setConfig] = useState<ConfigStatus | null>(null);

  // Persistent sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('apex_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('apex_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    fetchConfigStatus().then(setConfig).catch(() => {});
  }, []);

  const navItems = [
    { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
    { label: 'New Test Run', path: '/new-run', icon: PlayCircle },
    { label: 'Exploration Map', path: '/explore', icon: Compass },
    { label: 'Test Runs', path: '/runs', icon: ListChecks },
    { label: 'Test Cases', path: '/test-cases', icon: FileCheck2 },
    { label: 'Bug Reports', path: '/bugs', icon: Bug },
    { label: 'Regression Tests', path: '/regression', icon: History },
    { label: 'Benchmark Console', path: '/benchmark', icon: Award },
    { label: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const getPageTitle = () => {
    const current = navItems.find(item => item.path === location.pathname);
    if (current) return current.label;
    if (location.pathname.startsWith('/bugs/')) return 'Bug Finding Details';
    if (location.pathname.startsWith('/runs/')) return 'Test Run Details';
    if (location.pathname.startsWith('/test-cases/')) return 'Test Case Timeline';
    return 'Autonomous AI QA';
  };

  return (
    <div className="flex h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] font-sans overflow-hidden">
      {/* Collapsible Sidebar */}
      <aside
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-64'
        } border-r border-[hsl(var(--border))] bg-white flex flex-col shrink-0 select-none transition-all duration-300 ease-in-out shadow-xs z-30`}
      >
        {/* Brand Header */}
        <div
          className={`p-3.5 border-b border-[hsl(var(--border))] flex items-center ${
            isCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'
          }`}
        >
          {isCollapsed ? (
            <>
              <Link
                to="/dashboard"
                title="Autonomous QA Dashboard"
                className="w-10 h-10 rounded-xl bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold text-sm shadow-sm transition-transform hover:scale-105"
              >
                <Sparkles className="w-5 h-5 text-[hsl(var(--accent))]" />
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand sidebar"
                className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition border border-transparent hover:border-[hsl(var(--border))]"
              >
                <ChevronRight className="w-4 h-4 text-[hsl(var(--accent))]" />
              </button>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-105">
                  <Sparkles className="w-4 h-4 text-[hsl(var(--accent))]" />
                </div>
                <div>
                  <div className="font-semibold text-sm tracking-tight text-[hsl(var(--foreground))]">✦ Autonomous QA</div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))]">iMocha Platform</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse to icons"
                className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition border border-transparent hover:border-[hsl(var(--border))] flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Navigation Routes */}
        <nav className={`p-2.5 space-y-1 flex-1 overflow-y-auto ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-[hsl(var(--muted-foreground))] uppercase">
              Platform Workflow
            </div>
          )}

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            if (isCollapsed) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all group relative ${
                    isActive
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm ring-2 ring-[hsl(var(--accent))]/40'
                      : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[hsl(var(--accent))]' : 'group-hover:scale-110 transition-transform'}`} />
                  {/* Subtle active pill indicator on left */}
                  {isActive && (
                    <span className="absolute -left-1 w-1.5 h-5 rounded-r-full bg-[hsl(var(--accent))]" />
                  )}
                </NavLink>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] font-semibold border border-[hsl(var(--border))] shadow-xs'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[hsl(var(--accent))]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Operating Environment Status */}
        <div className={`border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 ${isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3.5'}`}>
          {isCollapsed ? (
            <>
              <div
                title={`Engine Mode: ${config?.demo_mode_active ? 'Deterministic' : 'Autonomous AI'}`}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border cursor-default ${
                  config?.demo_mode_active
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                }`}
              >
                <Cpu className="w-4 h-4" />
              </div>
              <a
                href="http://127.0.0.1:5001"
                target="_blank"
                rel="noreferrer"
                title="Open Sample Apps (Port 5001)"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--accent))] hover:bg-white border border-transparent hover:border-[hsl(var(--border))] transition"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => fetch('/api/v1/health').then(() => window.location.reload())}
                title="Refresh Engine Status"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-white border border-transparent hover:border-[hsl(var(--border))] transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-[hsl(var(--muted-foreground))] font-medium flex items-center gap-1.5 text-[11px]">
                  <Cpu className="w-3 h-3 text-[hsl(var(--accent))]" />
                  Engine Mode
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    config?.demo_mode_active
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {config?.demo_mode_active ? 'Deterministic' : 'Autonomous AI'}
                </span>
              </div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                Target: <code className="bg-white px-1.5 py-0.5 rounded border border-[hsl(var(--border))] text-[10px] text-[hsl(var(--foreground))] font-mono">127.0.0.1:5001</code>
              </div>
              <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] flex items-center justify-between text-[11px]">
                <a
                  href="http://127.0.0.1:5001"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[hsl(var(--accent))] hover:underline flex items-center gap-1 font-medium text-[11px]"
                >
                  <span>Sample Apps (5001)</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
                <button
                  type="button"
                  onClick={() => fetch('/api/v1/health').then(() => window.location.reload())}
                  title="Refresh Engine Status"
                  className="p-1 hover:bg-[hsl(var(--muted))] rounded text-[hsl(var(--muted-foreground))] transition"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-14 border-b border-[hsl(var(--border))] bg-white px-5 md:px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Toggle button in top navbar */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand Sidebar" : "Collapse to Icons"}
              className="p-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] transition"
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-[hsl(var(--accent))]" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <h1 className="font-semibold text-base text-[hsl(var(--foreground))] tracking-tight">{getPageTitle()}</h1>
            <span className="text-[hsl(var(--border))]">/</span>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] px-2.5 py-0.5 rounded-full font-mono border border-[hsl(var(--border))]">
              iMocha IM-02 Challenge
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="http://127.0.0.1:5001"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] bg-[hsl(var(--secondary))] px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] transition"
            >
              <span>Target Sites (:5001)</span>
              <ExternalLink className="w-3 h-3 text-[hsl(var(--accent))]" />
            </a>

            <Link
              to="/new-run"
              className="flex items-center gap-1.5 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-[hsl(var(--primary-foreground))] px-3.5 py-1.5 rounded-full text-xs font-semibold transition shadow-xs"
            >
              <PlayCircle className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
              <span>Launch New Run</span>
            </Link>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[hsl(var(--background))]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
