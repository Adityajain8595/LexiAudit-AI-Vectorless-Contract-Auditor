import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Scale,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  Activity,
  FileSearch,
  Lock,
  GitBranch,
  CheckCircle2,
  Cpu,
  Database,
  Server
} from 'lucide-react';
import HeroScene from '../components/landing/HeroScene';

// Platform technology specifications (core 7 engines)
const TECH_STACK = [
  {
    id: 'groq',
    name: 'Groq LPU™ Silicon',
    role: 'Sub-second legal reasoning, query rewriting, and structured Pydantic schema coercion on dedicated LPU silicon.',
    icon: Cpu,
  },
  {
    id: 'pageindex',
    name: 'PageIndex AST',
    role: 'Hierarchical document tree parsing that eliminates vector embeddings and preserves exact clause boundaries.',
    icon: GitBranch,
  },
  {
    id: 'redis',
    name: 'Upstash Redis',
    role: 'Pre-warmed low-latency caching with encrypted tree persistence and multi-tenant key isolation.',
    icon: Database,
  },
  {
    id: 'langfuse',
    name: 'Langfuse Cloud',
    role: 'Distributed OpenTelemetry tracing, prompt versioning, and automated 4-metric LLM-as-a-judge scoring.',
    icon: Activity,
  },
  {
    id: 'supabase',
    name: 'Supabase Cloud',
    role: 'Transactional PostgreSQL persistence, strict row-level security (RLS), and private contract object storage.',
    icon: Server,
  },
  {
    id: 'pdfjs',
    name: 'Mozilla PDF.js',
    role: 'Client-side vector canvas engine synchronizing AST citations directly to verbatim PDF bounding boxes.',
    icon: FileSearch,
  },
  {
    id: 'fastapi',
    name: 'FastAPI Async',
    role: 'High-throughput asynchronous API runtime handling non-blocking coroutines and streaming SSE responses.',
    icon: Zap,
  },
];

// Tabular tech card component uniformly styled in blue
function TechChipCard({ tech }: { tech: typeof TECH_STACK[0] }) {
  const Icon = tech.icon;

  return (
    <div className="w-[230px] sm:w-[250px] shrink-0 p-4 rounded-2xl border border-[#0284C7]/30 bg-[#07131D]/90 hover:bg-[#0A1A27] hover:border-[#38BDF8]/65 backdrop-blur-xl transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-[#0284C7]/20 flex flex-col justify-between gap-3 select-none">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-xl border border-[#38BDF8]/35 bg-[#0284C7]/15 text-[#38BDF8] shrink-0">
          <Icon size={16} />
        </div>
        <h4 className="text-sm font-bold text-[#FFFDF9] truncate">
          {tech.name}
        </h4>
      </div>

      <p className="text-xs text-[#93C5FD]/85 leading-relaxed font-sans">
        {tech.role}
      </p>
    </div>
  );
}

// Continuous Right-to-Left Sliding Technology Showcase in Fixed Width Space
function TechnologyArchitectureShowcase() {
  const marqueeItems = [...TECH_STACK, ...TECH_STACK, ...TECH_STACK];

  return (
    <div className="w-full max-w-5xl mx-auto mt-10 mb-6 relative marquee-container">
      {/* Single Line Sliding Right to Left in Fixed Width Space */}
      <div className="relative w-full overflow-hidden py-2">
        {/* Feathered gradient fade masks for smooth entry and exit */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-r from-[#080504] via-[#080504]/90 to-transparent z-20" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 sm:w-28 bg-gradient-to-l from-[#080504] via-[#080504]/90 to-transparent z-20" />

        {/* Single continuous lane sliding right to left */}
        <div className="animate-marquee-rtl gap-3 sm:gap-4 py-1">
          {marqueeItems.map((tech, idx) => (
            <TechChipCard key={`stream-${tech.id}-${idx}`} tech={tech} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const coreCapabilities = [
    {
      icon: GitBranch,
      title: 'Vectorless AST Hierarchical Parsing',
      desc: 'Transforms raw contracts into navigable structural trees of articles, clauses, and sub-clauses, eliminating semantic chunk loss and vector boundary drift.',
      tag: 'AST Ingestion'
    },
    {
      icon: Shield,
      title: 'Deterministic Risk & Exposure Scoring',
      desc: 'Applies rigorous legal rubrics to classify clauses with HIGH, MEDIUM, and LOW risk ratings across uncapped liabilities, unilateral indemnities, and termination terms.',
      tag: 'Risk Analysis'
    },
    {
      icon: Lock,
      title: 'Missing Safeguard Detection & Redlines',
      desc: 'Identifies missing standard boilerplate clauses (e.g. data protection addenda, mutual indemnity, audit rights) and formulates institutional counter-language.',
      tag: 'Gap Detection'
    },
    {
      icon: FileSearch,
      title: 'Verbatim Coordinate Citation Anchors',
      desc: 'Every generated claim links to an exact physical PDF bounding box coordinate, jumping directly to verified text in the synchronized split-screen canvas viewer.',
      tag: 'PDF Highlighting'
    },
    {
      icon: Zap,
      title: 'Multi-Turn RAG with Self-Correction',
      desc: 'Features contextual query rewriting across conversation history and an autonomous self-correcting sweep loop that broadens retrieval across definitions and schedules.',
      tag: 'Groq LPU Engine'
    },
    {
      icon: Activity,
      title: 'Full-Lifecycle LLMOps & Evaluator',
      desc: 'Continuous OpenTelemetry observability recording latency distributions, token economics, and automated LLM-as-a-judge scoring across 4 evaluation metrics.',
      tag: 'Observability'
    },
  ];

  return (
    <div className="min-h-screen bg-[#080504] text-[#FFFDF9] overflow-x-hidden font-sans select-none">
      {/* ── Fixed Navigation Bar ────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#F27A52]/15 bg-[#080504]/85 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFAF8E] via-[#F27A52] to-[#B8431C] flex items-center justify-center shadow-md shadow-[#330F04]/80">
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
        {/* Dual-Tone Ambient 3D Depth Mesh (Warm Amber & Complementary Cyan) */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <HeroScene />
        </div>

        {/* Ambient Radial Gradient Mesh */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(242, 122, 82, 0.2) 0%, rgba(6, 182, 212, 0.08) 35%, rgba(184, 67, 28, 0.04) 60%, transparent 75%)',
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
            <Sparkles size={13} className="text-[#22D3EE]" />
            <span>Enterprise Vectorless Legal AI Engine</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-display font-bold leading-tight tracking-tight mb-5 text-[#FFFDF9]"
          >
            Vectorless Contract Auditing <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD2BC] via-[#FFAF8E] to-[#F27A52]">
              with Grounded Precision
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="text-sm sm:text-base text-[#C7A78E] max-w-3xl mx-auto mb-8 leading-relaxed font-sans"
          >
            Deterministic AST document tree indexing, sub-second Groq LPU™ inference, and verified verbatim PDF canvas coordinate citations. Zero vector drift, zero chunk truncation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.24 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-4"
          >
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] font-bold px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-[#330F04]/80 hover:scale-105 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Launch Auditor Workspace</span>
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>

        {/* Interactive Platform Technology Architecture Showcase */}
        <div id="tech-matrix" className="w-full">
          <TechnologyArchitectureShowcase />
        </div>
      </section>

      {/* ── Engineering Capabilities Section ──────────────────────────────── */}
      <section id="capabilities" className="relative py-24 px-6 bg-[#080504] border-t border-[#F27A52]/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[#06B6D4] text-xs font-mono font-bold uppercase tracking-widest mb-2">
              Enterprise Engineering Specs
            </p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-[#FFFDF9]">
              Core Architecture & Intelligence Capabilities
            </h2>
            <p className="text-xs sm:text-sm text-[#A0785D] max-w-xl mx-auto mt-2 font-mono">
              Engineered to replace probabilistic embeddings with deterministic AST document reasoning.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreCapabilities.map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-2xl bg-gradient-to-b from-[#140E0A]/90 to-[#0A0705]/95 border border-[#F27A52]/15 hover:border-[#06B6D4]/45 transition-all duration-200 shadow-xl shadow-black/60 group flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#F27A52]/10 border border-[#F27A52]/25 flex items-center justify-center text-[#FFAF8E] group-hover:text-[#22D3EE] group-hover:border-[#06B6D4]/40 transition-colors">
                      <item.icon size={19} />
                    </div>
                    <span className="text-[10px] font-mono text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/25 px-2 py-0.5 rounded">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#FFFDF9] group-hover:text-[#FFD2BC] transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-[#A0785D] leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#F27A52]/10 flex items-center justify-between text-[11px] font-mono text-[#755541]">
                  <span>Status: Operational</span>
                  <span className="text-[#22D3EE] flex items-center gap-1">
                    <CheckCircle2 size={11} /> Verified
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Deterministic Pipeline Architecture ────────────────────────────── */}
      <section className="relative py-20 px-6 border-t border-[#F27A52]/10 bg-[#0C0806]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[#F27A52] text-xs font-mono font-bold uppercase tracking-widest mb-2">
            Execution Flow
          </p>
          <h2 className="text-3xl font-display font-bold text-[#FFFDF9] mb-12">
            Deterministic Audit Pipeline
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            <div className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl bg-[#140E0A]/80 border border-[#F27A52]/15">
              <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E] font-mono font-bold text-sm shadow-lg shadow-[#330F04]/50">
                01
              </div>
              <h3 className="font-bold text-[#FFFDF9] text-sm">Recursive AST Parsing</h3>
              <p className="text-xs text-[#A0785D] max-w-xs leading-relaxed font-sans">
                Deconstructs contracts into hierarchical section trees, strips PII via deterministic regex, and pre-warms encrypted Redis caches.
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl bg-[#140E0A]/80 border border-[#06B6D4]/20">
              <div className="w-12 h-12 rounded-2xl bg-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center justify-center text-[#22D3EE] font-mono font-bold text-sm shadow-lg shadow-[#06B6D4]/20">
                02
              </div>
              <h3 className="font-bold text-[#FFFDF9] text-sm">LPU Exposure Auditing</h3>
              <p className="text-xs text-[#A0785D] max-w-xs leading-relaxed font-sans">
                Evaluates provisions against institutional risk rubrics on Groq LPU silicon, extracting exact verbatim quotes and counter-language remedies.
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl bg-[#140E0A]/80 border border-[#F27A52]/15">
              <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E] font-mono font-bold text-sm shadow-lg shadow-[#330F04]/50">
                03
              </div>
              <h3 className="font-bold text-[#FFFDF9] text-sm">Coordinate Grounded Q&A</h3>
              <p className="text-xs text-[#A0785D] max-w-xs leading-relaxed font-sans">
                Resolves user queries via query rewriting and self-correcting tree search, deep-linking citations to synchronized PDF canvas coordinates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Call To Action Section ────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center p-10 rounded-3xl bg-gradient-to-b from-[#17100B] to-[#0A0705] border border-[#F27A52]/25 shadow-2xl shadow-black/80">
          <div className="w-12 h-12 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center mx-auto mb-4 text-[#FFAF8E] shadow-md shadow-[#330F04]/50">
            <Scale size={24} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#FFFDF9] mb-2">
            Initiate Contract Compliance Audit
          </h2>
          <p className="text-xs sm:text-sm text-[#A0785D] mb-6 max-w-md mx-auto leading-relaxed">
            Upload institutional agreements to explore deterministic section trees, verifiable risk metrics, and sub-second reasoning.
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] font-bold px-7 py-3 rounded-xl transition-all shadow-xl shadow-[#330F04]/80 hover:scale-105 cursor-pointer text-xs sm:text-sm"
          >
            <span>Open Auditor Workspace</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#F27A52]/15 py-6 px-6 bg-[#080504]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#A0785D] text-xs font-semibold">
            <Scale size={15} className="text-[#F27A52]" />
            <span>LexiAudit AI — Enterprise Vectorless Legal Intelligence</span>
          </div>
          <p className="text-[#755541] text-xs font-mono">OpenTelemetry Traced · Groq LPU™ Powered · AES-256-GCM Encrypted</p>
        </div>
      </footer>
    </div>
  );
}
