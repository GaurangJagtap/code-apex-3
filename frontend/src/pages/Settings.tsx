import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Shield,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Terminal,
  RefreshCw
} from 'lucide-react';
import { fetchConfigStatus, ConfigStatus } from '../api/client';

export const Settings: React.FC = () => {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfigStatus()
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[#635BFF]" />
          Platform Settings & Configuration
        </h2>
        <p className="text-xs text-[#525866] mt-0.5">
          Inspect active AI providers, Playwright browser limits, security boundaries, and local demonstration defaults.
        </p>
      </div>

      {/* AI Provider Configuration */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
          <h3 className="font-semibold text-sm text-[#171717] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#635BFF]" />
            AI Reasoning Engine Status
          </h3>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
              config?.demo_mode_active
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {config?.demo_mode_active ? 'Deterministic Demo Mode' : 'Real AI Connected'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] font-medium block">Configured Provider:</span>
            <strong className="text-[#171717] text-sm capitalize">{config?.llm_provider || 'demo'}</strong>
          </div>
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] font-medium block">Active Model:</span>
            <strong className="text-[#171717] text-sm font-mono">{config?.llm_model || 'N/A'}</strong>
          </div>
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] font-medium block">API Key Status:</span>
            <strong className="text-[#171717] text-sm font-mono">
              {config?.api_key_configured ? config.api_key_masked : 'None (Using Local Demo Mode)'}
            </strong>
          </div>
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] font-medium block">Structured Output Schema:</span>
            <strong className="text-emerald-700 text-sm">Pydantic Schema Validation Active</strong>
          </div>
        </div>

        <div className="text-[11px] text-[#525866] bg-[#F8F9FB] p-3 rounded-lg border border-[#E5E7EB]">
          <strong>How to enable Real AI Mode:</strong> Set <code>LLM_PROVIDER=gemini</code> and <code>LLM_API_KEY=your_key</code> in your <code>.env</code> file. No raw keys are ever displayed in UI or logged in reports.
        </div>
      </div>

      {/* Security & Boundaries */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4">
        <h3 className="font-semibold text-sm text-[#171717] flex items-center gap-2 pb-3 border-b border-[#E5E7EB]">
          <Shield className="w-4 h-4 text-[#635BFF]" />
          Target Whitelist & SSRF Security Boundaries
        </h3>

        <div className="space-y-2 text-xs">
          <p className="text-[#525866]">
            To prevent SSRF and unauthorized cloud metadata access, tests are restricted to approved local targets:
          </p>
          <div className="flex flex-wrap gap-2">
            {config?.allowed_hosts.map(h => (
              <span key={h} className="bg-[#F8F9FB] text-[#171717] font-mono text-xs px-2.5 py-1 rounded border border-[#E5E7EB]">
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Execution Limits */}
      <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4">
        <h3 className="font-semibold text-sm text-[#171717] flex items-center gap-2 pb-3 border-b border-[#E5E7EB]">
          <Sliders className="w-4 h-4 text-[#635BFF]" />
          Browser Execution Budgets
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] block">Max Pages</span>
            <strong className="text-sm text-[#171717]">{config?.boundaries.max_pages || 10}</strong>
          </div>
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] block">Max Actions</span>
            <strong className="text-sm text-[#171717]">{config?.boundaries.max_actions || 30}</strong>
          </div>
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] block">Max Duration</span>
            <strong className="text-sm text-[#171717]">{config?.boundaries.max_duration_sec || 300}s</strong>
          </div>
          <div className="p-3 bg-[#F8F9FB] rounded-lg border border-[#E5E7EB]">
            <span className="text-[#525866] block">Replay Retries</span>
            <strong className="text-sm text-[#171717]">{config?.boundaries.max_retries || 2}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
