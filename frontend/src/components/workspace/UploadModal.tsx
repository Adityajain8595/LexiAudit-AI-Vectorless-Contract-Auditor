import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, AlertCircle, Sparkles, ShieldCheck, Scale, Search, Stamp } from 'lucide-react';
import { uploadDocument, createSession } from '../../api/client';
import useWorkspaceStore from '../../store/workspaceStore';

const STAGES = [
  { label: 'Uploading contract PDF to secure storage…', icon: Upload },
  { label: 'Parsing hierarchical section tree structure…', icon: Search },
  { label: 'Auditing liability risks & missing clauses…', icon: Scale },
  { label: 'Applying legal verification & synthesizing audit…', icon: Stamp },
];

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [stageIdx, setStageIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    addDocument, setSelectedDoc, addSession, setSelectedSessionId, setMessages, setCurrentView
  } = useWorkspaceStore();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file || stage !== 'idle') return;
    setStage('uploading');
    setStageIdx(0);

    const interval = setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, 2400);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await uploadDocument(formData);
      clearInterval(interval);
      setStageIdx(STAGES.length - 1);

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

      // Auto-create initial session and switch directly to chat
      try {
        const baseName = doc.filename.replace(/\.pdf$/i, '').slice(0, 20);
        const sessRes = await createSession(doc.doc_id, `Audit – ${baseName}`);
        addSession(sessRes.data);
        setSelectedSessionId(sessRes.data.id);
        setMessages([]);
      } catch (e) {
        console.error('Session create error:', e);
      }

      setCurrentView('chat');
      setStage('done');
      setTimeout(onClose, 1000);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg(err.message || 'Upload and audit failed. Please verify file is a valid PDF.');
      setStage('error');
    }
  };

  const CurrentIcon = STAGES[stageIdx]?.icon || Scale;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(12, 8, 6, 0.85)', backdropFilter: 'blur(16px)' }}
      onClick={(e) => e.target === e.currentTarget && stage === 'idle' && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-lg glass-strong rounded-3xl p-8 glow-border border-peach-500/30 shadow-2xl bg-slate-950/95"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-peach-500/10 border border-peach-500/25 flex items-center justify-center">
              <Upload size={18} className="text-peach-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Upload & Audit Contract</h2>
              <p className="text-xs text-slate-400 mt-0.5">Isolated Storage · Autonomous Tree Parsing</p>
            </div>
          </div>

          {stage === 'idle' && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Idle State: Drag & Drop */}
          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                {...getRootProps()}
                className={`relative rounded-2xl border-2 border-dashed p-9 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive
                    ? 'border-peach-400 bg-peach-500/10 scale-[0.99]'
                    : 'border-white/10 hover:border-peach-500/40 hover:bg-white/[0.02]'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-12 h-12 rounded-2xl bg-peach-500/10 border border-peach-500/20 flex items-center justify-center mx-auto mb-3">
                  <Upload size={22} className={isDragActive ? 'text-peach-300' : 'text-peach-400'} />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-200 mb-1">
                  {isDragActive ? 'Drop your contract PDF here' : 'Drag & drop contract PDF here'}
                </p>
                <p className="text-xs text-slate-500">or click to browse files</p>
              </div>

              {/* Selected File Display */}
              {file && (
                <div className="mt-4 p-3.5 rounded-2xl bg-slate-900/80 border border-white/8 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-peach-500/15 border border-peach-500/25 flex items-center justify-center shrink-0">
                      <FileText size={15} className="text-peach-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file}
                  className="flex items-center gap-2 bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-400 hover:to-peach-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg shadow-peach-950/60 transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Start Contract Audit</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Uploading / Processing State */}
          {stage === 'uploading' && (
            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-4">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-2xl bg-peach-500/10 border border-peach-500/30 animate-ping" style={{ animationDuration: '3s' }} />
                  <div className="relative w-14 h-14 rounded-2xl bg-peach-500/15 border border-peach-500/30 flex items-center justify-center">
                    <CurrentIcon size={26} className="text-peach-400 animate-pulse" />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-100 mb-1">
                    Auditing Contract Intelligence
                  </h3>
                  <p className="text-xs text-peach-300 font-medium h-5">
                    {STAGES[stageIdx]?.label}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-white/5 mt-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-peach-500 to-peach-400"
                    animate={{ width: `${((stageIdx + 1) / STAGES.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                {/* Stage Steps List */}
                <div className="w-full flex flex-col gap-2 mt-2 text-left">
                  {STAGES.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all ${
                        i === stageIdx
                          ? 'bg-peach-500/10 border border-peach-500/25 text-peach-300 font-semibold'
                          : i < stageIdx
                          ? 'text-slate-400'
                          : 'text-slate-600'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        i === stageIdx ? 'bg-peach-400 animate-pulse' : i < stageIdx ? 'bg-emerald-400' : 'bg-slate-700'
                      }`} />
                      <span className="truncate">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Done State */}
          {stage === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-100 mb-1">Contract Audited Successfully!</h3>
              <p className="text-xs text-slate-400">Loading audit matrix and opening workspace…</p>
            </motion.div>
          )}

          {/* Error State */}
          {stage === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">Audit Generation Failed</h3>
              <p className="text-xs text-red-400/90 mb-5 max-w-sm mx-auto">{errorMsg}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => file ? handleUpload() : setStage('idle')}
                  className="px-4 py-2 bg-[#F27A52] hover:bg-[#D95D34] text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-[#F27A52]/20"
                >
                  Retry Upload & Audit
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
