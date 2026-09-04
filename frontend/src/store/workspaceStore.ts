import { create } from 'zustand';

export interface RiskClause {
  clause_name: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  section_title: string;
  page_number: string | number;
  extracted_text: string;
  analysis: string;
  remedy_recommendation: string;
}

export interface MissingClause {
  clause_name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  impact_description: string;
  suggested_language: string;
}

export interface CitedNode {
  node_id: string;
  title: string;
  page_index: string | number;
  summary: string;
  exact_text: string;
  source_type?: 'risk_analysis' | 'section' | 'subsection' | 'query';
}

export interface Document {
  id: string;
  filename: string;
  created_at: string;
  suggested_queries?: string[];
  risk_analysis?: RiskClause[];
  missing_clauses?: MissingClause[];
  tree_index?: object[];
}

export interface ChatSession {
  id: string;
  document_id: string;
  title: string;
  created_at: string;
  documents?: {
    id: string;
    filename: string;
  };
}

export interface Message {
  id?: string;
  session_id?: string;
  sender: 'user' | 'assistant';
  content: string;
  reasoning_trace?: string;
  cited_nodes?: CitedNode[];
  suggested_queries?: string[];
  created_at?: string;
}

interface WorkspaceState {
  // Documents
  documents: Document[];
  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  removeDocument: (docId: string) => void;

  // Selected document
  selectedDocId: string | null;
  selectedDoc: Document | null;
  setSelectedDoc: (doc: Document | null) => void;
  updateDocumentData: (doc: Document) => void;
  clearSelectedDoc: () => void;
  isDocLoading: boolean;
  setIsDocLoading: (loading: boolean) => void;

  // Sessions (Flat global list + keyed cache)
  allSessions: ChatSession[];
  setAllSessions: (sessions: ChatSession[]) => void;
  sessions: Record<string, ChatSession[]>; // keyed by doc_id
  setSessions: (docId: string, sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  removeSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;

  // Selected session
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;

  // Active view layout
  currentView: 'chat' | 'library';
  setCurrentView: (view: 'chat' | 'library') => void;
  activeTab: 'all' | 'audit' | 'chat';
  setActiveTab: (tab: 'all' | 'audit' | 'chat') => void;

  // Messages
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
  addMessage: (msg: Message) => void;

  // PDF Preview
  isPdfOpen: boolean;
  pdfCitation: CitedNode | null;
  openPdf: (citation?: CitedNode | null) => void;
  closePdf: () => void;

  // Upload state
  isUploading: boolean;
  uploadProgress: number;
  uploadStage: string;
  setUploadState: (uploading: boolean, progress: number, stage: string) => void;

  // Backend connectivity status
  isBackendOnline: boolean;
  setIsBackendOnline: (online: boolean) => void;

  // Initial Workspace Preload state
  isInitialLoading: boolean;
  setIsInitialLoading: (loading: boolean) => void;

  // Chat loading
  isChatLoading: boolean;
  setChatLoading: (loading: boolean) => void;
}

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  isBackendOnline: true,
  setIsBackendOnline: (online) => set({ isBackendOnline: online }),

  isInitialLoading: true,
  setIsInitialLoading: (loading) => set({ isInitialLoading: loading }),

  currentView: 'chat',
  setCurrentView: (view) => set((s) => ({ currentView: view, isPdfOpen: view === 'library' ? false : s.isPdfOpen })),
  documents: [],
  setDocuments: (docs) =>
    set(() => {
      const seen = new Set<string>();
      const uniqueDocs: Document[] = [];
      const safeList = Array.isArray(docs) ? docs : [];
      for (const d of safeList) {
        if (d && d.id && !seen.has(d.id)) {
          seen.add(d.id);
          uniqueDocs.push(d);
        }
      }
      return { documents: uniqueDocs };
    }),
  addDocument: (doc) =>
    set((s) => ({
      documents: [doc, ...(Array.isArray(s.documents) ? s.documents : []).filter((d) => d.id !== doc.id)],
    })),
  removeDocument: (docId) =>
    set((s) => {
      const docsList = Array.isArray(s.documents) ? s.documents : [];
      const sessList = Array.isArray(s.allSessions) ? s.allSessions : [];
      const remainingDocs = docsList.filter((d) => d.id !== docId);
      const isSelected = s.selectedDocId === docId;
      const remainingSessions = sessList.filter((sess) => sess.document_id !== docId);
      const newDocSessions = { ...s.sessions };
      delete newDocSessions[docId];

      return {
        documents: remainingDocs,
        allSessions: remainingSessions,
        sessions: newDocSessions,
        selectedDocId: isSelected ? null : s.selectedDocId,
        selectedDoc: isSelected ? null : s.selectedDoc,
        selectedSessionId: isSelected ? null : s.selectedSessionId,
        messages: isSelected ? [] : s.messages,
        isPdfOpen: isSelected ? false : s.isPdfOpen,
      };
    }),

  selectedDocId: null,
  selectedDoc: null,
  isDocLoading: false,
  setIsDocLoading: (loading) => set({ isDocLoading: loading }),
  setSelectedDoc: (doc) =>
    set({
      selectedDocId: doc ? doc.id : null,
      selectedDoc: doc,
    }),
  updateDocumentData: (doc) =>
    set((s) => {
      const docsList = Array.isArray(s.documents) ? s.documents : [];
      return {
        selectedDoc: s.selectedDocId === doc.id ? doc : s.selectedDoc,
        documents: docsList.map((d) => (d.id === doc.id ? { ...d, ...doc } : d)),
      };
    }),
  clearSelectedDoc: () =>
    set({
      selectedDocId: null,
      selectedDoc: null,
      messages: [],
      selectedSessionId: null,
      isPdfOpen: false,
    }),

  allSessions: [],
  setAllSessions: (sessions) => set({ allSessions: Array.isArray(sessions) ? sessions : [] }),
  sessions: {},
  setSessions: (docId, sessions) =>
    set((s) => ({
      sessions: { ...s.sessions, [docId]: Array.isArray(sessions) ? sessions : [] },
    })),
  addSession: (session) =>
    set((s) => {
      const docSessions = Array.isArray(s.sessions[session.document_id]) ? s.sessions[session.document_id] : [];
      const allSessList = Array.isArray(s.allSessions) ? s.allSessions : [];
      return {
        allSessions: [session, ...allSessList.filter((x) => x.id !== session.id)],
        sessions: {
          ...s.sessions,
          [session.document_id]: [session, ...docSessions.filter((x) => x.id !== session.id)],
        },
      };
    }),
  removeSession: (sessionId) =>
    set((s) => {
      const isSelected = s.selectedSessionId === sessionId;
      const allSessList = Array.isArray(s.allSessions) ? s.allSessions : [];
      const updatedAll = allSessList.filter((sess) => sess.id !== sessionId);
      const updatedSessions: Record<string, ChatSession[]> = {};
      for (const [docId, list] of Object.entries(s.sessions)) {
        const safeList = Array.isArray(list) ? list : [];
        updatedSessions[docId] = safeList.filter((sess) => sess.id !== sessionId);
      }
      return {
        allSessions: updatedAll,
        sessions: updatedSessions,
        selectedSessionId: isSelected ? null : s.selectedSessionId,
        messages: isSelected ? [] : s.messages,
      };
    }),
  renameSession: (sessionId, newTitle) =>
    set((s) => {
      const allSessList = Array.isArray(s.allSessions) ? s.allSessions : [];
      const updatedAll = allSessList.map((sess) =>
        sess.id === sessionId ? { ...sess, title: newTitle } : sess
      );
      const updatedSessions: Record<string, ChatSession[]> = {};
      for (const [docId, list] of Object.entries(s.sessions)) {
        const safeList = Array.isArray(list) ? list : [];
        updatedSessions[docId] = safeList.map((sess) =>
          sess.id === sessionId ? { ...sess, title: newTitle } : sess
        );
      }
      return {
        allSessions: updatedAll,
        sessions: updatedSessions,
      };
    }),

  selectedSessionId: null,
  setSelectedSessionId: (id) => set({ selectedSessionId: id }),

  activeTab: 'all',
  setActiveTab: (tab) => set({ activeTab: tab }),

  messages: [],
  setMessages: (msgs) => set({ messages: Array.isArray(msgs) ? msgs : [] }),
  addMessage: (msg) => set((s) => ({ messages: [...(Array.isArray(s.messages) ? s.messages : []), msg] })),

  isPdfOpen: false,
  pdfCitation: null,
  openPdf: (citation = null) => set({ isPdfOpen: true, pdfCitation: citation || null }),
  closePdf: () => set({ isPdfOpen: false, pdfCitation: null }),

  isUploading: false,
  uploadProgress: 0,
  uploadStage: '',
  setUploadState: (uploading, progress, stage) =>
    set({ isUploading: uploading, uploadProgress: progress, uploadStage: stage }),

  isChatLoading: false,
  setChatLoading: (loading) => set({ isChatLoading: loading }),
}));

export default useWorkspaceStore;
