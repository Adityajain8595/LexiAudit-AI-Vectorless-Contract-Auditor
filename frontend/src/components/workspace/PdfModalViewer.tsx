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
  isRisk?: boolean;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PageWordToken {
  word: string;
  rawWord: string;
  itemIndex: number;
  charStart: number;
  charEnd: number;
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
          const validItems = (textContent.items.filter((item: any) => 'str' in item && item.str && item.str.trim().length > 0) as any[]);
          if (validItems.length === 0) {
            setHighlights([]);
            return;
          }

          const sourceType = pdfCitation?.source_type || '';
          const nodeId = String(pdfCitation?.node_id || '');

          // Check whether this is a Risk Analysis excerpt
          const isRiskAnalysis =
            sourceType === 'risk_analysis' ||
            nodeId.startsWith('risk') ||
            nodeId === 'inspect' ||
            (!sourceType && exactText.length >= 25 && !/^(?:Section|Sec\.?|Clause|Schedule|Table)\s+[A-Za-z0-9.]+(?:\s*,\s*Page\s*\d+)?$/i.test(exactText));

          // Detect Subsection Identifier (e.g. "Section A.a" -> "A.a", "10.2", "4.1")
          const subSecMatch =
            citationTitle.match(/(?:Section|Sec\.?|Clause|Paragraph)?\s*\b([A-Za-z0-9]+)\.([A-Za-z0-9]+)\b/i) ||
            exactText.match(/(?:Section|Sec\.?|Clause|Paragraph)?\s*\b([A-Za-z0-9]+)\.([A-Za-z0-9]+)\b/i) ||
            citationTitle.match(/(?:Section|Sec\.?|Clause)?\s*\b([A-Za-z0-9]+)\s*\(([A-Za-z0-9]+)\)/i) ||
            exactText.match(/(?:Section|Sec\.?|Clause)?\s*\b([A-Za-z0-9]+)\s*\(([A-Za-z0-9]+)\)/i);

          const isSubsection = Boolean(subSecMatch) && (sourceType === 'subsection' || !isRiskAnalysis);
          const subSectionId = subSecMatch
            ? (subSecMatch[2] ? `${subSecMatch[1]}.${subSecMatch[2]}` : `${subSecMatch[1]}(${subSecMatch[2]})`)
            : '';

          // Detect Schedule or Table (e.g. "Schedule A", "Table 1")
          const schedTableMatch =
            citationTitle.match(/\b(?:Schedule|Table|Exhibit|Appendix|Annex)\s+([A-Za-z0-9]+)\b/i) ||
            exactText.match(/^\s*#*\s*(?:SCHEDULE|TABLE|EXHIBIT|APPENDIX|ANNEX)\s+([A-Za-z0-9]+)\b/i);
          const schedTableId = schedTableMatch ? schedTableMatch[1].toUpperCase() : '';
          const schedTableType = schedTableMatch ? schedTableMatch[0].trim().split(/\s+/)[0].toUpperCase() : '';

          // Detect Major Section (e.g. "Section A", "Section 10")
          const majorSecMatch = (!isSubsection && !schedTableId) ? (
            citationTitle.match(/\b(?:Section|Sec\.?|Article|Clause)\s*([A-Za-z0-9]+)\b/i) ||
            exactText.match(/^\s*(?:Section|Sec\.?|Article|Clause)\s*([A-Za-z0-9]+)\b/i) ||
            citationTitle.match(/^\s*([A-Za-z0-9]+)\.\s+[A-Z]/i)
          ) : null;
          const majorSecId = majorSecMatch ? majorSecMatch[1].trim() : '';

          // ─── ENGINE 1: Risk Analysis Word-to-Word Sequential Matching & Boundary Capping ───
          if (isRiskAnalysis && exactText && exactText.length >= 8) {
            // Build sequential word tokens for validItems
            const pageTokens: PageWordToken[] = [];
            for (let i = 0; i < validItems.length; i++) {
              const itemStr = (validItems[i] as any).str || '';
              const wordRegex = /\S+/g;
              let m: RegExpExecArray | null;
              while ((m = wordRegex.exec(itemStr)) !== null) {
                const raw = m[0];
                const clean = raw.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '');
                if (clean.length > 0) {
                  pageTokens.push({
                    word: clean,
                    rawWord: raw,
                    itemIndex: i,
                    charStart: m.index,
                    charEnd: m.index + raw.length,
                  });
                }
              }
            }

            // Extract query words from excerpt
            const cleanExcerpt = exactText
              .replace(/^[“"'\s`\[]+|[”"'\s`\]]+$/g, '')
              .replace(/\.{3,}|…/g, ' ')
              .trim();

            const rawQueryWords = cleanExcerpt.match(/\S+/g) || [];
            const queryWords = rawQueryWords
              .map((w: string) => w.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, ''))
              .filter((w: string) => w.length > 0);

            if (queryWords.length > 0 && pageTokens.length > 0) {
              let matchStartToken: PageWordToken | null = null;
              let matchEndToken: PageWordToken | null = null;

              // Pass 1: Exact contiguous word sequence match
              const qLen = queryWords.length;
              for (let p = 0; p <= pageTokens.length - qLen; p++) {
                let exactSeq = true;
                for (let k = 0; k < qLen; k++) {
                  if (pageTokens[p + k].word !== queryWords[k]) {
                    exactSeq = false;
                    break;
                  }
                }
                if (exactSeq) {
                  matchStartToken = pageTokens[p];
                  matchEndToken = pageTokens[p + qLen - 1];
                  break;
                }
              }

              // Pass 2: High-confidence contiguous window matching (>= 70% word match)
              if (!matchStartToken && qLen >= 4) {
                let bestScore = 0;
                let bestWindowStart = -1;
                let bestWindowEnd = -1;

                for (let p = 0; p < pageTokens.length; p++) {
                  if (pageTokens[p].word === queryWords[0] || (qLen > 1 && pageTokens[p].word === queryWords[1])) {
                    let matchedCount = 0;
                    let lastMatchedIdx = p;
                    let qIdx = pageTokens[p].word === queryWords[0] ? 0 : 1;

                    for (let step = p; step < Math.min(pageTokens.length, p + qLen + 6); step++) {
                      if (qIdx < qLen && pageTokens[step].word === queryWords[qIdx]) {
                        matchedCount++;
                        lastMatchedIdx = step;
                        qIdx++;
                      } else if (qIdx + 1 < qLen && pageTokens[step].word === queryWords[qIdx + 1]) {
                        matchedCount++;
                        lastMatchedIdx = step;
                        qIdx += 2;
                      }
                    }

                    const score = matchedCount / qLen;
                    if (score > bestScore && score >= 0.70) {
                      bestScore = score;
                      bestWindowStart = p;
                      bestWindowEnd = lastMatchedIdx;
                    }
                  }
                }

                if (bestWindowStart !== -1 && bestWindowEnd !== -1) {
                  matchStartToken = pageTokens[bestWindowStart];
                  matchEndToken = pageTokens[bestWindowEnd];
                }
              }

              // Apply strict boundary capping to compute exact bounding boxes
              if (matchStartToken && matchEndToken) {
                const startItemIdx = matchStartToken.itemIndex;
                const endItemIdx = matchEndToken.itemIndex;

                for (let idx = startItemIdx; idx <= endItemIdx; idx++) {
                  const item = validItems[idx];
                  const itemStr = item.str || '';
                  const strLen = Math.max(1, itemStr.length);

                  const charStart = (idx === startItemIdx) ? Math.max(0, matchStartToken.charStart) : 0;
                  const charEnd = (idx === endItemIdx) ? Math.min(strLen, matchEndToken.charEnd) : strLen;

                  if (charEnd <= charStart) continue;

                  const tx = item.transform;
                  const pdfX = tx[4];
                  const pdfY = tx[5];
                  const [viewX, viewY] = viewport.convertToViewportPoint(pdfX, pdfY);
                  const itemWidth = (item.width || 0) * scale;
                  const itemHeight = (item.height || (tx[0] ? Math.abs(tx[0]) : 12)) * scale;

                  // Proportional horizontal sub-slicing for boundary capping
                  const leftFrac = Math.max(0, Math.min(1, charStart / strLen));
                  const rightFrac = Math.max(0, Math.min(1, charEnd / strLen));
                  const subLeft = viewX + leftFrac * itemWidth;
                  const subWidth = Math.max(2, (rightFrac - leftFrac) * itemWidth);

                  boxes.push({
                    left: subLeft,
                    top: viewY - itemHeight,
                    width: subWidth,
                    height: itemHeight,
                    text: itemStr.substring(charStart, charEnd),
                    isRisk: true,
                  });
                }
              }
            }
          }

          // ─── ENGINE 2: Missing Clauses & Query Responses (Section vs. Subsection) ───
          if (boxes.length === 0) {
            const matchingIndices = new Set<number>();

            // Case A: Subsection Citation (e.g. "Section A.a", "Section 10.2", "Clause 4.1", "10.2")
            // Requirement: Highlight ONLY the A.a line/content in the section only
            if (isSubsection && subSectionId) {
              const escapedSub = escapeRegExp(subSectionId);
              const startPattern = new RegExp(`(?:^|\\s|Section\\s*|Clause\\s*)${escapedSub}\\b`, 'i');

              // Determine next subsection or next major section pattern for boundary capping
              let nextSubPattern: RegExp | null = null;
              let nextMajorPattern: RegExp | null = null;

              const dotParts = subSectionId.split('.');
              if (dotParts.length === 2) {
                const parentPart = dotParts[0];
                const childPart = dotParts[1];
                const childNum = parseInt(childPart, 10);
                const parentNum = parseInt(parentPart, 10);

                if (!isNaN(childNum)) {
                  // e.g. 10.2 -> next is 10.3 or next major 11
                  nextSubPattern = new RegExp(`^\\s*(?:Section\\s*)?${escapeRegExp(parentPart)}\\.${childNum + 1}\\b`, 'i');
                  if (!isNaN(parentNum)) {
                    nextMajorPattern = new RegExp(`^\\s*(?:Section\\s*)?${parentNum + 1}[\\.:\\s—\\-]+[A-Z]|^\\s*SECTION\\s+${parentNum + 1}\\b`, 'i');
                  }
                } else if (childPart.length === 1 && /^[a-zA-Z]$/.test(childPart)) {
                  // e.g. A.a -> next is A.b or next major B
                  const nextChar = String.fromCharCode(childPart.charCodeAt(0) + 1);
                  nextSubPattern = new RegExp(`^\\s*(?:Section\\s*)?${escapeRegExp(parentPart)}\\.${nextChar}\\b`, 'i');
                  if (parentPart.length === 1 && /^[a-zA-Z]$/.test(parentPart)) {
                    const nextParentChar = String.fromCharCode(parentPart.charCodeAt(0) + 1);
                    nextMajorPattern = new RegExp(`^\\s*(?:Section\\s*)?${nextParentChar}[\\.:\\s—\\-]+[A-Z]|^\\s*SECTION\\s+${nextParentChar}\\b`, 'i');
                  }
                }
              }

              // General fallback boundary: any other numbered/lettered subsection or major header
              const genericNextSubPattern = new RegExp(`^\\s*(?:Section\\s*)?[A-Za-z0-9]+\\.[A-Za-z0-9]+\\b`, 'i');
              const boundaryPattern = /^\s*(?:SCHEDULE\b|SIGNATURES\b|EXHIBIT\b|TABLE\b|IN WITNESS WHEREOF\b)/i;

              let capturing = false;
              for (let i = 0; i < validItems.length; i++) {
                const str = (validItems[i] as any).str.trim();
                if (!capturing) {
                  if (startPattern.test(str)) {
                    capturing = true;
                    matchingIndices.add(i);
                  }
                } else {
                  // Stop before the next subsection or next section boundary
                  const isNextSub = nextSubPattern ? nextSubPattern.test(str) : (genericNextSubPattern.test(str) && !startPattern.test(str));
                  const isNextMajor = nextMajorPattern ? nextMajorPattern.test(str) : false;
                  const isBoundary = boundaryPattern.test(str);
                  if (isNextSub || isNextMajor || isBoundary) {
                    break;
                  }
                  matchingIndices.add(i);
                }
              }
            }

            // Case B: Schedule or Table (e.g. "Schedule A", "Table 1")
            // Requirement: Highlight all its subsections/contents including heading
            if (matchingIndices.size === 0 && schedTableId) {
              const startPattern = new RegExp(`^\\s*(?:${schedTableType || 'SCHEDULE|TABLE|EXHIBIT'})\\s+${escapeRegExp(schedTableId)}\\b`, 'i');
              const boundaryPattern = new RegExp(`^\\s*(?:SCHEDULE|TABLE|EXHIBIT|SECTION)\\s+(?!${escapeRegExp(schedTableId)}\\b)[A-Za-z0-9]+\\b|^\\s*(?:SIGNATURES|IN WITNESS WHEREOF)\\b`, 'i');

              let capturing = false;
              for (let i = 0; i < validItems.length; i++) {
                const str = (validItems[i] as any).str.trim();
                if (!capturing) {
                  if (startPattern.test(str)) {
                    capturing = true;
                    matchingIndices.add(i);
                  }
                } else {
                  if (boundaryPattern.test(str) && !str.toUpperCase().includes(schedTableId)) {
                    break;
                  }
                  matchingIndices.add(i);
                }
              }
            }

            // Case C: Major Section Cited (e.g. "Section A", "Section 10")
            // Requirement: Highlight ALL its subsections/contents including heading
            if (matchingIndices.size === 0 && majorSecId) {
              const escapedMajor = escapeRegExp(majorSecId);
              const startPattern = new RegExp(`^\\s*(?:Section|Sec\.?|Article|Clause)?\\s*${escapedMajor}[\\.:\\s—\\-]+[A-Z]|^\\s*SECTION\\s+${escapedMajor}\\b`, 'i');

              // Determine next major section for boundary capping
              let nextMajorPattern: RegExp;
              const majorNum = parseInt(majorSecId, 10);
              if (!isNaN(majorNum)) {
                nextMajorPattern = new RegExp(`^\\s*(?:Section|Sec\.?|Article|Clause)?\\s*${majorNum + 1}[\\.:\\s—\\-]+[A-Z]|^\\s*SECTION\\s+${majorNum + 1}\\b|^\\s*(?:SCHEDULE|EXHIBIT|TABLE|SIGNATURES|IN WITNESS WHEREOF)\\b`, 'i');
              } else if (majorSecId.length === 1 && /^[a-zA-Z]$/.test(majorSecId)) {
                const nextChar = String.fromCharCode(majorSecId.charCodeAt(0) + 1);
                nextMajorPattern = new RegExp(`^\\s*(?:Section|Sec\.?|Article|Clause)?\\s*${nextChar}[\\.:\\s—\\-]+[A-Z]|^\\s*SECTION\\s+${nextChar}\\b|^\\s*(?:SCHEDULE|EXHIBIT|TABLE|SIGNATURES|IN WITNESS WHEREOF)\\b`, 'i');
              } else {
                nextMajorPattern = /^\s*(?:Section|Sec\.?|Article|Clause)?\s*[0-9A-Z]+[\.:\s—\-]+[A-Z]|^\s*(?:SCHEDULE|EXHIBIT|TABLE|SIGNATURES)\b/i;
              }

              let capturing = false;
              for (let i = 0; i < validItems.length; i++) {
                const str = (validItems[i] as any).str.trim();
                if (!capturing) {
                  if (startPattern.test(str)) {
                    capturing = true;
                    matchingIndices.add(i); // heading line
                  }
                } else {
                  // Stop at the start of the next major section
                  if (nextMajorPattern.test(str) && !startPattern.test(str)) {
                    break;
                  }
                  matchingIndices.add(i); // all subsections, contents, body paragraphs
                }
              }
            }

            // Map matching indices to bounding boxes
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
                isRisk: false,
              });
            });
          }

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

  // Auto-pan / scroll directly to highlighted text element immediately when highlights finish rendering
  useEffect(() => {
    if (highlights.length > 0 && pageNum === citationPage) {
      const timer = setTimeout(() => {
        const pageEl = containerRef.current;
        if (!pageEl) return;

        // Immediate precise panning on the scrollable container
        const scrollContainer = pageEl.closest('.overflow-y-auto') as HTMLElement | null;
        if (scrollContainer && highlights[0]) {
          const pageTop = pageEl.offsetTop;
          const hlTop = highlights[0].top;
          const viewportHeight = scrollContainer.clientHeight || window.innerHeight;
          // Position highlight comfortably 1/3 from the top of the viewport
          const targetScrollTop = Math.max(0, pageTop + hlTop - viewportHeight / 3);

          scrollContainer.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        }

        // Fallback smooth centering
        const hlEl = document.getElementById(`pdf-highlight-${pageNum}`);
        if (hlEl) {
          hlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
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
            backgroundColor: hl.isRisk ? 'rgba(255, 138, 76, 0.38)' : 'rgba(56, 189, 248, 0.35)',
            boxShadow: hl.isRisk
              ? '0 0 0 1.5px rgba(255, 117, 76, 0.8), 0 0 10px rgba(255, 117, 76, 0.35)'
              : '0 0 0 1px rgba(56, 189, 248, 0.6)',
            mixBlendMode: 'multiply',
          }}
          className={`rounded-[2px] pointer-events-none ${hl.isRisk && i === 0 ? 'animate-pulse' : ''}`}
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
