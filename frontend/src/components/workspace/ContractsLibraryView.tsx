import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, FileText, Plus, Eye, Trash2, Search,
  Calendar, MessageSquarePlus
} from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import type { Document } from '../../store/workspaceStore';
import { createSession as apiCreateSession, deleteDocument as apiDeleteDocument } from '../../api/client';
import UploadModal from './UploadModal';
import DeleteConfirmModal from './DeleteConfirmModal';

function formatDate(iso: string) {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function ContractsLibraryView() {
  const {
    documents, selectedDocId, setSelectedDoc,
    removeDocument, openPdf, allSessions,
    addSession, setSelectedSessionId, setMessages, setCurrentView
  } = useWorkspaceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter documents by search
  const filteredDocs = documents.filter((d) =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInspectPdf = (doc: Document) => {
    setSelectedDoc(doc);
    openPdf(null);
  };

  const handleCreateNewAuditChat = async (doc: Document) => {
    setSelectedDoc(doc);
    try {
      // Generate intelligent, non-duplicate session title
      const existingDocSessions = allSessions.filter((s) => s.document_id === doc.id);
      const sessionNumber = existingDocSessions.length + 1;
      const baseName = doc.filename.replace(/\.pdf$/i, '').slice(0, 20);
      const title = sessionNumber > 1 ? `Audit ${sessionNumber} – ${baseName}` : `Audit – ${baseName}`;

      const res = await apiCreateSession(doc.id, title);
      addSession(res.data);
      setSelectedSessionId(res.data.id);
      setMessages([]);
      setCurrentView('chat');
    } catch (err) {
      console.error('Failed to create new audit chat session:', err);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiDeleteDocument(deleteTarget.id);
      removeDocument(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete document:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0C0806] overflow-y-auto">
      {/* Top Header Bar */}
      <div className="shrink-0 h-16 glass-strong border-b border-white/8 px-8 flex items-center justify-between gap-4 bg-slate-950/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-peach-500/15 border border-peach-500/25 flex items-center justify-center">
            <FolderOpen size={18} className="text-peach-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Contracts Library</span>
              <span className="text-xs font-mono font-normal text-peach-300 bg-peach-500/10 border border-peach-500/20 px-2 py-0.5 rounded-full">
                {documents.length} {documents.length === 1 ? 'Contract' : 'Contracts'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">View and manage your stored contract documents</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative w-64 hidden sm:block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search contracts by name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-slate-900/90 text-slate-200 placeholder-slate-500 outline-none border border-white/8 focus:border-peach-500/50 transition-colors"
            />
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-400 hover:to-peach-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-peach-950/60 transition-all hover:scale-105 cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Upload Contract</span>
          </button>
        </div>
      </div>

      {/* Main List View Area */}
      <div className="p-8 max-w-6xl w-full mx-auto">
        {documents.length === 0 ? (
          /* Empty state */
          <div className="max-w-md mx-auto my-16 text-center glass-card rounded-3xl p-10 border border-white/8 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-peach-500/10 border border-peach-500/20 flex items-center justify-center text-peach-400">
              <FolderOpen size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 mb-1">No Contracts in Library</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Upload your contract PDFs to securely store, inspect, and organize them in your library.
              </p>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-peach-500 to-peach-600 hover:from-peach-400 hover:to-peach-500 text-slate-950 font-bold text-xs px-5 py-3 rounded-xl shadow-lg shadow-peach-950/60 transition-all hover:scale-105 cursor-pointer mt-2"
            >
              <Plus size={16} />
              <span>Upload Contract PDF</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* List Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/8">
              <div className="col-span-5 sm:col-span-6 flex items-center gap-2">
                <span>Contract Name</span>
              </div>
              <div className="col-span-3 sm:col-span-3 flex items-center gap-1.5">
                <Calendar size={12} className="text-slate-500" />
                <span>Date Added</span>
              </div>
              <div className="col-span-4 sm:col-span-3 text-right">
                <span>Actions</span>
              </div>
            </div>

            {/* List Rows */}
            <div className="flex flex-col gap-2.5">
              {filteredDocs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No contracts matched your search query "{searchQuery}".
                </div>
              ) : (
                filteredDocs.map((doc) => {
                  const isSelected = selectedDocId === doc.id;

                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl glass-card border transition-all duration-150 group ${
                        isSelected
                          ? 'border-peach-500/40 bg-peach-500/[0.04]'
                          : 'border-white/6 hover:border-peach-500/25 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Column 1: Document Filename & Icon */}
                      <div className="col-span-5 sm:col-span-6 flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-peach-500/10 border border-peach-500/20 flex items-center justify-center shrink-0 text-peach-400 group-hover:scale-105 transition-transform">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0 pr-2">
                          <p
                            className="text-sm font-semibold text-slate-100 truncate group-hover:text-peach-200 transition-colors"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            PDF Document
                          </p>
                        </div>
                      </div>

                      {/* Column 2: Date Added */}
                      <div className="col-span-3 sm:col-span-3 min-w-0">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-300 font-medium">
                            {formatDate(doc.created_at)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatTime(doc.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Column 3: Actions (Audit, View PDF, Delete) */}
                      <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-1.5 sm:gap-2">
                        {/* New Audit Chat Button */}
                        <button
                          onClick={() => handleCreateNewAuditChat(doc)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 bg-white/5 hover:bg-peach-500/15 border border-white/8 hover:border-peach-500/30 transition-all cursor-pointer shadow-sm hover:scale-105 shrink-0"
                          title="Start new audit chat"
                        >
                          <MessageSquarePlus size={14} className="text-peach-400" />
                          <span className="hidden sm:inline">Audit</span>
                        </button>

                        {/* View PDF Button */}
                        <button
                          onClick={() => handleInspectPdf(doc)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-peach-300 bg-white/5 hover:bg-peach-500/15 border border-white/8 hover:border-peach-500/30 transition-all cursor-pointer shadow-sm hover:scale-105 shrink-0"
                          title="View PDF document"
                        >
                          <Eye size={14} className="text-peach-400" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        {/* Delete Contract Button */}
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/25 transition-all cursor-pointer shrink-0"
                          title="Delete contract"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadOpen && <UploadModal onClose={() => setIsUploadOpen(false)} />}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Contract Document"
        description="This will permanently delete this contract from storage and remove all associated records from the database."
        itemName={deleteTarget?.filename || ''}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

