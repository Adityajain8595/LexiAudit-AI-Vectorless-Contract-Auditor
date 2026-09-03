import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Zap, ShieldCheck, Sparkles, Lock, ArrowRight } from 'lucide-react';
import UploadModal from './UploadModal';

export default function UploadZone() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center justify-center gap-7 max-w-2xl mx-auto px-6 text-center select-none"
      >
        {/* Animated Icon cluster */}
        <div className="relative w-28 h-28">
          <div
            className="absolute inset-0 rounded-full bg-peach-500/10 animate-ping"
            style={{ animationDuration: '3.5s' }}
          />
          <div
            className="absolute inset-3 rounded-full bg-peach-500/15 animate-ping"
            style={{ animationDuration: '2.8s', animationDelay: '0.4s' }}
          />
          <div className="relative w-full h-full rounded-3xl glass-card glow-border flex items-center justify-center shadow-2xl shadow-peach-950/80">
            <ShieldCheck size={42} className="text-peach-400" />
          </div>
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-peach-500/10 border border-peach-500/20 text-peach-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles size={12} /> Autonomous Contract Auditor
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-100 mb-2.5">
            Audit Legal Contracts with Confidence
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
            Upload any legal agreement in PDF format. LexiAudit automatically parses clauses, assigns risk ratings, checks missing protections, and enables grounded natural language exploration.
          </p>
        </div>

        {/* Big CTA */}
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2.5 bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-400 hover:to-peach-500 text-slate-950 font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl shadow-peach-950/80 transition-all duration-200 hover:scale-105 cursor-pointer"
        >
          <Upload size={18} />
          <span>Upload Contract to Audit</span>
          <ArrowRight size={16} />
        </button>

        {/* Feature Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg mt-2">
          {[
            { icon: Zap, title: 'Instant Risk Matrix', desc: 'HIGH / MEDIUM / LOW severity' },
            { icon: FileText, title: 'Missing Protections', desc: 'Standard boilerplate gaps' },
            { icon: Lock, title: 'Vectorless Grounding', desc: 'Zero hallucination citations' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="glass p-3 rounded-2xl border border-white/5 text-left flex flex-col gap-1">
              <Icon size={16} className="text-peach-400 mb-1" />
              <p className="text-xs font-bold text-slate-200">{title}</p>
              <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {isUploadOpen && <UploadModal onClose={() => setIsUploadOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
