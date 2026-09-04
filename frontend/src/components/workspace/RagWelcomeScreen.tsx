import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Upload, ShieldCheck, Scale, Search, Stamp,
  ArrowRight, CheckCircle2, AlertTriangle, FileSearch
} from 'lucide-react';
import useWorkspaceStore, { type Document } from '../../store/workspaceStore';
import useAuthStore from '../../store/authStore';
import { uploadDocument, createSession } from '../../api/client';

const PROCESSING_STAGES = [
  { label: 'Ingesting contract PDF to isolated storage…', icon: Upload },
  { label: 'Parsing hierarchical section tree structure…', icon: Search },
  { label: 'Auditing liability risks & missing protections…', icon: Scale },
  { label: 'Synthesizing tree citations & preparing RAG workspace…', icon: Stamp },
];

export default function RagWelcomeScreen() {
  const {
    addDocument,
    setSelectedDoc,
    addSession,
    setSelectedSessionId,
    setMessages,
    setCurrentView,
    isBackendOnline
  } = useWorkspaceStore();
  const { user } = useAuthStore();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [stageIndex, setStageIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Extract user first name / display name cleanly
  const rawName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.custom_claims?.name ||
    (user?.email ? user.email.split('@')[0] : 'Counsel');
  const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // Direct drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles[0]) {
      handleDirectUpload(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: !isBackendOnline,
    noClick: !isBackendOnline
  });

  const handleDirectUpload = async (file: File) => {
    if (!isBackendOnline) {
      setErrorMessage('Backend engine is currently connecting/spinning up. Please wait a moment for connection.');
      return;
    }

    setSelectedFile(file);
    setUploadStatus('processing');
    setStageIndex(0);
    setErrorMessage('');

    const interval = setInterval(() => {
      setStageIndex((idx) => Math.min(idx + 1, PROCESSING_STAGES.length - 1));
    }, 2400);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadDocument(formData);
      clearInterval(interval);
      setStageIndex(PROCESSING_STAGES.length - 1);

      const doc = res.data;
      const newDoc: Document = {
        id: doc.doc_id,
        filename: doc.filename,
        created_at: new Date().toISOString(),
        risk_analysis: doc.risk_analysis || [],
        missing_clauses: doc.missing_clauses || [],
        suggested_queries: doc.suggested_queries || [],
        tree_index: doc.tree_index || [],
      };

      addDocument(newDoc);
      setSelectedDoc(newDoc);

      // Auto-create initial session and switch directly into chat
      try {
        const baseName = doc.filename.replace(/\.pdf$/i, '').slice(0, 20);
        const sessRes = await createSession(doc.doc_id, `Audit – ${baseName}`);
        addSession(sessRes.data);
        setSelectedSessionId(sessRes.data.id);
        setMessages([]);
      } catch (sessErr) {
        console.error('Session create error:', sessErr);
      }

      setUploadStatus('done');
      setTimeout(() => {
        setCurrentView('chat');
      }, 600);
    } catch (err: any) {
      clearInterval(interval);
      console.error('Direct upload failed:', err);
      setErrorMessage(err.message || 'Audit failed. Please verify that your document is a valid PDF.');
      setUploadStatus('error');
    }
  };

  const CurrentProcessingIcon = PROCESSING_STAGES[stageIndex]?.icon || Scale;

  return (
    <div className="flex-1 h-full w-full bg-[#080504] text-slate-100 flex flex-col justify-center items-center px-6 py-6 overflow-hidden relative select-none">
      {/* ── Cohesive Warm Espresso & Radiant Orange Ambient Blooms ── */}
      <div className="absolute top-[-15%] left-[25%] w-[550px] h-[340px] bg-gradient-to-b from-[#F27A52]/18 via-[#B8431C]/10 to-transparent blur-[140px] pointer-events-none -z-10 rounded-full" />
      <div className="absolute bottom-[-15%] right-[20%] w-[500px] h-[320px] bg-gradient-to-t from-[#D95D34]/15 via-[#8E2F10]/10 to-transparent blur-[150px] pointer-events-none -z-10 rounded-full" />

      {/* Subtle fine geometric grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #F27A52 1px, transparent 0)',
          backgroundSize: '28px 28px'
        }}
      />

      {/* ── Compact Main Container (Guaranteed No-Scroll) ── */}
      <div className="w-full max-w-3xl flex flex-col items-center justify-center gap-6 z-10">
        {/* Crisp Header: Only Welcome, {userName} */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="text-center"
        >
          {!isBackendOnline && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-3 rounded-full bg-[#1A120D] border border-[#F27A52]/30 text-xs font-mono text-[#FFAF8E] shadow-lg shadow-black/40 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#F27A52] animate-ping" />
              <span>Connecting to Backend Core…</span>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-[#FFFDF9] leading-tight">
            Welcome,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD2BC] via-[#FFAF8E] to-[#F27A52]">
              {userName}
            </span>
          </h1>
        </motion.div>

        {/* ── Crisp Upload Box Element ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="w-full"
        >
          <div
            {...getRootProps()}
            className={`w-full py-8 px-8 rounded-3xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden group shadow-2xl ${
              isDragActive
                ? 'border-[#FFAF8E] bg-[#F27A52]/15 shadow-[#330F04] scale-[1.01]'
                : 'border-[#F27A52]/30 hover:border-[#F27A52]/60 bg-gradient-to-b from-[#18110D]/90 to-[#100B08]/95 hover:from-[#1E1510]/95 hover:to-[#140D0A]/95 shadow-black/80 backdrop-blur-xl'
            }`}
          >
            <input {...getInputProps()} />

            {/* Glowing animated halo in orange/peach */}
            <div className="relative mb-3.5">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#F27A52]/35 via-[#D95D34]/25 to-[#B8431C]/35 blur-lg opacity-75 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2B1F17] to-[#120C08] border border-[#F27A52]/40 flex items-center justify-center text-[#FFAF8E] shadow-md group-hover:scale-105 transition-transform">
                <Upload size={24} className="group-hover:text-[#FFFDF9] transition-colors" />
              </div>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#FFFDF9] mb-1">
              {isDragActive ? 'Drop your contract PDF right here…' : 'Drop your contract PDF here to start audit'}
            </h3>

            <p className="text-xs text-[#A0785D] max-w-md mx-auto mb-4 leading-relaxed font-sans">
              Click below to select a file.
            </p>

            <button
              type="button"
              className="flex items-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-[#330F04]/80 transition-all hover:scale-105 pointer-events-none"
            >
              <Upload size={15} />
              <span>Browse Contract PDF</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>

        {/* ── Three Cohesive Modern Feature Cards (Black, Warm Wood, Orange/Peach/Amber) ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {/* Card 1: Deterministic Citations */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-b from-[#1A120D]/90 to-[#100B08]/95 border border-[#F27A52]/25 hover:border-[#F27A52]/50 transition-all duration-200 shadow-xl shadow-black/50 hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E] group-hover:scale-110 transition-transform">
                <FileSearch size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#FFAF8E] bg-[#F27A52]/10 px-2 py-0.5 rounded-md border border-[#F27A52]/25">
                VERIFIABLE
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#FFFDF9] group-hover:text-[#FFD2BC] transition-colors mb-1">
              Pinpoint PDF Citations
            </h4>
            <p className="text-[11px] text-[#A0785D] leading-relaxed">
              Every audit answer links directly to the verified page and clause in the document viewer.
            </p>
          </div>

          {/* Card 2: Risk Scoring Matrix */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-b from-[#1A120D]/90 to-[#100B08]/95 border border-[#D95D34]/30 hover:border-[#D95D34]/60 transition-all duration-200 shadow-xl shadow-black/50 hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#D95D34]/15 border border-[#D95D34]/30 flex items-center justify-center text-[#F27A52] group-hover:scale-110 transition-transform">
                <Scale size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#FFD2BC] bg-[#D95D34]/15 px-2 py-0.5 rounded-md border border-[#D95D34]/25">
                SEVERITY MATRIX
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#FFFDF9] group-hover:text-[#FFD2BC] transition-colors mb-1">
              Autonomous Risk Audit
            </h4>
            <p className="text-[11px] text-[#A0785D] leading-relaxed">
              Surfaces uncapped liabilities, unilateral indemnities, and termination pitfalls.
            </p>
          </div>

          {/* Card 3: Missing Boilerplate Safeguards */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-b from-[#1A120D]/90 to-[#100B08]/95 border border-[#B8431C]/25 hover:border-[#B8431C]/50 transition-all duration-200 shadow-xl shadow-black/50 hover:-translate-y-0.5 group">
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#B8431C]/15 border border-[#B8431C]/30 flex items-center justify-center text-[#FFAF8E] group-hover:scale-110 transition-transform">
                <ShieldCheck size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#FFAF8E] bg-[#B8431C]/10 px-2 py-0.5 rounded-md border border-[#B8431C]/25">
                GAP ANALYSIS
              </span>
            </div>
            <h4 className="text-xs font-bold text-[#FFFDF9] group-hover:text-[#FFD2BC] transition-colors mb-1">
              Protective Safeguards
            </h4>
            <p className="text-[11px] text-[#A0785D] leading-relaxed">
              Identifies absent standard protections and suggests counter-language remedies.
            </p>
          </div>
        </motion.div>
      </div>

      {/* ── Processing Overlay Modal (when drag-and-drop occurs on welcome screen) ── */}
      <AnimatePresence>
        {uploadStatus === 'processing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md p-7 rounded-3xl bg-[#120D0A] border border-peach-500/30 shadow-2xl shadow-peach-950/90 text-center flex flex-col items-center"
            >
              <div className="relative w-14 h-14 mb-4">
                <div className="absolute inset-0 rounded-2xl bg-peach-500/20 animate-ping" />
                <div className="relative w-full h-full rounded-2xl bg-peach-500/20 border border-peach-500/40 flex items-center justify-center text-peach-300">
                  <CurrentProcessingIcon size={24} className="animate-pulse" />
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-100 mb-1">
                Auditing {selectedFile?.name || 'Contract PDF'}
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                Executing autonomous hierarchical legal audit…
              </p>

              {/* Progress Steps */}
              <div className="w-full flex flex-col gap-2 text-left">
                {PROCESSING_STAGES.map((s, idx) => {
                  const isDone = idx < stageIndex;
                  const isCurrent = idx === stageIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                        isCurrent
                          ? 'bg-peach-500/15 border border-peach-500/30 text-peach-200'
                          : isDone
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-peach-400 border-t-transparent animate-spin shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                      )}
                      <span className="truncate">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error notification banner if upload failed */}
      {uploadStatus === 'error' && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl bg-red-950/90 border border-red-500/30 text-red-200 shadow-2xl flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold">Upload Failed</p>
            <p className="text-[11px] text-red-300 mt-0.5">{errorMessage}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {selectedFile && (
              <button
                onClick={() => handleDirectUpload(selectedFile)}
                className="px-2.5 py-1 bg-[#F27A52] hover:bg-[#D95D34] text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => setUploadStatus('idle')}
              className="text-xs text-red-400 hover:text-red-200 cursor-pointer font-bold px-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

