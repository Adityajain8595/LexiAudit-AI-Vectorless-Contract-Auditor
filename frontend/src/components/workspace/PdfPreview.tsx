import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, FileText, BookOpen, Loader2, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import { fetchDocumentFileBlob } from '../../api/client';

export default function PdfPreview() {
  const { closePdf, pdfCitation, selectedDocId, selectedDoc } = useWorkspaceStore();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wide, setWide] = useState(false);
  const prevDocId = useRef<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const pageNum = pdfCitation?.page_index ? Number(pdfCitation.page_index) : 1;

  useEffect(() => {
    if (!selectedDocId) return;

    // Only re-fetch if document changed
    if (prevDocId.current === selectedDocId && blobUrlRef.current) {
      setLoading(false);
      setPdfUrl(`${blobUrlRef.current}#page=${pageNum}`);
      return;
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const res = await fetchDocumentFileBlob(selectedDocId);
        const url = URL.createObjectURL(res.data);
        blobUrlRef.current = url;
        prevDocId.current = selectedDocId;
        setPdfUrl(`${url}#page=${pageNum}`);
      } catch (e: any) {
        setError(e.message || 'Failed to load PDF preview');
      } finally {
        setLoading(false);
      }
    })();

    return () => {};
  }, [selectedDocId, pdfCitation]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`h-full glass-strong border-l border-white/8 flex flex-col shrink-0 ${
        wide ? 'w-[720px]' : 'w-[480px]'
      } transition-all duration-300 z-30 shadow-2xl bg-slate-950/95`}
    >
      {/* Header */}
      <div className="shrink-0 h-16 flex items-center gap-3 px-5 border-b border-white/8 bg-slate-900/60">
        <div className="w-8 h-8 rounded-xl bg-peach-500/15 border border-peach-500/25 flex items-center justify-center shrink-0">
          <BookOpen size={16} className="text-peach-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-100 truncate">
            {selectedDoc?.filename ?? 'Contract PDF'}
          </p>
          <p className="text-[10px] text-peach-400 font-mono">
            {pdfCitation ? `Viewing Page ${pageNum} · ${pdfCitation.title}` : 'Full Contract View'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {blobUrlRef.current && (
            <a
              href={blobUrlRef.current}
              target="_blank"
              rel="noreferrer"
              title="Open in new tab"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            onClick={() => setWide(!wide)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            title={wide ? 'Compact panel' : 'Expand panel'}
          >
            {wide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={closePdf}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Citation info banner if present */}
      {pdfCitation && (
        <div className="shrink-0 p-3.5 bg-peach-500/[0.08] border-b border-peach-500/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-peach-300 flex items-center gap-1.5">
              <FileText size={11} /> Cited Evidence Excerpt
            </span>
            <span className="text-[9px] font-mono bg-peach-500/20 text-peach-300 px-1.5 py-0.2 rounded">
              Page {pageNum}
            </span>
          </div>
          {pdfCitation.exact_text && (
            <p className="text-xs text-slate-200 italic font-mono bg-slate-950/60 p-2.5 rounded-lg border border-white/5 line-clamp-3">
              "{pdfCitation.exact_text}"
            </p>
          )}
        </div>
      )}

      {/* PDF View Container */}
      <div className="flex-1 relative overflow-hidden bg-slate-900/50">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="text-peach-400 animate-spin" />
            <p className="text-xs text-slate-400 font-medium">Loading document PDF…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <FileText size={32} className="text-slate-600 mb-2" />
            <p className="text-xs text-red-400 font-medium mb-1">Could not render PDF</p>
            <p className="text-[11px] text-slate-500 max-w-xs">{error}</p>
          </div>
        )}

        {pdfUrl && !error && (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            className="w-full h-full border-none"
            title="Contract PDF Viewer"
            onLoad={() => setLoading(false)}
          />
        )}
      </div>
    </motion.aside>
  );
}
