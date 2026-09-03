import { motion } from 'framer-motion';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  title: string;
  description: string;
  itemName: string;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  title,
  description,
  itemName,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(12, 8, 6, 0.88)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === e.currentTarget && !isLoading && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md glass-strong rounded-2xl p-6 glow-border border-red-500/30"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
            <AlertTriangle className="text-red-400" size={20} />
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-base font-semibold text-slate-100 mb-1">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">{description}</p>

        <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3 mb-5">
          <p className="text-xs font-mono text-slate-300 truncate">{itemName}</p>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-md shadow-red-950/50 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={13} />
                Delete
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
