import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Bug,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Search,
  Sparkles,
  Scale,
  RefreshCw,
  SlidersHorizontal,
  Camera
} from 'lucide-react';
import { fetchBugs, BugFinding } from '../api/client';
import { getSimpleBugExplanation } from '../utils/bugExplainer';

export const BugReports: React.FC = () => {
  const [bugs, setBugs] = useState<BugFinding[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetchBugs()
      .then(setBugs)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = [
    'Functional behavior and navigation',
    'Form validation and input boundaries',
    'Business logic and calculations',
    'Transaction and workflow integrity',
    'Data persistence and state consistency',
    'Authentication and authorization',
    'Session, recovery, and interrupted workflows',
    'UI, accessibility, and responsive behavior',
    'API integration, reliability, and performance',
    'Security findings'
  ];

  const filteredBugs = bugs.filter(b => {
    if (severityFilter !== 'All' && b.severity !== severityFilter) return false;
    if (statusFilter !== 'All' && b.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && b.category !== categoryFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        b.affected_url.toLowerCase().includes(q) ||
        (b.category && b.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Confirmed
          </span>
        );
      case 'Suspected':
      case 'Likely':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Suspected
          </span>
        );
      case 'Inconclusive':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <AlertTriangle className="w-3 h-3 text-purple-600" />
            Inconclusive
          </span>
        );
      case 'Dismissed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
            Dismissed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-rose-600 uppercase flex items-center gap-1">
              <Bug className="w-3.5 h-3.5" /> Proof-Carrying Defect Reports
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[hsl(var(--foreground))]">
            Verified Defect Findings
          </h1>
          <p className="text-xs md:text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Defects backed by clean isolated replay, deterministic assertions, expectation provenance, and transparent trust scores.
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--secondary))] text-xs font-medium text-[hsl(var(--foreground))] transition self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-xs p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search finding title, ID, category, or URL..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--secondary))]/30 w-full focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
            />
          </div>

          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="text-xs border border-[hsl(var(--border))] rounded-lg px-2.5 py-1.5 bg-[hsl(var(--secondary))]/30 text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border border-[hsl(var(--border))] rounded-lg px-2.5 py-1.5 bg-[hsl(var(--secondary))]/30 text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
          >
            <option value="All">All Verification States</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Suspected">Suspected</option>
            <option value="Inconclusive">Inconclusive</option>
            <option value="Dismissed">Dismissed / Not a bug</option>
          </select>
        </div>

        {/* 10 Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[hsl(var(--border))] text-xs">
          <span className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase px-2 shrink-0">
            Taxonomy:
          </span>
          <button
            onClick={() => setCategoryFilter('All')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
              categoryFilter === 'All'
                ? 'bg-[hsl(var(--primary))] text-white'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
            }`}
          >
            All Categories ({bugs.length})
          </button>
          {categories.map(cat => {
            const count = bugs.filter(b => b.category === cat).length;
            if (count === 0 && categoryFilter !== cat) return null;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                  categoryFilter === cat
                    ? 'bg-[hsl(var(--primary))] text-white'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]'
                }`}
              >
                {cat.split(' ')[0]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Findings List */}
      <div className="bg-white rounded-xl border border-[hsl(var(--border))] shadow-xs overflow-hidden">
        {filteredBugs.length === 0 ? (
          <div className="p-12 text-center text-xs text-[hsl(var(--muted-foreground))] space-y-2">
            <Bug className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="font-semibold text-sm text-[hsl(var(--foreground))]">
              {loading ? 'Loading findings...' : 'No bug reports matching the selected filters.'}
            </div>
            <p>Launch an autonomous exploration run to discover and verify software defects.</p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {filteredBugs.map(bug => {
              const trustScore = bug.trust_score ?? bug.confidence_score ?? 0.85;
              return (
                <div
                  key={bug.id}
                  className="p-5 hover:bg-[hsl(var(--secondary))]/30 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          bug.severity === 'Critical'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : bug.severity === 'High'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {bug.severity}
                      </span>
                      {getStatusBadge(bug.status)}
                      <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] bg-slate-100 px-1.5 py-0.5 rounded">
                        {bug.id}
                      </span>
                      {bug.category && (
                        <span className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                          {bug.category}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-[hsl(var(--foreground))]">
                      <NavLink to={`/bugs/${bug.id}`} className="hover:text-[hsl(var(--accent))] transition">
                        {bug.title}
                      </NavLink>
                    </h3>

                    {/* Defect Summary Snippet */}
                    {(() => {
                      const expl = getSimpleBugExplanation(bug);
                      return (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/90 text-xs text-slate-800 space-y-0.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{expl.headline}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-sans pl-5">
                            {expl.inSimpleWords}
                          </p>
                        </div>
                      );
                    })()}

                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] flex flex-wrap items-center gap-3 pt-1">
                      <span>Target: <code className="text-[hsl(var(--foreground))] font-mono">{bug.affected_url}</code></span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Camera className="w-3 h-3 text-emerald-600" />
                        <span>3-Step Screenshots: Before &bull; Bug &bull; After</span>
                      </span>
                      <span>•</span>
                      <span>Replays: <strong className="text-[hsl(var(--foreground))]">{bug.replay_attempts}</strong></span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Scale className="w-3 h-3 text-[hsl(var(--accent))]" />
                        <span>Trust:</span>
                        <strong className="text-[hsl(var(--foreground))] font-mono">
                          {(trustScore * 100).toFixed(0)}%
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <NavLink
                      to={`/bugs/${bug.id}`}
                      className="text-xs font-semibold text-[hsl(var(--primary))] bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--muted))] border border-[hsl(var(--border))] px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition"
                    >
                      <span>Inspect Evidence & Rationale</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[hsl(var(--accent))]" />
                    </NavLink>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

