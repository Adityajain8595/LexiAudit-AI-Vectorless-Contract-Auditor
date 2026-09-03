import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Scale, Plus, MessageSquare, FileText, LogOut, User,
  Trash2, Edit3, Check, X, Sparkles, FolderOpen, ArrowRight
} from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import type { Document, ChatSession } from '../../store/workspaceStore';
import useAuthStore from '../../store/authStore';
import {
  deleteDocument as apiDeleteDocument,
  deleteSession as apiDeleteSession,
  updateSessionTitle as apiUpdateSessionTitle,
  createSession as apiCreateSession,
  getDocument as apiGetDocument,
  getMessages as apiGetMessages,
} from '../../api/client';
import UploadModal from './UploadModal';
import DeleteConfirmModal from './DeleteConfirmModal';

function formatDate(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Sidebar({ onLogout }: { onLogout: () => void }) {
  const {
    documents, selectedDocId, selectedSessionId,
    setSelectedDoc, updateDocumentData, setSelectedSessionId, setMessages,
    allSessions, addSession, removeSession, renameSession, removeDocument,
    setIsDocLoading, currentView, setCurrentView,
    isInitialLoading, clearSelectedDoc
  } = useWorkspaceStore();
  const { user } = useAuthStore();

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDocPickerOpen, setIsDocPickerOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const userAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatar;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.custom_claims?.name ||
    (user?.email ? user.email.split('@')[0] : 'Counsel');

  const userInitials = displayName
    ? displayName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase())
        .join('')
    : '';

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'document' | 'session';
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Session rename state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Select document and lazy-load full audit data
  const handleSelectDoc = async (doc: Document) => {
    setSelectedDoc(doc);
    if (!doc.risk_analysis || doc.risk_analysis.length === 0) {
      setIsDocLoading(true);
      try {
        const full = await apiGetDocument(doc.id);
        updateDocumentData(full.data);
      } catch (err) {
        console.error('Failed to load full doc audit:', err);
      } finally {
        setIsDocLoading(false);
      }
    }
  };

  // Select session and auto-select its document
  const handleSelectSession = async (session: ChatSession) => {
    setSelectedSessionId(session.id);
    setCurrentView('chat');
    
    let doc = documents.find((d) => d.id === session.document_id);
    if (doc) {
      if (selectedDocId !== doc.id) {
        await handleSelectDoc(doc);
      }
    } else {
      try {
        const docRes = await apiGetDocument(session.document_id);
        doc = docRes.data;
        if (doc) {
          await handleSelectDoc(doc);
        }
      } catch (err) {
        console.error('Failed to load session doc:', err);
      }
    }

    // Load messages
    try {
      const res = await apiGetMessages(session.id);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    }
  };

  // Start new session
  const handleNewSessionClick = () => {
    if (documents.length === 0) {
      setIsUploadOpen(true);
      return;
    }
    if (selectedDocId) {
      handleCreateSessionForDoc(selectedDocId);
    } else {
      setIsDocPickerOpen(true);
    }
  };

  const handleCreateSessionForDoc = async (docId: string) => {
    setIsDocPickerOpen(false);
    const targetDoc = documents.find((d) => d.id === docId);
    if (targetDoc && selectedDocId !== docId) {
      await handleSelectDoc(targetDoc);
    }
    try {
      const title = `Audit – ${targetDoc?.filename ? targetDoc.filename.slice(0, 20) : 'Contract'}`;
      const res = await apiCreateSession(docId, title);
      addSession(res.data);
      setSelectedSessionId(res.data.id);
      setMessages([]);
      setCurrentView('chat');
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  // Confirm delete
  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'document') {
        await apiDeleteDocument(deleteTarget.id);
        removeDocument(deleteTarget.id);
      } else {
        await apiDeleteSession(deleteTarget.id);
        removeSession(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed delete operation:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Rename session
  const handleSaveRename = async (sessionId: string) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      await apiUpdateSessionTitle(sessionId, editingTitle.trim());
      renameSession(sessionId, editingTitle.trim());
    } catch (err) {
      console.error('Failed to rename session:', err);
    } finally {
      setEditingSessionId(null);
    }
  };

  return (
    <>
      <aside className="w-80 shrink-0 h-full glass-strong border-r border-white/8 flex flex-col z-20 select-none bg-slate-950/80">
        {/* Brand Header - Clicking returns to Welcome Screen */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/8 shrink-0 bg-slate-950/60">
          <button
            onClick={() => {
              clearSelectedDoc();
              setCurrentView('chat');
            }}
            className="flex items-center gap-3 text-left cursor-pointer group transition-opacity hover:opacity-90"
            title="Go to Welcome Screen"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-peach-400 to-peach-700 flex items-center justify-center shadow-lg shadow-peach-950/50 group-hover:scale-105 transition-transform">
              <Scale size={18} className="text-slate-950" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-wide text-slate-100 block leading-tight">
                LexiAudit <span className="text-peach-400 text-sm font-sans font-medium uppercase tracking-wider ml-0.5">AI</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-tight block">
                Vectorless Intelligence
              </span>
            </div>
          </button>
        </div>

        {/* Primary Action Navigation Block */}
        <div className="p-3.5 flex flex-col gap-2.5 shrink-0 border-b border-white/6">
          {/* Contracts Library Main Tab (Switches to Grid View in Main Window) */}
          <button
            onClick={() => setCurrentView('library')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'library'
                ? 'bg-peach-500/15 border-peach-500/40 text-peach-300 shadow-md shadow-peach-950/50'
                : 'bg-slate-900/60 hover:bg-slate-850 border-white/5 text-slate-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FolderOpen size={16} className={currentView === 'library' ? 'text-peach-400' : 'text-slate-400'} />
              <span>Contracts Library</span>
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              currentView === 'library'
                ? 'bg-peach-500/20 text-peach-300 border-peach-500/30'
                : 'bg-slate-800 text-slate-400 border-white/5'
            }`}>
              {isInitialLoading ? (
                <span className="inline-block w-2.5 h-2.5 bg-slate-600 rounded-full animate-pulse" />
              ) : (
                documents.length
              )}
            </span>
          </button>

          {/* New Audit Session CTA Button */}
          <button
            onClick={handleNewSessionClick}
            className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-peach-600 to-peach-500 hover:from-peach-500 hover:to-peach-400 text-slate-950 font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-peach-950/50 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
          >
            <Sparkles size={15} />
            <span>New Audit Session</span>
          </button>
        </div>

        {/* AUDIT CHATS SECTION */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <MessageSquare size={13} className="text-peach-400" />
              Audit Chats {isInitialLoading ? '' : `(${allSessions.length})`}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 mt-1">
            {isInitialLoading ? (
              <div className="flex flex-col gap-2 p-1">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-11 rounded-xl bg-slate-900/40 border border-white/5 p-2.5 flex flex-col justify-between animate-pulse"
                  >
                    <div className="w-2/3 h-2.5 bg-slate-800/80 rounded" />
                    <div className="w-1/2 h-2 bg-slate-800/40 rounded" />
                  </div>
                ))}
              </div>
            ) : allSessions.length === 0 ? (
              <div className="px-3 py-6 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                <p className="text-[11px] text-slate-500">No active audit chats yet.</p>
                <p className="text-[10px] text-slate-600 mt-0.5">Click "New Audit Session" to start.</p>
              </div>
            ) : (
              allSessions.map((sess) => {
                const isSelected = selectedSessionId === sess.id && currentView === 'chat';
                const isEditing = editingSessionId === sess.id;
                const docName = sess.documents?.filename || documents.find((d) => d.id === sess.document_id)?.filename || 'Contract';

                return (
                  <div
                    key={sess.id}
                    className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all duration-150 border ${
                      isSelected
                        ? 'bg-peach-500/15 border-peach-500/35 text-peach-200 shadow-sm'
                        : 'hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 border-white/5 bg-slate-950/40'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          autoFocus
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(sess.id)}
                          className="flex-1 bg-slate-900 text-slate-100 text-xs px-2 py-1 rounded border border-peach-500/40 outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(sess.id)}
                          className="p-1 text-peach-400 hover:text-peach-300 cursor-pointer"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setEditingSessionId(null)}
                          className="p-1 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleSelectSession(sess)}
                          className="flex-1 min-w-0 text-left cursor-pointer mr-2"
                        >
                          <p className={`font-semibold truncate ${isSelected ? 'text-peach-200' : 'text-slate-200'}`}>
                            {sess.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-peach-400/80 font-mono truncate max-w-[130px]">
                              {docName}
                            </span>
                            <span className="text-[10px] text-slate-500">·</span>
                            <span className="text-[10px] text-slate-500">
                              {formatDate(sess.created_at)}
                            </span>
                          </div>
                        </button>

                        {/* Inline Actions on Hover (Zero dropdown cut-offs!) */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSessionId(sess.id);
                              setEditingTitle(sess.title);
                            }}
                            className="p-1 text-slate-400 hover:text-peach-300 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="Rename session"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                type: 'session',
                                id: sess.id,
                                name: sess.title,
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete session"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="p-3.5 border-t border-white/8 shrink-0 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {userAvatar && !avatarError ? (
              <img
                src={userAvatar}
                alt="Profile"
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-8 h-8 rounded-xl object-cover border border-peach-500/30 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-peach-500/10 border border-peach-500/20 flex items-center justify-center text-peach-400 font-bold text-xs shrink-0">
                {userInitials ? (
                  <span>{userInitials}</span>
                ) : (
                  <User size={15} />
                )}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 truncate font-mono">
                {user?.email || 'authenticated'}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign Out"
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      {/* Upload Modal */}
      {isUploadOpen && <UploadModal onClose={() => setIsUploadOpen(false)} />}

      {/* Document Picker Modal for "New Audit Session" */}
      {isDocPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md glass-card rounded-3xl p-6 border border-peach-500/30 shadow-2xl bg-slate-950"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText size={16} className="text-peach-400" />
                Select Contract for New Audit Chat
              </h3>
              <button
                onClick={() => setIsDocPickerOpen(false)}
                className="p-1 text-slate-500 hover:text-slate-300 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto mb-4">
              {documents.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleCreateSessionForDoc(d.id)}
                  className="w-full p-3 rounded-2xl bg-slate-900/80 hover:bg-peach-500/10 border border-white/5 hover:border-peach-500/30 text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate group-hover:text-peach-200">
                      {d.filename}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {formatDate(d.created_at)}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-slate-500 group-hover:text-peach-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/8">
              <button
                onClick={() => {
                  setIsDocPickerOpen(false);
                  setIsUploadOpen(true);
                }}
                className="text-xs text-peach-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Plus size={13} /> Upload another contract
              </button>
              <button
                onClick={() => setIsDocPickerOpen(false)}
                className="px-4 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title={deleteTarget?.type === 'document' ? 'Delete Contract Document' : 'Delete Audit Session'}
        description={
          deleteTarget?.type === 'document'
            ? 'This will permanently remove the contract from storage and remove all associated audit sessions from the database.'
            : 'This will permanently delete this audit conversation thread and its reasoning history.'
        }
        itemName={deleteTarget?.name || ''}
        isLoading={isDeleting}
        onConfirm={executeDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
