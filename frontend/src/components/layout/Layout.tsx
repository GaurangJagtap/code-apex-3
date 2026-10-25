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
          className={`p-4 border-b border-[#E2E8F0] flex items-center ${
            isCollapsed ? 'flex-col gap-2 justify-center' : 'justify-between'
          }`}
        >
          {isCollapsed ? (
            <>
              <Link
                to="/dashboard"
                title="Autonomous QA Dashboard"
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#5145E5] to-[#635BFF] text-white flex items-center justify-center font-bold text-sm shadow-md transition-transform hover:scale-105"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expand sidebar"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition border border-transparent hover:border-[#E2E8F0]"
              >
                <ChevronRight className="w-4 h-4 text-[#635BFF]" />
              </button>
            </>
          ) : (
            <>
              <Link to="/dashboard" className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#5145E5] to-[#635BFF] text-white flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-105">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm tracking-tight text-[#0F172A]">
                    Autonomous QA
                  </div>
                  <div className="text-[11px] font-medium text-[#64748B]">iMocha IM-02 Platform</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse to icons"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition border border-transparent hover:border-[#E2E8F0] flex items-center justify-center"
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
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative ${
                    isActive
                      ? 'bg-[#F0EFFF] text-[#635BFF] font-semibold ring-1 ring-[#635BFF]/30'
                      : 'text-[#525866] hover:bg-[#F3F4F6] hover:text-[#171717]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#635BFF]' : 'group-hover:scale-105 transition-transform'}`} />
                  {isActive && (
                    <span className="absolute -left-1 w-1 h-4 rounded-r bg-[#635BFF]" />
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
                    ? 'bg-[#F0EFFF] text-[#635BFF] font-semibold ring-1 ring-[#635BFF]/20 shadow-xs'
                    : 'text-[#525866] hover:bg-[#F3F4F6] hover:text-[#171717]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#635BFF]' : 'text-[#858B98]'}`} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Operating Environment Status */}
        <div className={`border-t border-[#E5E7EB] bg-[#F8F9FB] ${isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-3'}`}>
          {isCollapsed ? (
            <>
              <div
                title={`Engine Mode: ${config?.demo_mode_active ? 'Deterministic' : 'Autonomous AI'}`}
                className={`w-7 h-7 rounded-md flex items-center justify-center border cursor-default ${
                  config?.demo_mode_active
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <a
                href="http://127.0.0.1:5001"
                target="_blank"
                rel="noreferrer"
                title="Open Sample Apps (Port 5001)"
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#635BFF] hover:bg-white border border-transparent hover:border-[#E5E7EB] transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
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
        <header className="h-16 border-b border-[#E2E8F0] bg-white/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)] z-20">
          <div className="flex items-center gap-3">
            {/* Toggle button in top navbar */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? "Expand Sidebar" : "Collapse to Icons"}
              className="p-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F1F5F9] text-[#0F172A] transition"
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-[#635BFF]" /> : <PanelLeftClose className="w-4 h-4 text-[#64748B]" />}
            </button>

            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-[#0F172A] tracking-tight">{getPageTitle()}</h1>
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[11px] font-semibold text-[#635BFF] bg-[#F0EFFF] px-2.5 py-0.5 rounded-full border border-[#635BFF]/20 flex items-center gap-1.5">
                <Award className="w-3 h-3 text-[#635BFF]" />
                iMocha IM-02 Challenge
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="http://127.0.0.1:5001"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-[#475569] hover:text-[#0F172A] bg-white hover:bg-[#F8FAFC] px-3.5 py-2 rounded-xl border border-[#E2E8F0] shadow-xs transition"
            >
              <span>Target Apps (5001)</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#635BFF]" />
            </a>

            <Link
              to="/new-run"
              className="flex items-center gap-2 bg-gradient-to-r from-[#635BFF] to-[#5145E5] hover:from-[#5145E5] hover:to-[#4338CA] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm hover:shadow-md"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Launch New Run</span>
            </Link>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F8FAFC]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
