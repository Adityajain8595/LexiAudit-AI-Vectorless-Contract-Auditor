import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Download, FileSearch,
  Loader2, MessageSquare, Copy, Check, Sparkles,
  Eye, FolderOpen, ArrowRight, Edit3, X, Square, Edit2
} from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import type { Message, CitedNode, Document } from '../../store/workspaceStore';
import { streamQuery, exportSessionPdf, updateSessionTitle as apiUpdateSessionTitle } from '../../api/client';

// ─── Clickable In-Text Inline Citation Parser ────────────────────────────────
function FormattedMessageWithInlineCitations({
  content,
  citedNodes,
  onCitedClick
}: {
  content: string;
  citedNodes?: CitedNode[];
  onCitedClick: (n: CitedNode) => void;
}) {
  // Matches inline citation patterns like [Section 4.1, Page 4], [Schedule 1 — Implementation Milestones, Page 5], [Page 3], [p. 2], [Section 5]
  const renderInlineContent = (text: string) => {
    if (!text || typeof text !== 'string') return text;
    const citationRegex = /(?:\[([^\]]*(?:Section|Sec\.?|Page|p\.?|Schedule|Clause|\b\d+\b)[^\]]*)\]|\(((?:Section|Sec\.?|Clause|Schedule)\s*[0-9A-Za-z.\-_]+(?:\s*,\s*(?:Page|p\.?)\s*\d+)?)\))/gi;
    const parts = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = citationRegex.lastIndex;
      const rawCitation = (match[1] || match[2] || '').trim();
      if (!rawCitation) continue;

      // Push preceding text
      if (matchStart > lastIndex) {
        parts.push(text.substring(lastIndex, matchStart));
      }

      // Split compound citations separated by semicolons into discrete interactive pill buttons
      const subCitations = rawCitation.split(';').map(s => s.trim()).filter(Boolean);

      subCitations.forEach((rawSubCite, subIdx) => {
        // 1. Extract page number
        const pageMatch = rawSubCite.match(/(?:page|p\.?)\s*(\d+)/i);
        const parsedPageNum = pageMatch ? parseInt(pageMatch[1], 10) : null;

        // 2. Extract clean section title and identifier (stripping page suffix)
        const citeWithoutPage = rawSubCite.replace(/(?:,\s*)?(?:page|p\.?)\s*\d+/i, '').trim();
        const secNumMatch = citeWithoutPage.match(/(?:Section|Sec\.?|Clause|Schedule)?\s*\b(\d+(?:\.\d+)?)\b/i);
        const extractedSecNum = secNumMatch ? secNumMatch[1] : '';
        const majorSecId = extractedSecNum.includes('.') ? extractedSecNum.split('.')[0] : extractedSecNum;
        const cleanCiteTitle = citeWithoutPage.toLowerCase().replace(/^(?:section|sec\.?|clause|schedule)\s*/i, '').trim();

        let targetNode: CitedNode | null = null;
        if (citedNodes && citedNodes.length > 0) {
          // A. Match by section number (e.g. "9.1", "10.2", "9")
          if (extractedSecNum) {
            targetNode = citedNodes.find((n) => {
              const nTitle = (n.title || '').toLowerCase();
              return (
                nTitle.includes(extractedSecNum) ||
                nTitle.startsWith(extractedSecNum) ||
                (majorSecId && (nTitle.startsWith(majorSecId + '.') || nTitle.includes(`section ${majorSecId}`)))
              );
            }) || null;
          }

          // B. Match by title string (e.g. "9. indemnification")
          if (!targetNode && cleanCiteTitle) {
            targetNode = citedNodes.find((n) => {
              const nTitle = (n.title || '').toLowerCase();
              return nTitle.includes(cleanCiteTitle) || cleanCiteTitle.includes(nTitle);
            }) || null;
          }

          // C. Match by page index + title keywords
          if (!targetNode && parsedPageNum !== null) {
            const titleKeywords = cleanCiteTitle.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length >= 4);
            if (titleKeywords.length > 0) {
              targetNode = citedNodes.find((n) =>
                Number(n.page_index) === parsedPageNum &&
                titleKeywords.some(w => (n.title || '').toLowerCase().includes(w))
              ) || null;
            }
          }

          // D. Fallback by page index ONLY if single node exists on that page
          if (!targetNode && parsedPageNum !== null) {
            const pageNodes = citedNodes.filter((n) => Number(n.page_index) === parsedPageNum);
            if (pageNodes.length === 1) {
              targetNode = pageNodes[0];
            }
          }
        }

        const targetPage = parsedPageNum !== null ? parsedPageNum : (targetNode ? Number(targetNode.page_index) : 1);

        // Pinpoint sub-clause extraction: if sectionId is a subsection (e.g. 10.2), isolate only that subclause
        let highlightText = targetNode?.exact_text || targetNode?.title || rawSubCite;
        const subNumMatch = rawSubCite.match(/\b(\d+\.\d+)\b/);
        if (subNumMatch && targetNode?.exact_text) {
          const subNum = subNumMatch[1];
          const subRegex = new RegExp(`(?:^|\\n)\\s*${subNum.replace('.', '\\.')}\\b[\\s\\S]*?(?=(?:^|\\n)\\s*\\d+\\.\\d+|\\n\\s*\\d+\\.\\s+[A-Z]|$)`, 'i');
          const subMatch = targetNode.exact_text.match(subRegex);
          if (subMatch) {
            highlightText = subMatch[0].trim();
          }
        }

        const effectiveNode: CitedNode = {
          node_id: targetNode?.node_id ? `${targetNode.node_id}-${subIdx}` : `cite-${targetPage}-${subIdx}`,
          title: rawSubCite,
          page_index: targetPage,
          summary: targetNode?.summary || 'Cited Provision',
          exact_text: highlightText,
        };

        parts.push(
          <button
            key={`cite-${matchStart}-${subIdx}-${rawSubCite}`}
            onClick={(e) => {
              e.stopPropagation();
              onCitedClick(effectiveNode);
            }}
            title={`Open Page ${targetPage} in PDF & view ${rawSubCite}`}
            className="inline-flex items-center gap-1 mx-1 my-0.5 px-2 py-0.5 rounded-md bg-peach-500/15 hover:bg-peach-500/30 text-peach-300 hover:text-peach-100 border border-peach-500/30 hover:border-peach-500/60 font-mono text-[11px] font-semibold transition-all cursor-pointer shadow-sm align-middle"
          >
            <FileSearch size={11} className="text-peach-400" />
            <span>{rawSubCite}</span>
          </button>
        );
      });

      lastIndex = matchEnd;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  const processChildren = (children: any): any => {
    if (typeof children === 'string') {
      return renderInlineContent(children);
    }
    if (Array.isArray(children)) {
      return children.map((child, i) => (
        <span key={i}>{processChildren(child)}</span>
      ));
    }
    if (children && typeof children === 'object' && 'props' in children && children.props?.children) {
      return {
        ...children,
        props: {
          ...children.props,
          children: processChildren(children.props.children),
        },
      };
    }
    return children;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }: any) => <p className="mb-3 leading-relaxed">{processChildren(children)}</p>,
        li: ({ children }: any) => <li className="mb-1.5 leading-relaxed">{processChildren(children)}</li>,
        ul: ({ children }: any) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
        ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
        strong: ({ children }: any) => <strong className="font-semibold text-slate-100">{processChildren(children)}</strong>,
        em: ({ children }: any) => <em className="italic">{processChildren(children)}</em>,
        h1: ({ children }: any) => <h1 className="text-base font-bold text-slate-100 mb-2 mt-4">{processChildren(children)}</h1>,
        h2: ({ children }: any) => <h2 className="text-sm font-bold text-slate-100 mb-2 mt-3">{processChildren(children)}</h2>,
        h3: ({ children }: any) => <h3 className="text-xs font-bold text-peach-300 mb-1.5 mt-2">{processChildren(children)}</h3>,
        h4: ({ children }: any) => <h4 className="text-xs font-bold text-slate-100 mb-1.5 mt-2">{processChildren(children)}</h4>,
        h5: ({ children }: any) => <h5 className="text-xs font-bold text-slate-100 mb-1 mt-2">{processChildren(children)}</h5>,
        code: MarkdownCodeBlock,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Custom Markdown Code / Text Block with Copy Button ───────────────────────
function MarkdownCodeBlock({ node, inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code className="bg-white/10 text-peach-300 px-1.5 py-0.5 rounded text-xs font-mono border border-white/5" {...props}>
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-xl overflow-hidden border border-white/12 bg-[#120D0A] shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1C1410] border-b border-white/8 text-[11px] text-slate-400 font-mono">
        <span>Language Provision</span>
        <button
          onClick={handleCopy}
          title={copied ? 'Copied clause!' : 'Copy clause boilerplate'}
          className="p-1 hover:text-peach-300 transition-colors cursor-pointer"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

// ─── Natural Initial Audit Report Generator ──────────────────────────────────
function generateNaturalAuditMarkdown(doc: Document): string {
  let md = '';

  const riskMap: Record<string, string> = { RED: 'HIGH', YELLOW: 'MEDIUM', GREEN: 'LOW', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

  const risks = doc.risk_analysis || [];
  if (risks.length > 0) {
    md += `### Identified Key Risks & Unfavourable Clauses\n\n`;
    risks.forEach((r, idx) => {
      const rawLevel = String(r.risk_level || 'MEDIUM').toUpperCase();
      const riskLevel = riskMap[rawLevel] || 'MEDIUM';
      const pageStr = r.page_number ? `, Page ${r.page_number}` : '';
      const clauseTitle = r.clause_name || r.section_title || `Risk Provision ${idx + 1}`;
      const sectionTitle = r.section_title || clauseTitle;
      const citationRef = `[${sectionTitle}${pageStr}]`;

      md += `#### ${idx + 1}. ${clauseTitle} (${riskLevel} RISK)\n${citationRef}\n\n`;
      if (r.extracted_text) {
        md += `\`\`\`text\n${r.extracted_text.trim()}\n\`\`\`\n\n`;
      }
      if (r.analysis && r.analysis.trim()) {
        md += `- **Legal Assessment:** ${r.analysis.trim()}\n`;
      } else {
        md += `- **Legal Assessment:** Unfavourable covenant creating unilateral liability or financial exposure.\n`;
      }

      if (r.remedy_recommendation && r.remedy_recommendation.trim()) {
        md += `- **Strategic Recommendation / Counter-Language:** ${r.remedy_recommendation.trim()}\n`;
      } else {
        md += `- **Strategic Recommendation / Counter-Language:** Request mutual reciprocity and introduce formal caps or notice cure periods.\n`;
      }
      md += `\n---\n\n`;
    });
  }

  const missing = doc.missing_clauses || [];
  if (missing.length > 0) {
    md += `### Missing Essential Protections & Gaps\n\n`;
    missing.forEach((m, idx) => {
      const rawSev = String(m.severity || 'MEDIUM').toUpperCase();
      const severity = riskMap[rawSev] || 'MEDIUM';
      const gapTitle = m.clause_name || `Protective Safeguard ${idx + 1}`;

      md += `#### Missing Protection ${idx + 1}: ${gapTitle} (${severity} Severity)\n\n`;
      if (m.impact_description && m.impact_description.trim()) {
        md += `- **Impact Assessment:** ${m.impact_description.trim()}\n\n`;
      } else {
        md += `- **Impact Assessment:** Omitting this safeguard exposes the party to statutory non-compliance and unmitigated liabilities.\n\n`;
      }

      if (m.suggested_language && m.suggested_language.trim()) {
        md += `**Suggested Insertion Boilerplate:**\n\`\`\`text\n${m.suggested_language.trim()}\n\`\`\`\n\n`;
      } else {
        md += `**Suggested Insertion Boilerplate:**\n\`\`\`text\nEach Party agrees to adhere to standard industry protections and applicable legal frameworks.\n\`\`\`\n\n`;
      }
      md += `---\n\n`;
    });
  }

  return md;
}

// ─── One-Liner Follow-up Question Recommendations ─────────────────────────────
function FollowUpRecommendations({
  queries,
  onFillQuery
}: {
  queries: string[];
  onFillQuery: (q: string) => void;
}) {
  if (!queries || queries.length === 0) return null;

  return (
    <div className="mt-4 pt-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
        <Sparkles size={12} className="text-peach-400" />
        <span>Suggested Follow-Up Queries</span>
      </div>
      <div className="flex flex-col gap-2">
        {queries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => onFillQuery(q)}
            title="Click to paste into input box"
            className="w-full flex items-start justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-peach-500/40 bg-white/[0.03] hover:bg-peach-500/10 text-slate-200 hover:text-peach-200 text-xs sm:text-sm font-normal text-left transition-all duration-150 group shadow-sm cursor-pointer"
          >
            <span className="flex-1 whitespace-normal break-words leading-relaxed">{q}</span>
            <ArrowRight size={14} className="shrink-0 mt-0.5 text-slate-500 group-hover:text-peach-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Natural Initial Audit Report ─────────────────────────────────────────────
function NaturalAuditReport({
  doc,
  showSuggestedQueries = true,
  onFillQuery,
  onCitedClick
}: {
  doc: Document;
  showSuggestedQueries?: boolean;
  onFillQuery: (q: string) => void;
  onCitedClick: (n: CitedNode) => void;
}) {
  const [copied, setCopied] = useState(false);
  const markdownText = generateNaturalAuditMarkdown(doc);
  const suggestedQueries = doc.suggested_queries || [];

  // Build cited nodes from risk analysis so inline references are interactive
  const auditCitedNodes: CitedNode[] = (doc.risk_analysis || []).map((r, idx) => ({
    node_id: `risk-audit-${idx}`,
    title: r.clause_name || r.section_title || `Clause ${idx + 1}`,
    page_index: r.page_number || 1,
    summary: r.analysis || '',
    exact_text: r.extracted_text || r.clause_name || '',
  }));

  const handleCopyAll = () => {
    navigator.clipboard.writeText(markdownText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex flex-col gap-3 py-2"
    >
      {/* Action bar for entire report */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-peach-500 animate-pulse" />
          <span className="text-xs font-semibold text-peach-300 uppercase tracking-wider">
            Autonomous Contract Audit
          </span>
        </div>
        <button
          onClick={handleCopyAll}
          title={copied ? 'Copied Full Report!' : 'Copy Audit Report'}
          className="p-1.5 text-slate-400 hover:text-peach-300 bg-white/5 hover:bg-peach-500/15 border border-white/10 rounded-lg transition-colors cursor-pointer"
        >
          {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Natural Prose Render with Interactive Clickable Inline Citations */}
      <div className="chat-prose w-full">
        <FormattedMessageWithInlineCitations
          content={markdownText}
          citedNodes={auditCitedNodes}
          onCitedClick={onCitedClick}
        />
      </div>

      {/* Follow-up question recommendations (Only shown prior to any user query) */}
      {showSuggestedQueries && (
        <FollowUpRecommendations queries={suggestedQueries} onFillQuery={onFillQuery} />
      )}
    </motion.div>
  );
}

// ─── Smooth Progressive Stream Revealer Hook ──────────────────────────────────
// ─── Human & AI Message Components ───────────────────────────────────────────
function ChatMessageItem({
  msg,
  isEditing,
  editingText,
  onEditingTextChange,
  onStartEdit,
  onCancelEdit,
  onConfirmEdit,
  isStreaming,
  streamingStatus,
  showSuggestedQueries,
  onCitedClick,
  onFillQuery
}: {
  msg: Message;
  isEditing?: boolean;
  editingText?: string;
  onEditingTextChange?: (val: string) => void;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onConfirmEdit?: (val: string) => void;
  isStreaming?: boolean;
  streamingStatus?: string;
  showSuggestedQueries?: boolean;
  onCitedClick: (n: CitedNode) => void;
  onFillQuery: (q: string) => void;
}) {
  const isUser = msg.sender === 'user';
  const [copied, setCopied] = useState(false);
  const smoothContent = msg.content;

  const copyContent = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Human Message
  if (isUser) {
    if (isEditing) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full flex flex-col items-end my-2"
        >
          <div className="w-full max-w-[85%] bg-[#1E1712] border border-peach-500/50 text-slate-100 rounded-2xl p-3.5 shadow-2xl shadow-black/70">
            <textarea
              autoFocus
              value={editingText}
              onChange={(e) => onEditingTextChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (editingText?.trim()) {
                    onConfirmEdit?.(editingText.trim());
                  }
                } else if (e.key === 'Escape') {
                  onCancelEdit?.();
                }
              }}
              rows={3}
              placeholder="Edit your question..."
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-peach-500/70 resize-y leading-relaxed"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-medium border border-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingText?.trim()) {
                    onConfirmEdit?.(editingText.trim());
                  }
                }}
                disabled={!editingText?.trim()}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-400 hover:to-peach-500 text-slate-950 text-xs font-bold transition-all shadow-md shadow-peach-950/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <Check size={13} />
                <span>Update</span>
              </button>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full flex flex-col items-end my-1 group/user"
      >
        <div className="max-w-[80%] bg-[#1A1410] border border-white/12 text-slate-100 rounded-3xl rounded-tr-md px-5 py-3.5 shadow-lg shadow-black/40">
          <p className="text-xs sm:text-sm font-normal leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1 mr-2 opacity-0 group-hover/user:opacity-100 transition-opacity">
          <button
            onClick={onStartEdit}
            className="p-1 text-slate-500 hover:text-peach-300 hover:bg-white/10 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
            title="Edit question in place"
          >
            <Edit2 size={12} />
            <span className="text-[10px] hidden sm:inline">Edit</span>
          </button>
        </div>
      </motion.div>
    );
  }

  // 2. Assistant Response
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex flex-col gap-2 py-3"
    >
      {/* Header bar / Quick copy button */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-peach-400 animate-pulse' : 'bg-peach-400'}`} />
          <span className="text-xs font-semibold text-slate-300">LexiAudit AI</span>
        </div>
        {!isStreaming && (
          <button
            onClick={copyContent}
            title={copied ? 'Copied!' : 'Copy response'}
            className="p-1 text-slate-500 hover:text-peach-300 hover:bg-white/5 rounded transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        )}
      </div>

      {/* Natural Prose Render with In-Text Interactive Citations */}
      <div className="chat-prose w-full">
        {smoothContent ? (
          <div className={`relative transition-opacity duration-200 ${isStreaming ? 'opacity-95' : 'opacity-100'}`}>
            <FormattedMessageWithInlineCitations
              content={smoothContent}
              citedNodes={msg.cited_nodes}
              onCitedClick={onCitedClick}
            />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 py-2.5 px-4 rounded-2xl bg-peach-500/[0.06] border border-peach-500/20 text-peach-300 text-xs shadow-sm max-w-fit"
          >
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <span className="absolute w-full h-full rounded-full bg-peach-400 animate-ping opacity-75" />
              <span className="w-1.5 h-1.5 rounded-full bg-peach-400" />
            </div>
            <span className="font-mono text-[11px] font-medium tracking-wide text-peach-200">
              {streamingStatus || 'Navigating document hierarchy...'}
            </span>
          </motion.div>
        )}
      </div>

      {/* Suggested Follow-up Queries (Only shown if this is the latest assistant response with no newer user query) */}
      {showSuggestedQueries && !isStreaming && msg.suggested_queries && msg.suggested_queries.length > 0 && (
        <FollowUpRecommendations queries={msg.suggested_queries} onFillQuery={onFillQuery} />
      )}
    </motion.div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 py-3 px-4 rounded-2xl bg-peach-500/[0.08] border border-peach-500/20 max-w-fit shadow-md my-2"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-peach-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </motion.div>
  );
}

// ─── Main ChatPanel ──────────────────────────────────────────────────────────
export default function ChatPanel() {
  const {
    messages, setMessages, addMessage, isChatLoading, setChatLoading,
    selectedSessionId, selectedDoc, openPdf, allSessions, setCurrentView,
    renameSession, isBackendOnline
  } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [streamingStatus, setStreamingStatus] = useState('Analyzing contract...');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession = allSessions.find((s) => s.id === selectedSessionId);

  const handleSaveRename = async () => {
    if (!selectedSessionId || !titleInput.trim()) {
      setIsEditingTitle(false);
      return;
    }
    const newTitle = titleInput.trim();
    try {
      await apiUpdateSessionTitle(selectedSessionId, newTitle);
      renameSession(selectedSessionId, newTitle);
    } catch (err) {
      console.error('Failed to rename session:', err);
    } finally {
      setIsEditingTitle(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 40), 120)}px`;
    }
  }, [query]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatLoading]);

  // Pause / Stop generating response
  const handlePause = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setChatLoading(false);
  };

  // Start in-place editing of a user question
  const handleStartEdit = (index: number, currentText: string) => {
    if (isChatLoading) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setChatLoading(false);
    }
    setEditingMessageIndex(index);
    setEditingText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingText('');
  };

  const handleConfirmEdit = async (index: number, newText: string) => {
    if (!newText.trim() || !selectedSessionId || isChatLoading) return;
    
    // Stop any active generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Keep conversation history up to index, update this user message, and discard subsequent responses
    const currentMessages = useWorkspaceStore.getState().messages;
    const historyBefore = currentMessages.slice(0, index);
    
    setEditingMessageIndex(null);
    setEditingText('');

    // Set updated messages array with the new question text
    setMessages([...historyBefore, { sender: 'user', content: newText.trim() }]);
    
    // Trigger fresh stream for the updated question
    await executeStream(newText.trim(), true);
  };

  const executeStream = async (textToSend: string, skipAddUserMessage: boolean = false) => {
    if (!textToSend || !selectedSessionId) return;

    if (!skipAddUserMessage) {
      addMessage({ sender: 'user', content: textToSend });
    }
    
    setChatLoading(true);
    setStreamingStatus('Navigating document hierarchy...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantContent = '';
    let assistantNodes: CitedNode[] = [];
    let assistantSuggested: string[] = [];
    let messageAdded = false;

    try {
      await streamQuery(
        selectedSessionId,
        textToSend,
        (event) => {
          if (event.type === 'status') {
            setStreamingStatus(event.status || 'Synthesizing response...');
          } else if (event.type === 'nodes') {
            assistantNodes = event.cited_nodes || [];
            if (!messageAdded) {
              messageAdded = true;
              addMessage({
                sender: 'assistant',
                content: assistantContent,
                cited_nodes: assistantNodes,
                suggested_queries: assistantSuggested,
              });
            } else {
              setMessages([
                ...useWorkspaceStore.getState().messages.slice(0, -1),
                {
                  sender: 'assistant',
                  content: assistantContent,
                  cited_nodes: assistantNodes,
                  suggested_queries: assistantSuggested,
                }
              ]);
            }
          } else if (event.type === 'token') {
            assistantContent += event.token || '';
            if (!messageAdded) {
              messageAdded = true;
              addMessage({
                sender: 'assistant',
                content: assistantContent,
                cited_nodes: assistantNodes,
                suggested_queries: assistantSuggested,
              });
            } else {
              setMessages([
                ...useWorkspaceStore.getState().messages.slice(0, -1),
                {
                  sender: 'assistant',
                  content: assistantContent,
                  cited_nodes: assistantNodes,
                  suggested_queries: assistantSuggested,
                }
              ]);
            }
          } else if (event.type === 'done') {
            assistantContent = event.answer || assistantContent;
            assistantNodes = event.cited_nodes || assistantNodes;
            assistantSuggested = event.suggested_queries || [];
            if (messageAdded) {
              setMessages([
                ...useWorkspaceStore.getState().messages.slice(0, -1),
                {
                  sender: 'assistant',
                  content: assistantContent,
                  cited_nodes: assistantNodes,
                  suggested_queries: assistantSuggested,
                }
              ]);
            } else {
              messageAdded = true;
              addMessage({
                sender: 'assistant',
                content: assistantContent,
                cited_nodes: assistantNodes,
                suggested_queries: assistantSuggested,
              });
            }
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Stream encountered an error');
          }
        },
        controller.signal
      );
    } catch (err: any) {
      if (
        err.name === 'CanceledError' ||
        err.name === 'AbortError' ||
        err.message?.includes('canceled') ||
        err.message?.includes('aborted')
      ) {
        if (!messageAdded) {
          addMessage({
            sender: 'assistant',
            content: '_Analysis paused by user._',
          });
        }
      } else {
        if (!messageAdded) {
          addMessage({ sender: 'assistant', content: `Error: ${err.message || 'Failed to process query'}` });
        } else {
          setMessages([
            ...useWorkspaceStore.getState().messages.slice(0, -1),
            {
              sender: 'assistant',
              content: `${assistantContent}\n\n_[Stream disconnected: ${err.message || 'Connection lost'}]_`,
              cited_nodes: assistantNodes,
              suggested_queries: assistantSuggested,
            }
          ]);
        }
      }
    } finally {
      setChatLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSend = async () => {
    if (!query.trim() || !selectedSessionId || isChatLoading) return;
    const text = query.trim();
    setQuery('');
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
    await executeStream(text, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExport = async () => {
    if (!selectedSessionId) return;
    setExporting(true);
    try {
      await exportSessionPdf(selectedSessionId);
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleInspectInPdf = (page: string | number = 1, text: string = '') => {
    openPdf({
      node_id: 'view',
      title: selectedDoc?.filename || 'Document',
      page_index: page,
      summary: 'Full Contract Document',
      exact_text: text,
    });
  };

  const handleFillQuery = (q: string) => {
    setQuery(q);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(q.length, q.length);
      }
    }, 50);
  };

  if (!selectedSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0C0806]">
        <div className="w-12 h-12 rounded-2xl bg-peach-500/10 border border-peach-500/20 flex items-center justify-center mb-3">
          <MessageSquare size={22} className="text-peach-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">No Chat Session Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Select an audit chat from the sidebar or choose a contract from the library to begin.
        </p>
        <button
          onClick={() => setCurrentView('library')}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-peach-500/15 text-peach-300 border border-peach-500/30 text-xs font-semibold hover:bg-peach-500/25 transition-all cursor-pointer"
        >
          <FolderOpen size={14} /> Open Contracts Library
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0C0806]">
      {/* Header Bar */}
      <div className="shrink-0 h-16 px-6 border-b border-white/8 bg-[#120D0A]/90 backdrop-blur-xl flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setCurrentView('library')}
            title="Back to Contracts Library"
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-peach-500/20 border border-white/10 hover:border-peach-500/30 flex items-center justify-center shrink-0 text-slate-300 hover:text-peach-300 transition-colors cursor-pointer"
          >
            <FolderOpen size={15} />
          </button>
          
          <div className="min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  className="bg-slate-900 text-slate-100 text-xs px-2 py-0.5 rounded border border-peach-500/50 outline-none w-44 sm:w-64"
                />
                <button
                  onClick={handleSaveRename}
                  className="p-1 text-peach-400 hover:text-peach-300 cursor-pointer"
                  title="Save title"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Cancel"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 group/rename cursor-pointer"
                onClick={() => {
                  setTitleInput(activeSession?.title || 'Contract Audit Session');
                  setIsEditingTitle(true);
                }}
                title="Click to rename this audit chat"
              >
                <h2 className="text-xs sm:text-sm font-bold text-slate-100 group-hover/rename:text-peach-300 transition-colors truncate max-w-[260px] sm:max-w-[420px]">
                  {activeSession?.title || 'Contract Audit Session'}
                </h2>
                <Edit3 size={12} className="text-slate-500 group-hover/rename:text-peach-400 transition-colors shrink-0" />
              </div>
            )}
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[11px] text-slate-400 font-mono break-words leading-tight" title={selectedDoc?.filename}>
                {selectedDoc?.filename ?? 'Contract'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedDoc && (
            <button
              onClick={() => handleInspectInPdf(1, '')}
              title="View PDF file"
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-peach-300 bg-white/5 hover:bg-peach-500/15 border border-white/8 hover:border-peach-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              <Eye size={13} className="text-peach-400" />
              <span className="hidden sm:inline">View PDF</span>
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={exporting || messages.length === 0}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-peach-300 disabled:opacity-40 disabled:cursor-not-allowed bg-white/5 hover:bg-peach-500/15 border border-white/8 hover:border-peach-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            {exporting ? <Loader2 size={13} className="animate-spin text-peach-400" /> : <Download size={13} />}
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Chat Stream: Full Width Scroll Area with Scrollbar at extreme right */}
      <div className="flex-1 overflow-y-auto w-full px-6 py-6">
        <div className="max-w-4xl w-full mx-auto flex flex-col gap-6 pb-12">
          {/* Render Initial Natural Audit Report or Graceful Fallback Card */}
          {selectedDoc && (selectedDoc.risk_analysis?.length || selectedDoc.missing_clauses?.length) ? (
            <NaturalAuditReport
              doc={selectedDoc}
              showSuggestedQueries={messages.length === 0}
              onFillQuery={handleFillQuery}
              onCitedClick={openPdf}
            />
          ) : messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="w-full flex flex-col gap-4 py-8 px-6 rounded-3xl bg-white/[0.02] border border-white/8 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-peach-500/10 border border-peach-500/20 flex items-center justify-center mx-auto text-peach-400 shadow-inner">
                <Sparkles size={22} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  {selectedDoc?.filename ? `Contract Indexed: ${selectedDoc.filename}` : 'Contract Ready for Legal Audit & Review'}
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 max-w-lg mx-auto leading-relaxed">
                  The hierarchical tree has been cached. Ask any question below to inspect liabilities, termination rules, milestone acceptance, or compliance gaps.
                </p>
              </div>
              <div className="w-full max-w-xl mx-auto text-left mt-2">
                <FollowUpRecommendations
                  queries={selectedDoc?.suggested_queries && selectedDoc.suggested_queries.length > 0 ? selectedDoc.suggested_queries : [
                    "What are the primary termination conditions and notice periods?",
                    "What is the total liability limitation or indemnification scope?",
                    "Are there unilateral or non-mutual covenant provisions?"
                  ]}
                  onFillQuery={handleFillQuery}
                />
              </div>
            </motion.div>
          ) : null}

          {/* Subsequent Chat Messages */}
          {messages.map((msg, i) => (
            <ChatMessageItem
              key={i}
              msg={msg}
              isEditing={editingMessageIndex === i}
              editingText={editingText}
              onEditingTextChange={setEditingText}
              onStartEdit={() => handleStartEdit(i, msg.content)}
              onCancelEdit={handleCancelEdit}
              onConfirmEdit={(newText) => handleConfirmEdit(i, newText)}
              isStreaming={isChatLoading && msg.sender === 'assistant' && i === messages.length - 1}
              streamingStatus={streamingStatus}
              showSuggestedQueries={msg.sender === 'assistant' && i === messages.length - 1 && !isChatLoading}
              onCitedClick={openPdf}
              onFillQuery={handleFillQuery}
            />
          ))}

          {isChatLoading && (!messages.length || messages[messages.length - 1]?.sender === 'user') && (
            <TypingIndicator />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Query Input Box with multi-line auto-expand */}
      <div className="shrink-0 px-6 pb-6 pt-2 w-full">
        <div className="max-w-4xl mx-auto glass-strong glow-border rounded-2xl px-4 py-2.5 flex items-center gap-3 bg-[#16100C]/95 shadow-2xl">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder={
              !isBackendOnline
                ? "Legal auditor on its way, hold tight…"
                : "Ask about terms, liabilities, or remedies… (Shift+Enter for newline)"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isChatLoading || !isBackendOnline}
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-100 placeholder-slate-500 outline-none resize-none leading-relaxed disabled:opacity-50 min-h-[40px] max-h-[120px] py-2 overflow-y-auto"
          />

          {isChatLoading ? (
            <button
              onClick={handlePause}
              title="Pause response generation"
              className="shrink-0 px-3 h-9 flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-semibold text-xs rounded-xl transition-all shadow-md shadow-red-950/40 cursor-pointer"
            >
              <Square size={12} className="fill-current text-red-400" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!query.trim() || !isBackendOnline}
              title={!isBackendOnline ? "Legal auditor on its way, hold tight…" : "Send message"}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-400 hover:to-peach-500 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all shadow-md shadow-peach-950/60 cursor-pointer"
            >
              <Send size={16} />
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-2 flex items-center justify-center gap-1.5">
          <Sparkles size={10} className="text-peach-400" />
          <span>Vectorless RAG traces exact contract nodes with grounded evidence citations</span>
        </p>
      </div>
    </div>
  );
}

