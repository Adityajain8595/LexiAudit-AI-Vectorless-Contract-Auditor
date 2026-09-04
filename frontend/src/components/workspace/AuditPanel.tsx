import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Info, Lightbulb, FileSearch,
  Check, FileText, BarChart3, Filter
} from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import type { RiskClause, MissingClause } from '../../store/workspaceStore';

const RISK_CONFIG = {
  HIGH: {
    label: 'High Risk',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    icon: XCircle,
    badgeBg: 'bg-red-500/20 text-red-300 border-red-500/30'
  },
  MEDIUM: {
    label: 'Medium Risk',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    icon: AlertTriangle,
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  },
  LOW: {
    label: 'Low Risk',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    icon: CheckCircle,
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  },
};

const SEV_CONFIG = {
  HIGH: { color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
  MEDIUM: { color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30' },
  LOW: { color: 'text-slate-400', bg: 'bg-slate-500/15', border: 'border-slate-500/25' },
};

function RiskRow({
  clause,
  onViewPdf,
}: {
  clause: RiskClause;
  onViewPdf: (page: string | number, text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = RISK_CONFIG[clause.risk_level] || RISK_CONFIG.MEDIUM;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border ${cfg.border} overflow-hidden transition-all ${cfg.bg}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <Icon size={16} className={`${cfg.color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-100 tracking-wide">
              {clause.clause_name}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeBg}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-slate-500">
              Page {clause.page_number}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
            {clause.section_title}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewPdf(clause.page_number, clause.extracted_text);
            }}
            title="Inspect in PDF"
            className="flex items-center gap-1 text-[10px] font-semibold text-peach-400 hover:text-peach-300 bg-peach-500/10 hover:bg-peach-500/20 border border-peach-500/20 px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            <FileSearch size={11} /> p.{clause.page_number}
          </button>
          {expanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5 bg-slate-950/60"
          >
            <div className="p-4 flex flex-col gap-3.5">
              {/* Extracted snippet */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-white/5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <FileText size={11} className="text-peach-400" /> Verbatim Extract
                </p>
                <p className="text-xs text-slate-300 font-mono italic leading-relaxed">
                  "{clause.extracted_text}"
                </p>
              </div>

              {/* Analysis */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Info size={11} className="text-amber-400" /> Legal Risk Assessment
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {clause.analysis}
                </p>
              </div>

              {/* Remedy */}
              {clause.remedy_recommendation && (
                <div className="p-3 rounded-xl bg-peach-500/[0.08] border border-peach-500/20">
                  <p className="text-[10px] font-semibold text-peach-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Lightbulb size={11} className="text-peach-400" /> Counter-Language & Recommendation
                  </p>
                  <p className="text-xs text-peach-200 leading-relaxed font-sans">
                    {clause.remedy_recommendation}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MissingRow({ clause }: { clause: MissingClause }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = SEV_CONFIG[clause.severity] || SEV_CONFIG.MEDIUM;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(clause.suggested_language);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border ${cfg.border} overflow-hidden transition-all ${cfg.bg}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors cursor-pointer"
      >
        <AlertTriangle size={16} className={`${cfg.color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-100 tracking-wide">
              {clause.clause_name}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {clause.severity} Severity
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {clause.impact_description}
          </p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/5 bg-slate-950/60"
          >
            <div className="p-4 flex flex-col gap-3.5">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Legal Impact
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {clause.impact_description}
                </p>
              </div>

              {clause.suggested_language && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-white/5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold text-peach-400 uppercase tracking-wider">
                      Suggested Insertion Boilerplate
                    </p>
                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-peach-300 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={11} className="text-emerald-400" /> : null}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-xs text-peach-200 font-mono whitespace-pre-wrap leading-relaxed">
                    {clause.suggested_language}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AuditPanel() {
  const { selectedDoc, openPdf } = useWorkspaceStore();
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [tab, setTab] = useState<'RISKS' | 'MISSING'>('RISKS');

  if (!selectedDoc) return null;

  const risks = Array.isArray(selectedDoc?.risk_analysis) ? selectedDoc.risk_analysis : [];
  const missing = Array.isArray(selectedDoc?.missing_clauses) ? selectedDoc.missing_clauses : [];

  const filteredRisks = risks.filter((r) => {
    if (filter === 'ALL') return true;
    return r.risk_level === filter;
  });

  const highCount = risks.filter((r) => r.risk_level === 'HIGH').length;
  const mediumCount = risks.filter((r) => r.risk_level === 'MEDIUM').length;
  const lowCount = risks.filter((r) => r.risk_level === 'LOW').length;

  const handleInspect = (page: string | number, text: string) => {
    openPdf({
      node_id: 'inspect',
      title: selectedDoc.filename,
      page_index: page,
      summary: 'Audited Section',
      exact_text: text,
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-950/40 select-none">
      {/* Top summary stats */}
      <div className="shrink-0 p-5 border-b border-white/8 bg-slate-900/40 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={17} className="text-peach-400" />
            <h2 className="text-sm font-bold text-slate-100">Audit Dossier</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {risks.length} Clauses Assessed
          </span>
        </div>

        {/* Mini stat capsules */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 flex flex-col items-center text-center">
            <span className="text-base font-bold text-red-400 font-mono">{highCount}</span>
            <span className="text-[10px] text-red-300 uppercase tracking-wider font-semibold">High Risk</span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col items-center text-center">
            <span className="text-base font-bold text-amber-400 font-mono">{mediumCount}</span>
            <span className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">Medium Risk</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col items-center text-center">
            <span className="text-base font-bold text-emerald-400 font-mono">{lowCount}</span>
            <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold">Low Risk</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-900/90 p-1 border border-white/5">
          <button
            onClick={() => setTab('RISKS')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'RISKS'
                ? 'bg-peach-500/20 text-peach-300 border border-peach-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Risk Analysis ({risks.length})
          </button>
          <button
            onClick={() => setTab('MISSING')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'MISSING'
                ? 'bg-peach-500/20 text-peach-300 border border-peach-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Missing Clauses ({missing.length})
          </button>
        </div>

        {/* Filter for Risks */}
        {tab === 'RISKS' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Filter size={12} className="text-slate-500 shrink-0 mr-1" />
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rows Container */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {tab === 'RISKS' ? (
          filteredRisks.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No clauses matched the selected filter.
            </div>
          ) : (
            filteredRisks.map((c, i) => (
              <RiskRow key={i} clause={c} onViewPdf={handleInspect} />
            ))
          )
        ) : missing.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No missing boilerplate clauses detected.
          </div>
        ) : (
          missing.map((c, i) => <MissingRow key={i} clause={c} />)
        )}
      </div>
    </div>
  );
}
