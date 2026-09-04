import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, Loader2, ExternalLink, Download, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Maximize2, Minimize2
} from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import { fetchDocumentFileBlob } from '../../api/client';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface HighlightBox {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

interface PdfPageItemProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  pdfCitation: any;
  citationPage: number;
  onVisible: (pageNum: number) => void;
}

function PdfPageItem({
  pdfDoc,
  pageNum,
  scale,
  pdfCitation,
  citationPage,
  onVisible,
}: PdfPageItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<HighlightBox[]>([]);
  const renderTaskRef = useRef<any>(null);

  // IntersectionObserver to update active page counter as user scrolls down
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            onVisible(pageNum);
          }
        });
      },
      { threshold: [0.3, 0.6] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  // Render individual page canvas and text selection highlight overlay
  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!canvasRef.current) return;
      try {
        if (renderTaskRef.current) renderTaskRef.current.cancel();

        const page = await pdfDoc.getPage(pageNum);
        if (cancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        ctx.scale(pixelRatio, pixelRatio);

        renderTaskRef.current = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        } as any);

        await renderTaskRef.current.promise;
        if (cancelled) return;

        // Calculate highlights if pageNum matches target citation page
        const exactText = (pdfCitation?.exact_text || '').trim();
        const citationTitle = (pdfCitation?.title || '').trim();
        const isRealCitation = Boolean(
          pdfCitation &&
          pdfCitation.node_id !== 'view' &&
          (exactText.length >= 3 || citationTitle.length >= 3)
        );

        if (isRealCitation && pageNum === citationPage) {
          const textContent = await page.getTextContent();
          if (cancelled) return;

          const boxes: HighlightBox[] = [];
          const validItems = textContent.items.filter((item: any) => 'str' in item && item.str && item.str.trim().length > 0);
          const matchingIndices = new Set<number>();

          const schedMatch = citationTitle.match(/\bSchedule\s+([A-Za-z0-9]+)\b/i) ||
                             exactText.match(/^\s*#*\s*SCHEDULE\s+([A-Za-z0-9]+)\b/i);
          const scheduleLetter = schedMatch ? schedMatch[1].toUpperCase() : '';

          let subSectionId = '';
          if (!scheduleLetter) {
            const titleSubSecMatch = citationTitle.match(/(?:Section|Sec\.?|Clause)?\s*\b(\d+\.\d+)\b/i) ||
                                     exactText.match(/(?:Section|Sec\.?|Clause)?\s*\b(\d+\.\d+)\b/i);
            if (titleSubSecMatch) {
              subSectionId = titleSubSecMatch[1].trim();
            }
          }

          const majorSecMatch = !scheduleLetter && !subSectionId ? (
            citationTitle.match(/\b(?:Section|Sec\.?)\s*(\d+)\b/i) ||
            exactText.match(/^\s*(?:Section|Sec\.?)\s*(\d+)\b/i)
          ) : null;
          const majorSecId = majorSecMatch ? majorSecMatch[1].trim() : '';

          if (exactText && exactText.length >= 8) {
            const targetWords = exactText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length >= 3);
            if (targetWords.length >= 3) {
              let bestScore = 0;
              let bestIdx = -1;

              validItems.forEach((item: any, i: number) => {
                const itemWords = (item.str || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w: string) => w.length >= 3);
                if (itemWords.length < 3) return;

                let matchCount = 0;
                itemWords.forEach((w: string) => {
                  if (targetWords.includes(w)) matchCount++;
                });

                const score = matchCount / itemWords.length;
                if (matchCount >= 4 && score >= 0.4) {
                  matchingIndices.add(i);
                } else if (score > bestScore && matchCount >= 3) {
                  bestScore = score;
                  bestIdx = i;
                }
              });

              if (matchingIndices.size === 0 && bestIdx !== -1 && bestScore >= 0.35) {
                matchingIndices.add(bestIdx);
              }

              if (matchingIndices.size === 0) {
                for (let i = 0; i < validItems.length; i++) {
                  let windowStr = '';
                  for (let j = i; j < Math.min(validItems.length, i + 4); j++) {
                    windowStr += ' ' + ((validItems[j] as any).str || '');
                    const normWindow = windowStr.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
                    const normTarget = exactText.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (normWindow.length >= 25 && (normTarget.includes(normWindow) || normWindow.includes(normTarget))) {
                      for (let k = i; k <= j; k++) {
                        matchingIndices.add(k);
                      }
                      break;
                    }
                  }
                  if (matchingIndices.size > 0) break;
                }
              }
            }
          }

          if (matchingIndices.size === 0 && scheduleLetter) {
            const startPattern = new RegExp(`^\\s*(?:SCHEDULE|EXHIBIT|TABLE)\\s+${scheduleLetter}\\b`, 'i');
            const boundaryPattern = /^\s*(?:SCHEDULE\s+[A-Z]|EXHIBIT\s+[A-Z]|SIGNATURES\b)/i;
            let capturing = false;
            for (let i = 0; i < validItems.length; i++) {
              const str = (validItems[i] as any).str.trim();
              if (!capturing) {
                if (startPattern.test(str)) {
                  capturing = true;
                  matchingIndices.add(i);
                }
              } else {
                if (boundaryPattern.test(str) && !str.toUpperCase().includes(`SCHEDULE ${scheduleLetter}`)) break;
                matchingIndices.add(i);
              }
            }
          }

          if (matchingIndices.size === 0 && subSectionId) {
            const startPattern = new RegExp(`(^|\\s|Section\\s*)${subSectionId.replace('.', '\\.')}\\b`, 'i');
            const [secN, secP] = subSectionId.split('.').map(Number);
            const nextSubSecPattern = isNaN(secP) ? null : new RegExp(`^\\s*${secN}\\.${secP + 1}\\b`, 'i');
            const nextMajorSecPattern = isNaN(secN) ? null : new RegExp(`^\\s*${secN + 1}\\.\\s+[A-Z]`, 'i');
            const boundaryPattern = /^\s*(?:SCHEDULE\b|SIGNATURES\b|EXHIBIT\b)/i;

            let capturing = false;
            for (let i = 0; i < validItems.length; i++) {
              const str = (validItems[i] as any).str.trim();
              if (!capturing) {
                if (startPattern.test(str)) {
                  capturing = true;
                  matchingIndices.add(i);
                }
              } else {
                const isNextSub = nextSubSecPattern ? nextSubSecPattern.test(str) : false;
                const isNextMajor = nextMajorSecPattern ? nextMajorSecPattern.test(str) : false;
                const isBoundary = boundaryPattern.test(str);
                if (isNextSub || isNextMajor || isBoundary) break;
                matchingIndices.add(i);
              }
            }
          }

          if (matchingIndices.size === 0 && majorSecId) {
            const startPattern = new RegExp(`^\\s*(?:Section\\s*)?${majorSecId}\\.\\s+[A-Z]`, 'i');
            for (let i = 0; i < validItems.length; i++) {
              const str = (validItems[i] as any).str.trim();
              if (startPattern.test(str)) {
                matchingIndices.add(i);
                break;
              }
            }
          }

          validItems.forEach((item: any, idx: number) => {
            if (!matchingIndices.has(idx)) return;
            const tx = item.transform;
            const pdfX = tx[4];
            const pdfY = tx[5];
            const itemWidth = item.width || 0;
            const itemHeight = item.height || (tx[0] ? Math.abs(tx[0]) : 12);
            const [viewX, viewY] = viewport.convertToViewportPoint(pdfX, pdfY);
            const scaledWidth = itemWidth * scale;
            const scaledHeight = itemHeight * scale;

            boxes.push({
              left: viewX,
              top: viewY - scaledHeight,
              width: scaledWidth,
              height: scaledHeight,
              text: item.str,
            });
          });

          setHighlights(boxes);
        } else {
          setHighlights([]);
        }
      } catch (e) {
        // ignore cancellation
      }
    }

    render();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, pageNum, scale, pdfCitation, citationPage]);

  // Auto-scroll directly to highlighted text element when highlights finish rendering
  useEffect(() => {
    if (highlights.length > 0 && pageNum === citationPage) {
      const timer = setTimeout(() => {
        const hlEl = document.getElementById(`pdf-highlight-${pageNum}`);
        if (hlEl) {
          hlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlights, pageNum, citationPage]);

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNum}`}
      className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10 bg-white inline-block my-3 shrink-0"
    >
      <canvas ref={canvasRef} className="block" />
      {highlights.map((hl, i) => (
        <div
          key={i}
          id={i === 0 ? `pdf-highlight-${pageNum}` : undefined}
          style={{
            position: 'absolute',
            left: `${hl.left}px`,
            top: `${hl.top}px`,
            width: `${hl.width}px`,
            height: `${hl.height}px`,
            backgroundColor: 'rgba(51, 144, 255, 0.32)',
            mixBlendMode: 'multiply',
          }}
          className="rounded-[1px] pointer-events-none"
        />
      ))}
    </div>
  );
}

export default function PdfModalViewer({ isSidePanel = false }: { isSidePanel?: boolean }) {
  const { isPdfOpen, closePdf, pdfCitation, selectedDocId, selectedDoc } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(isSidePanel ? 1.05 : 1.25);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rawBlobUrlRef = useRef<string | null>(null);

  const citationPage = pdfCitation?.page_index ? Number(pdfCitation.page_index) : 1;
  const docId = selectedDocId || selectedDoc?.id || (pdfCitation as any)?.doc_id;

  // 1. Fetch PDF Data when viewer opens or document changes
  useEffect(() => {
    if (!isPdfOpen || !docId) return;

    let isSubscribed = true;

    if (pdfDoc) {
      if (citationPage > 0) {
        scrollToPage(citationPage);
      }
      return;
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        if (rawBlobUrlRef.current) URL.revokeObjectURL(rawBlobUrlRef.current);

        const res = await fetchDocumentFileBlob(docId);
        if (!isSubscribed) return;
        const blob = res.data;
        rawBlobUrlRef.current = URL.createObjectURL(blob);

        const arrayBuffer = await blob.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const loadedPdf = await loadingTask.promise;

        if (!isSubscribed) return;
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
        if (citationPage > 0) {
          setTimeout(() => scrollToPage(citationPage), 200);
        }
      } catch (e: any) {
        if (isSubscribed) {
          console.error('PDF fetch/parse failed:', e);
          setError(e.message || 'Failed to retrieve or parse contract PDF');
        }
      } finally {
        if (isSubscribed) setLoading(false);
      }
    })();

    return () => {
      isSubscribed = false;
      if (rawBlobUrlRef.current) URL.revokeObjectURL(rawBlobUrlRef.current);
    };
  }, [isPdfOpen, docId]);

  // 2. React to citation page changes immediately
  useEffect(() => {
    if (pdfCitation?.page_index) {
      const p = Number(pdfCitation.page_index);
      if (p > 0) {
        scrollToPage(p);
      }
    }
  }, [pdfCitation]);

  // Helper to scroll smoothly to target page or highlighted text element
  const scrollToPage = (p: number) => {
    setCurrentPage(p);
    const hlEl = document.getElementById(`pdf-highlight-${p}`);
    if (hlEl) {
      hlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      const pageEl = document.getElementById(`pdf-page-${p}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handlePageVisible = (p: number) => {
    setCurrentPage(p);
  };

  if (!isPdfOpen) return null;

  const pageNumbers = Array.from({ length: numPages }, (_, i) => i + 1);

  // Side Panel Layout (Split-view inside Workspace)
  if (isSidePanel) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-[#0C0806] select-none">
        {/* Panel Header */}
        <div className="shrink-0 h-13 flex items-center justify-between px-4 border-b border-white/8 bg-[#140E0A]/95">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-peach-500/15 border border-peach-500/25 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-peach-400" />
            </div>
            <p className="text-xs font-bold text-slate-100 truncate" title={selectedDoc?.filename}>
              {selectedDoc?.filename ?? 'Contract PDF'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!loading && (
              <>
                {/* Pagination Controls */}
                <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg px-1.5 py-0.5">
                  <button
                    onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="text-[11px] font-mono font-medium text-slate-200 px-1">
                    {currentPage}/{numPages}
                  </span>
                  <button
                    onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
                    disabled={currentPage >= numPages}
                    className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5">
                  <button
                    onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut size={12} />
                  </button>
                  <span className="text-[10px] font-mono text-slate-300 px-1 min-w-[32px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn size={12} />
                  </button>
                </div>

                {rawBlobUrlRef.current && (
                  <a
                    href={rawBlobUrlRef.current}
                    download={selectedDoc?.filename ?? 'contract.pdf'}
                    title="Download PDF"
                    className="p-1.5 text-slate-400 hover:text-peach-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                  </a>
                )}
              </>
            )}

            <button
              onClick={closePdf}
              title="Close PDF Panel"
              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-0.5 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Continuous Vertical Scroll Viewport */}
        <div
          ref={scrollContainerRef}
          className="flex-1 relative bg-[#100B08] overflow-y-auto flex flex-col items-center p-3 sm:p-4"
        >
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0C0806]/80 z-20">
              <Loader2 size={28} className="text-peach-400 animate-spin" />
              <p className="text-xs text-slate-300 font-medium">Fetching PDF...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-20 bg-[#0C0806]">
              <FileText size={32} className="text-peach-500/40 mb-2" />
              <p className="text-xs text-peach-300 font-semibold mb-1">Contract PDF Unavailable</p>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-3">
                {error}
              </p>
              <button
                onClick={closePdf}
                className="px-3 py-1.5 rounded-lg bg-peach-500/20 text-peach-300 border border-peach-500/35 text-xs font-semibold hover:bg-peach-500/30 transition-all cursor-pointer"
              >
                Close Panel
              </button>
            </div>
          )}

          {pdfDoc &&
            pageNumbers.map((p) => (
              <PdfPageItem
                key={p}
                pdfDoc={pdfDoc}
                pageNum={p}
                scale={scale}
                pdfCitation={pdfCitation}
                citationPage={citationPage}
                onVisible={handlePageVisible}
              />
            ))}
        </div>
      </div>
    );
  }

  // Full Modal Layout
  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
        style={{ background: 'rgba(12, 8, 6, 0.88)', backdropFilter: 'blur(16px)' }}
        onClick={(e) => e.target === e.currentTarget && closePdf()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`w-full ${
            isFullScreen ? 'h-[96vh] max-w-[98vw]' : 'h-[88vh] max-w-5xl'
          } glass-strong rounded-2xl glow-border flex flex-col overflow-hidden shadow-2xl border-peach-500/25 bg-[#0C0806] transition-all`}
        >
          {/* Header Controls Bar */}
          <div className="shrink-0 h-14 flex items-center justify-between px-5 border-b border-white/8 bg-[#140E0A]/95">
            {/* Title & Status */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-peach-500/15 border border-peach-500/25 flex items-center justify-center shrink-0">
                <FileText size={16} className="text-peach-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-bold text-slate-100 break-words leading-tight" title={selectedDoc?.filename}>
                  {selectedDoc?.filename ?? 'Contract PDF'}
                </p>
              </div>
            </div>

            {/* Pagination & Zoom Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {loading ? (
                <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-peach-500/10 border border-peach-500/20 text-peach-300 text-xs font-medium">
                  <Loader2 size={14} className="animate-spin text-peach-400" />
                  <span>Fetching PDF...</span>
                </div>
              ) : (
                <>
                  {/* Pagination controls */}
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
                    <button
                      onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-mono font-medium text-slate-200 px-1">
                      {currentPage} / {numPages}
                    </span>
                    <button
                      onClick={() => scrollToPage(Math.min(numPages, currentPage + 1))}
                      disabled={currentPage >= numPages}
                      className="p-1 text-slate-400 hover:text-slate-200 disabled:opacity-30 transition-colors cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Zoom Controls */}
                  <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
                    <button
                      onClick={() => setScale((s) => Math.max(0.75, s - 0.2))}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <span className="text-xs font-mono text-slate-300 px-1 min-w-[38px] text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <button
                      onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={13} />
                    </button>
                  </div>

                  {/* Download / Open in tab */}
                  {rawBlobUrlRef.current && (
                    <>
                      <a
                        href={rawBlobUrlRef.current}
                        download={selectedDoc?.filename ?? 'contract.pdf'}
                        title="Download PDF"
                        className="p-1.5 text-slate-400 hover:text-peach-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Download size={15} />
                      </a>
                      <a
                        href={rawBlobUrlRef.current}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in new window"
                        className="p-1.5 text-slate-400 hover:text-peach-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      >
                        <ExternalLink size={15} />
                      </a>
                    </>
                  )}

                  {/* Fullscreen toggle */}
                  <button
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    title={isFullScreen ? 'Exit full screen' : 'Full screen'}
                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                </>
              )}

              {/* Close Button */}
              <button
                onClick={closePdf}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors ml-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Continuous Vertical Scroll Viewport */}
          <div
            ref={scrollContainerRef}
            className="flex-1 relative bg-[#100B08] overflow-y-auto flex flex-col items-center p-4 sm:p-6"
          >
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0C0806]/80 z-20">
                <Loader2 size={32} className="text-peach-400 animate-spin" />
                <p className="text-xs text-slate-300 font-medium">Rendering contract pages and evidence…</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-[#0C0806]">
                <FileText size={38} className="text-peach-500/40 mb-3" />
                <p className="text-sm text-peach-300 font-semibold mb-1">Contract PDF File Unavailable</p>
                <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-4">
                  This document was indexed in an earlier session before storage caching was enabled. Please re-upload this PDF contract to activate interactive canvas rendering and live cited text highlighting.
                </p>
                <button
                  onClick={closePdf}
                  className="px-4 py-2 rounded-xl bg-peach-500/20 text-peach-300 border border-peach-500/35 text-xs font-semibold hover:bg-peach-500/30 transition-all cursor-pointer"
                >
                  Close Viewer & Upload PDF
                </button>
              </div>
            )}

            {pdfDoc &&
              pageNumbers.map((p) => (
                <PdfPageItem
                  key={p}
                  pdfDoc={pdfDoc}
                  pageNum={p}
                  scale={scale}
                  pdfCitation={pdfCitation}
                  citationPage={citationPage}
                  onVisible={handlePageVisible}
                />
              ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
