import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthStore from '../store/authStore';
import useWorkspaceStore from '../store/workspaceStore';
import { listDocuments, listAllSessions, getDocument, checkBackendHealth } from '../api/client';
import Sidebar from '../components/workspace/Sidebar';
import ChatPanel from '../components/workspace/ChatPanel';
import ContractsLibraryView from '../components/workspace/ContractsLibraryView';
import PdfModalViewer from '../components/workspace/PdfModalViewer';
import RagWelcomeScreen from '../components/workspace/RagWelcomeScreen';
import { supabase } from '../api/supabase';

export default function Workspace() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const {
    setDocuments,
    setAllSessions,
    selectedDoc, selectedDocId,
    selectedSessionId,
    updateDocumentData,
    setIsDocLoading,
    currentView,
    isPdfOpen,
    setIsBackendOnline,
    setIsInitialLoading
  } = useWorkspaceStore();

  // Polling backend health continuously
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      const healthy = await checkBackendHealth();
      if (isMounted) {
        setIsBackendOnline(healthy);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setIsBackendOnline]);

  // Load initial data on mount (or re-load when backend comes back online)
  useEffect(() => {
    (async () => {
      setIsInitialLoading(true);
      try {
        const [docsRes, sessionsRes] = await Promise.all([
          listDocuments(),
          listAllSessions(),
        ]);
        setDocuments(docsRes.data || []);
        setAllSessions(sessionsRes.data || []);
        setIsBackendOnline(true);
      } catch (err: any) {
        console.warn('Initial data load notice (backend may still be connecting):', err);
        if (err?.status === 401 || err?.response?.status === 401) {
          logout();
          navigate('/auth');
        } else {
          // If connection failed (502 / network error), mark backend as not online yet
          setIsBackendOnline(false);
        }
      } finally {
        setIsInitialLoading(false);
      }
    })();
  }, [setIsBackendOnline, setIsInitialLoading]);

  // Ensure full document data (with risk_analysis) is populated when selected
  useEffect(() => {
    if (!selectedDocId) return;
    if (!selectedDoc?.risk_analysis || selectedDoc.risk_analysis.length === 0) {
      (async () => {
        setIsDocLoading(true);
        try {
          const res = await getDocument(selectedDocId);
          updateDocumentData(res.data);
        } catch (err) {
          console.error('Failed to lazy load document:', err);
        } finally {
          setIsDocLoading(false);
        }
      })();
    }
  }, [selectedDocId]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {}
    logout();
    navigate('/auth');
  };

  return (
    <div className="h-screen bg-[#0C0806] text-slate-100 flex overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar onLogout={handleLogout} />

      {/* Main Content Area: Welcome Screen / Contracts Library / Split-View Chat */}
      <div className="flex-1 flex flex-row overflow-hidden relative min-w-0">
        <AnimatePresence mode="wait">
          {currentView === 'library' ? (
            /* Separate View: Contracts Library Dashboard View */
            <motion.div
              key="library-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full h-full flex flex-col min-w-0"
            >
              <ContractsLibraryView />
            </motion.div>
          ) : selectedSessionId && selectedDoc ? (
            /* Split View: Active Chat Stream on Left + Dynamic PDF Side Panel on Right */
            <motion.div
              key={`chat-view-${selectedSessionId}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden w-full"
            >
              <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                <ChatPanel />
              </div>
              {isPdfOpen && (
                <div className="w-full md:w-[50%] lg:w-[52%] max-w-[850px] min-w-[380px] h-full flex flex-col border-l border-white/10 bg-[#0C0806] z-20 shrink-0">
                  <PdfModalViewer isSidePanel={true} />
                </div>
              )}
            </motion.div>
          ) : (
            /* Fresh Login / Page Reload Default View: Illustrated Welcome Screen */
            <motion.div
              key="welcome-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full h-full flex flex-col min-w-0"
            >
              <RagWelcomeScreen />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Centered PDF Viewer Modal with background blur (Only for Contracts Library View) */}
      {currentView === 'library' && isPdfOpen && <PdfModalViewer isSidePanel={false} />}
    </div>
  );
}
