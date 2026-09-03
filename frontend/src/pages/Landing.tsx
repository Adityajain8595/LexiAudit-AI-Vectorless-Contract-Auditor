import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Scale, Shield, Search, FileText, ArrowRight, Zap, GitBranch,
  ChevronRight, Sparkles, AlertTriangle, Copy,
  Check, FileSearch, Eye
} from 'lucide-react';
import HeroScene from '../components/landing/HeroScene';

const fadeUp = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0 } };

// ── Interactive Live Workspace Showcase (Authentic ChatPanel + PDF Viewer Split-View) ──
const SHOWCASE_CLAUSES = [
  {
    id: 'sec-8-2',
    name: '§ 8.2 Indemnification & Liability Cap',
    risk: 'HIGH RISK',
    page: 14,
    totalPages: 32,
    sectionNumber: '8.2',
    articleTitle: 'ARTICLE VIII — INDEMNIFICATION & ALLOCATION OF RISK',
    verbatim:
      'Tenant shall unconditionally indemnify, defend and hold harmless Landlord from any and all claims, liabilities, losses, damages, without limitation of dollar cap or fault attribution.',
    query: 'Is liability capped under Section 8.2 or reciprocal?',
    answer:
      'No. Section 8.2 imposes strict, uncapped indemnification exclusively on the Tenant with zero reciprocal protections or standard gross negligence carve-outs.',
    remedy:
      'Subject indemnification to mutual standard fault, cap aggregate liability at 12 months base fees, and exclude consequential/indirect damages.',
    precedingText: '8.1 Insurance Obligations. Both parties shall maintain comprehensive commercial general liability coverage during the term...',
    subsequentText: '8.3 Notice of Claims. Each party shall notify the other in writing within ten (10) business days of any indemnifiable claim...'
  },
  {
    id: 'sec-14-1',
    name: '§ 14.1 Force Majeure & Rent Abatement',
    risk: 'MEDIUM RISK',
    page: 22,
    totalPages: 32,
    sectionNumber: '14.1',
    articleTitle: 'ARTICLE XIV — CASUALTY & FORCE MAJEURE',
    verbatim:
      'Neither party shall be liable for delays resulting from Acts of God, war, or governmental confiscation, provided rent payment obligations shall strictly continue uninterrupted.',
    query: 'Is payment abated if the premises become completely inaccessible?',
    answer:
      'No. Section 14.1 expressly excludes rent abatement during prolonged disruptions, shifting 100% of facility casualty risk onto the tenant.',
    remedy:
      'Insert standard rent abatement after thirty (30) consecutive days of government-mandated inaccessibility or total facility casualty.',
    precedingText: '14.0 Casualty Events. In the event of minor physical damage not rendering premises uninhabitable, landlord shall repair promptly...',
    subsequentText: '14.2 Termination on Destruction. If damage exceeds fifty percent (50%) of value, either party may terminate upon written notice...'
  },
  {
    id: 'sec-3-1',
    name: '§ 3.1 Annual Escalation Cap',
    risk: 'STANDARD',
    page: 5,
    totalPages: 32,
    sectionNumber: '3.1',
    articleTitle: 'ARTICLE III — BASE FEES & ANNUAL ADJUSTMENTS',
    verbatim:
      'Base rent shall increase annually on each lease anniversary by the lesser of 3.0% or the CPI-U index for the regional metropolitan statistical area.',
    query: 'What is the annual rent escalation ceiling formula?',
    answer:
      'Annual escalation is strictly capped at the lesser of 3.0% or CPI-U regional inflation, adhering to institutional market standards.',
    remedy: 'Clause complies with standard commercial benchmarks. No counter-language required.',
    precedingText: '3.0 Initial Consideration. On the Commencement Date, Tenant shall tender the initial deposit and first monthly installment...',
    subsequentText: '3.2 Late Charges. Past due balances after the grace period of five (5) days accrue interest at one percent (1%) per month...'
  },
];

function InteractiveAuditShowcase() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const clause = SHOWCASE_CLAUSES[activeIdx];

  const handleCopy = () => {
    navigator.clipboard.writeText(clause.remedy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-6xl mx-auto mt-12 text-left"
    >
      {/* Outer Studio App Frame (Strict Obsidian & Espresso) */}
      <div className="rounded-3xl border border-[#F27A52]/25 shadow-2xl shadow-[#330F04]/80 overflow-hidden bg-[#0C0806] backdrop-blur-2xl relative">
        {/* Real Workspace Top Bar (Header Bar) */}
        <div className="px-5 py-3 border-b border-[#F27A52]/15 bg-[#120D0A]/95 flex items-center justify-between flex-wrap gap-3 z-10">
          <div className="flex items-center gap-3 min-w-0">
            {/* Folder icon: Back to Contracts Library */}
            <div
              title="Contracts Library"
              className="w-8 h-8 rounded-xl bg-[#1A120D] border border-[#F27A52]/20 flex items-center justify-center text-[#FFAF8E] shrink-0 shadow-sm"
            >
              <FileText size={15} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-[#FFFDF9] truncate">
                  Audit – Master Services Agreement
                </h2>
                <span className="text-[10px] font-mono text-[#F27A52] bg-[#F27A52]/10 border border-[#F27A52]/25 px-1.5 py-0.2 rounded">
                  Active Audit
                </span>
              </div>
              <p className="text-[11px] text-[#A0785D] font-mono truncate">
                Master_Services_Agreement_2026.pdf
              </p>
            </div>
          </div>

          {/* Action buttons mirroring Workspace (View PDF + Export PDF) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-[#FFFDF9] bg-[#F27A52]/20 border border-[#F27A52]/35 px-3 py-1.5 rounded-xl font-medium shadow-sm">
              <Eye size={13} className="text-[#FFAF8E]" />
              <span className="hidden sm:inline">Synchronized PDF Split-View</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#F27A52] animate-pulse ml-0.5" />
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-[#C7A78E] hover:text-[#FFFDF9] bg-[#1A120D] hover:bg-[#251B13] border border-[#F27A52]/20 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              {copied ? <Check size={13} className="text-[#FFAF8E]" /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copied ? 'Remedy Copied' : 'Copy Remedy'}</span>
            </button>
          </div>
        </div>

        {/* Real Split-View: Left (ChatPanel) + Right (PdfModalViewer Side Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[500px]">
          {/* ── LEFT COLUMN: Chat Stream & Autonomous Report (7 cols) ── */}
          <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-[#F27A52]/15 bg-[#080504] flex flex-col justify-between gap-4 overflow-hidden">
            {/* Scrollable Chat Area */}
            <div className="flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Natural Audit Report Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#F27A52]/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F27A52] animate-pulse" />
                  <span className="text-xs font-semibold text-[#FFAF8E] uppercase tracking-wider">
                    Autonomous Contract Audit
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {SHOWCASE_CLAUSES.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveIdx(i)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        activeIdx === i
                          ? 'bg-[#F27A52]/25 text-[#FFFDF9] border-[#F27A52]/50 font-bold'
                          : 'bg-[#17100B] text-[#A0785D] border-[#F27A52]/10 hover:text-[#C7A78E]'
                      }`}
                    >
                      {c.sectionNumber}
                    </button>
                  ))}
                </div>
              </div>

              {/* Natural Prose Audit Output */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-[#FFFDF9] flex items-center gap-1.5">
                    <AlertTriangle size={13} className={clause.risk === 'HIGH RISK' ? 'text-[#D95D34]' : 'text-[#F59E0B]'} />
                    <span>{clause.name}</span>
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    clause.risk === 'HIGH RISK'
                      ? 'bg-[#B8431C]/20 text-[#FFAF8E] border-[#B8431C]/40'
                      : clause.risk === 'MEDIUM RISK'
                      ? 'bg-[#D95D34]/20 text-[#FFD2BC] border-[#D95D34]/40'
                      : 'bg-[#785740]/25 text-[#E6D4C5] border-[#785740]/40'
                  }`}>
                    {clause.risk}
                  </span>
                </div>

                {/* Verbatim Excerpt Code Block (identical to ChatPanel.tsx text block) */}
                <div className="rounded-xl overflow-hidden border border-[#F27A52]/20 bg-[#120D0A]">
                  <div className="flex items-center justify-between px-3 py-1 bg-[#1A120D] border-b border-[#F27A52]/10 text-[10px] font-mono text-[#A0785D]">
                    <span>Verbatim Document Excerpt</span>
                    <span className="text-[#FFAF8E]">Page {clause.page}</span>
                  </div>
                  <pre className="p-3 text-[11px] font-mono text-[#E6D4C5] whitespace-pre-wrap leading-relaxed">
                    "{clause.verbatim}"
                  </pre>
                </div>

                <div className="text-xs text-[#C7A78E] leading-relaxed">
                  <strong className="text-[#FFFDF9]">Counsel Risk Assessment:</strong> {clause.answer}
                </div>
              </div>

              {/* User Question Message Bubble (identical to ChatPanel User Bubble) */}
              <div className="w-full flex flex-col items-end my-1">
                <div className="max-w-[88%] bg-[#1A120D] border border-[#F27A52]/20 text-[#FFFDF9] rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-md">
                  <p className="text-xs font-normal leading-relaxed">
                    {clause.query}
                  </p>
                </div>
              </div>

              {/* Assistant Message with Interactive Inline Citation Pill */}
              <div className="w-full flex flex-col gap-1.5 py-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#F27A52]" />
                  <span className="text-[11px] font-semibold text-[#FFAF8E]">LexiAudit AI</span>
                </div>

                <div className="text-xs text-[#E6D4C5] leading-relaxed pl-3.5 border-l-2 border-[#F27A52]/30">
                  <span>{clause.answer} Referenced in </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F27A52]/15 hover:bg-[#F27A52]/30 text-[#FFAF8E] border border-[#F27A52]/30 font-mono text-[11px] font-semibold transition-all cursor-pointer align-middle"
                  >
                    <FileSearch size={10} className="text-[#F27A52]" />
                    <span>[Section {clause.sectionNumber}, Page {clause.page}]</span>
                  </button>
                  <p className="mt-1 text-[#A0785D] text-[11px]">
                    <strong className="text-[#FFAF8E]">Remedy Recommendation:</strong> {clause.remedy}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Query Input Box (identical to ChatPanel.tsx input bar) */}
            <div className="pt-2 border-t border-[#F27A52]/15">
              <div className="rounded-xl border border-[#F27A52]/30 bg-[#140D0A] px-3 py-2 flex items-center justify-between gap-3 shadow-inner">
                <span className="text-xs text-[#755541] truncate font-sans">
                  Ask about terms, liabilities, or remedies…
                </span>
                <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-[#F27A52] to-[#D95D34] flex items-center justify-center text-[#080504] shadow-md shrink-0">
                  <ArrowRight size={13} />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Synchronized Dynamic PDF Viewer (5 cols) ── */}
          <div className="lg:col-span-5 p-5 bg-[#100B08] flex flex-col justify-between gap-3.5 relative overflow-hidden">
            {/* PDF Viewer Top Controls (Page indicator, Zoom, Viewer Status) */}
            <div className="flex items-center justify-between pb-2 border-b border-[#F27A52]/15 text-[#A0785D] text-xs">
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#C7A78E]">
                <FileSearch size={12} className="text-[#F27A52]" />
                <span>Page {clause.page} of {clause.totalPages}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#FFAF8E] bg-[#F27A52]/10 border border-[#F27A52]/20 px-2 py-0.5 rounded">
                  100% Zoom
                </span>
                <span className="text-[10px] font-bold text-[#FFAF8E] bg-[#1A120D] border border-[#F27A52]/25 px-2 py-0.5 rounded">
                  Synchronized
                </span>
              </div>
            </div>

            {/* Simulated Contract PDF Sheet on Canvas */}
            <div className="flex-1 rounded-2xl bg-[#080504] border border-[#F27A52]/20 p-4 font-mono text-left flex flex-col gap-3 shadow-inner relative overflow-hidden">
              {/* Document Header watermark on PDF */}
              <div className="flex items-center justify-between text-[9px] text-[#543D2E] uppercase tracking-widest border-b border-[#251B13] pb-1.5 font-sans">
                <span>CONFIDENTIAL & PROPRIETARY</span>
                <span>PAGE {clause.page}</span>
              </div>

              <div className="text-[10px] font-bold text-[#A0785D] font-sans">
                {clause.articleTitle}
              </div>

              {/* Preceding text on PDF page */}
              <p className="text-[10px] text-[#543D2E] leading-relaxed line-clamp-2">
                {clause.precedingText}
              </p>

              {/* ACTIVE HIGHLIGHTED BOUNDING BOX (Simulating canvas bbox highlight in PdfModalViewer) */}
              <div className="rounded-xl border-2 border-[#F27A52] bg-[#F27A52]/15 p-3 shadow-lg shadow-[#F27A52]/15 relative animate-pulse-slow">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold font-mono text-[#080504] bg-[#FFAF8E] px-1.5 py-0.2 rounded">
                    📍 EVIDENCE ANCHOR · § {clause.sectionNumber}
                  </span>
                  <span className="text-[9px] font-mono text-[#FFAF8E]">
                    Coords: [p.{clause.page}, 140, 520]
                  </span>
                </div>
                <p className="text-[11px] font-bold text-[#FFFDF9] leading-relaxed">
                  "{clause.verbatim}"
                </p>
              </div>

              {/* Subsequent text on PDF page */}
              <p className="text-[10px] text-[#543D2E] leading-relaxed line-clamp-2">
                {clause.subsequentText}
              </p>

              {/* Verified Traversal Footnote */}
              <div className="mt-auto pt-2 border-t border-[#251B13] flex items-center justify-between text-[9px] text-[#755541] font-sans">
                <span>Deterministic Tree Pointer</span>
                <span className="text-[#FFAF8E] font-mono">Zero Semantic Drift</span>
              </div>
            </div>

            {/* Bottom Citation Switcher Instruction */}
            <div className="flex items-center justify-between text-[11px] text-[#A0785D] pt-1">
              <span>Select any clause to inspect:</span>
              <div className="flex items-center gap-1">
                {SHOWCASE_CLAUSES.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveIdx(i)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer ${
                      activeIdx === i
                        ? 'bg-[#F27A52] text-[#080504] font-bold'
                        : 'bg-[#1A120D] text-[#C7A78E] hover:text-[#FFFDF9]'
                    }`}
                  >
                    § {c.sectionNumber}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}



export default function Landing() {
  const coreCapabilities = [
    {
      icon: GitBranch,
      title: 'Hierarchical Tree Parsing',
      desc: 'Transforms raw contracts into navigable structural trees of articles, clauses, and sub-clauses — eliminating chunk loss.',
    },
    {
      icon: Shield,
      title: 'Autonomous Risk Audit',
      desc: 'Evaluates exposure with HIGH, MEDIUM, and LOW ratings on uncapped liabilities, unilateral indemnities, and termination terms.',
    },
    {
      icon: Search,
      title: 'Missing Safeguard Detection',
      desc: 'Detects absent standard boilerplate clauses (e.g. mutual indemnity, audit rights) and suggests court-tested remedies.',
    },
    {
      icon: FileSearch,
      title: 'Pinpoint Page Citations',
      desc: 'Clickable citation pills jump directly to exact clause coordinates and page numbers in the synchronized PDF viewer.',
    },
    {
      icon: Zap,
      title: 'Vectorless Grounded RAG',
      desc: 'Deterministic traversal across document hierarchy delivers verifiable reasoning traces with zero halftone hallucination.',
    },
    {
      icon: FileText,
      title: 'Executive PDF Dossier Export',
      desc: 'Generates polished audit dossiers summarizing severity findings, verbatim evidence, and recommendations for counsel.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#080504] text-[#FFFDF9] overflow-x-hidden font-sans select-none">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-[#F27A52]/15 bg-[#080504]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFAF8E] to-[#B8431C] flex items-center justify-center shadow-md shadow-[#330F04]/80">
              <Scale size={16} className="text-[#080504]" />
            </div>
            <span className="font-display font-bold text-lg tracking-wide text-[#FFFDF9]">
              LexiAudit <span className="text-[#F27A52] text-sm font-sans font-medium">AI</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="text-xs sm:text-sm font-bold bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] px-4 sm:px-5 py-2 rounded-xl transition-all shadow-md shadow-[#330F04]/60 flex items-center gap-1.5 cursor-pointer hover:scale-105"
            >
              <span>Sign In</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-28 pb-20 px-6">
        {/* Subtle Warm Background Glow Canvas */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <HeroScene />
        </div>

        {/* Cohesive Ambient Glow Blooms */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(242, 122, 82, 0.22) 0%, rgba(184, 67, 28, 0.08) 45%, transparent 75%)',
          }}
        />

        {/* Central Hero Heading */}
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F27A52]/10 border border-[#F27A52]/25 text-[#FFAF8E] text-xs font-semibold uppercase tracking-wider mb-6"
          >
            <Sparkles size={13} className="text-[#F27A52]" />
            <span>Autonomous Legal Contract Intelligence</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold leading-tight tracking-tight mb-5 text-[#FFFDF9]"
          >
            Audit Complex Contracts <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD2BC] via-[#FFAF8E] to-[#F27A52]">
              with Surgical Precision
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-sm sm:text-base text-[#C7A78E] max-w-2xl mx-auto mb-8 leading-relaxed font-sans"
          >
            Extract risk scoring matrices, identify missing protections, and query agreements with verifiable tree citations linked straight to the PDF.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-6"
          >
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] font-bold px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-[#330F04]/80 hover:scale-105 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Enter Workspace</span>
              <ArrowRight size={16} />
            </Link>
            <a
              href="#capabilities"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-semibold text-[#E6D4C5] hover:text-[#FFFDF9] bg-[#1A120D]/80 border border-[#F27A52]/20 hover:border-[#F27A52]/40 transition-all cursor-pointer"
            >
              <span>View Capabilities</span>
              <ChevronRight size={15} />
            </a>
          </motion.div>
        </div>

        {/* Live Interactive Workspace Preview Showcase */}
        <InteractiveAuditShowcase />
      </section>

      {/* ── Capabilities Section ─────────────────────────────────────────── */}
      <section id="capabilities" className="relative py-24 px-6 bg-[#080504]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.p
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-[#F27A52] text-xs font-bold uppercase tracking-widest mb-2"
            >
              Engineered for Precision
            </motion.p>
            <motion.h2
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl font-display font-bold text-[#FFFDF9]"
            >
              Core Platform Capabilities
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {coreCapabilities.map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-2xl bg-gradient-to-b from-[#17100B]/90 to-[#100B08]/95 border border-[#F27A52]/20 hover:border-[#F27A52]/45 transition-all duration-200 shadow-xl shadow-black/50 group flex flex-col gap-3"
              >
                <div className="w-11 h-11 rounded-xl bg-[#F27A52]/10 border border-[#F27A52]/25 flex items-center justify-center text-[#FFAF8E] group-hover:scale-105 transition-transform">
                  <item.icon size={20} />
                </div>
                <h3 className="text-sm font-bold text-[#FFFDF9] group-hover:text-[#FFD2BC] transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-[#A0785D] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow Pipeline ────────────────────────────────────────────── */}
      <section className="relative py-20 px-6 border-t border-[#F27A52]/10 bg-[#0C0806]">
        <div className="max-w-5xl mx-auto text-center">
          <motion.h2
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="text-3xl font-display font-bold text-[#FFFDF9] mb-12"
          >
            Deterministic Audit Pipeline
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E] font-mono font-bold text-sm shadow-lg shadow-[#330F04]/50">
                01
              </div>
              <h3 className="font-bold text-[#FFFDF9] text-sm">Hierarchical Parsing</h3>
              <p className="text-xs text-[#A0785D] max-w-xs leading-relaxed">
                Ingests agreements into structured section trees preserving complete semantic context.
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E] font-mono font-bold text-sm shadow-lg shadow-[#330F04]/50">
                02
              </div>
              <h3 className="font-bold text-[#FFFDF9] text-sm">Exposure Auditing</h3>
              <p className="text-xs text-[#A0785D] max-w-xs leading-relaxed">
                Evaluates clauses for risk severity and automatically generates counter-language remedies.
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E] font-mono font-bold text-sm shadow-lg shadow-[#330F04]/50">
                03
              </div>
              <h3 className="font-bold text-[#FFFDF9] text-sm">Grounded Q&A</h3>
              <p className="text-xs text-[#A0785D] max-w-xs leading-relaxed">
                Answers specific questions with clickable page citations directly in the synchronized PDF viewer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ready Call To Action ─────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center p-10 rounded-3xl bg-gradient-to-b from-[#1A120D] to-[#100B08] border border-[#F27A52]/30 shadow-2xl shadow-[#330F04]/60"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center mx-auto mb-4 text-[#FFAF8E] shadow-md shadow-[#330F04]/50">
            <Scale size={24} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#FFFDF9] mb-2">
            Begin Your Contract Audit
          </h2>
          <p className="text-xs sm:text-sm text-[#A0785D] mb-6 max-w-md mx-auto leading-relaxed">
            Upload agreements in seconds to explore structured clause audits and verifiable evidence.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] font-bold px-7 py-3 rounded-xl transition-all shadow-xl shadow-[#330F04]/80 hover:scale-105 cursor-pointer text-xs sm:text-sm"
          >
            <span>Open Workspace</span>
            <ArrowRight size={15} />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#F27A52]/15 py-6 px-6 bg-[#080504]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#A0785D] text-xs font-semibold">
            <Scale size={15} className="text-[#F27A52]" />
            <span>LexiAudit AI — Vectorless Legal Intelligence</span>
          </div>
          <p className="text-[#755541] text-xs font-mono">Secure Client Storage · Verified Citations</p>
        </div>
      </footer>
    </div>
  );
}
