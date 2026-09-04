import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, FileText, AlertCircle, Sparkles, ShieldCheck,
  Scale, Search, Stamp, CheckCircle2, ArrowRight
} from 'lucide-react';
import { uploadDocument, createSession } from '../../api/client';
import useWorkspaceStore from '../../store/workspaceStore';

const PROCESSING_STAGES = [
  { label: 'Ingesting contract PDF to isolated storage…', icon: Upload },
  { label: 'Parsing hierarchical section tree structure…', icon: Search },
  { label: 'Auditing liability risks & missing protections…', icon: Scale },
  { label: 'Synthesizing tree citations & preparing RAG workspace…', icon: Stamp },
];

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [stageIdx, setStageIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    addDocument, setSelectedDoc, addSession, setSelectedSessionId, setMessages, setCurrentView
  } = useWorkspaceStore();

  const handleUpload = async (targetFile?: File) => {
    const fileToUpload = targetFile || file;
    if (!fileToUpload || stage === 'uploading') return;

    setFile(fileToUpload);
    setStage('uploading');
    setStageIdx(0);
    setErrorMsg('');

    const interval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, PROCESSING_STAGES.length - 1));
    }, 2400);

    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const res = await uploadDocument(formData);
      clearInterval(interval);
      setStageIdx(PROCESSING_STAGES.length - 1);

      const doc = res.data;
      const newDoc = {
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

      // Auto-create initial session and switch directly to workspace chat
      try {
        const baseName = doc.filename.replace(/\.pdf$/i, '').slice(0, 20);
        const sessRes = await createSession(doc.doc_id, `Audit – ${baseName}`);
        addSession(sessRes.data);
        setSelectedSessionId(sessRes.data.id);
        setMessages([]);
      } catch (e) {
        console.error('Session create error:', e);
      }

      setStage('done');
      setTimeout(() => {
        setCurrentView('chat');
        onClose();
      }, 800);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg(err.message || 'Upload and audit failed. Please verify file is a valid PDF.');
      setStage('error');
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      handleUpload(accepted[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const CurrentProcessingIcon = PROCESSING_STAGES[stageIdx]?.icon || Scale;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl"
      onClick={(e) => e.target === e.currentTarget && stage === 'idle' && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md p-7 rounded-3xl bg-[#120D0A] border border-peach-500/30 shadow-2xl shadow-peach-950/90 text-center flex flex-col items-center relative overflow-hidden"
      >
        {/* Close Button (Idle only) */}
        {stage === 'idle' && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {/* Idle State: Drag & Drop */}
          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full">
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-[#F27A52]/15 border border-[#F27A52]/30 flex items-center justify-center text-[#FFAF8E]">
                  <Upload size={18} />
                </div>
                <div className="text-left">
                  <h2 className="text-base font-bold text-slate-100">Upload & Audit Contract</h2>
                  <p className="text-xs text-slate-400">Isolated Storage · Autonomous Tree Parsing</p>
                </div>
              </div>

              <div
                {...getRootProps()}
                className={`w-full py-8 px-6 rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center text-center cursor-pointer relative overflow-hidden group ${
                  isDragActive
                    ? 'border-[#FFAF8E] bg-[#F27A52]/15 scale-[0.99]'
                    : 'border-[#F27A52]/30 hover:border-[#F27A52]/60 bg-slate-900/60 hover:bg-slate-900/90'
                }`}
              >
                <input {...getInputProps()} />

                <div className="relative mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2B1F17] to-[#120C08] border border-[#F27A52]/40 flex items-center justify-center text-[#FFAF8E] shadow-md group-hover:scale-105 transition-transform mx-auto">
                    <Upload size={22} />
                  </div>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-200 mb-1">
                  {isDragActive ? 'Drop your contract PDF right here…' : 'Drag & drop contract PDF here to start audit'}
                </p>
                <p className="text-[11px] text-[#A0785D] mb-4">Click to browse local files</p>

                <button
                  type="button"
                  className="flex items-center gap-2 bg-gradient-to-r from-[#F27A52] to-[#D95D34] hover:from-[#FFAF8E] hover:to-[#F27A52] text-[#080504] font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-[#330F04]/80 transition-all pointer-events-none"
                >
                  <Upload size={14} />
                  <span>Browse Contract PDF</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Selected File Display if manual click browse */}
              {file && (
                <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-white/8 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#F27A52]/15 border border-[#F27A52]/25 flex items-center justify-center shrink-0 text-[#FFAF8E]">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpload()}
                    className="flex items-center gap-1 bg-[#F27A52] hover:bg-[#D95D34] text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>Audit Now</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Uploading / Processing State - Exact match to RagWelcomeScreen */}
          {stage === 'uploading' && (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full py-2">
              <div className="relative w-14 h-14 mb-4 mx-auto">
                <div className="absolute inset-0 rounded-2xl bg-peach-500/20 animate-ping" />
                <div className="relative w-full h-full rounded-2xl bg-peach-500/20 border border-peach-500/40 flex items-center justify-center text-peach-300">
                  <CurrentProcessingIcon size={24} className="animate-pulse" />
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-100 mb-1 truncate px-2">
                Auditing {file?.name || 'Contract PDF'}
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                Executing autonomous hierarchical legal audit…
              </p>

              {/* Progress Steps */}
              <div className="w-full flex flex-col gap-2 text-left">
                {PROCESSING_STAGES.map((s, idx) => {
                  const isDone = idx < stageIdx;
                  const isCurrent = idx === stageIdx;
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
          )}

          {/* Done State */}
          {stage === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center w-full">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 text-emerald-400">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-1">Contract Audited Successfully!</h3>
              <p className="text-xs text-slate-400">Opening interactive workspace and loading citations…</p>
            </motion.div>
          )}

          {/* Error State */}
          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center w-full">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3 text-red-400">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">Audit Generation Failed</h3>
              <p className="text-xs text-red-400/90 mb-5 max-w-sm mx-auto">{errorMsg}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleUpload()}
                  className="px-4 py-2 bg-[#F27A52] hover:bg-[#D95D34] text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-[#F27A52]/20"
                >
                  Retry Audit
                </button>
                <button
                  onClick={() => { setFile(null); setStage('idle'); }}
                  className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  Choose Different File
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
