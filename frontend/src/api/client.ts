import axios from 'axios';
import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  let token = sessionStorage.getItem('lexiaudit_token');

  // If supabase has an active session in this tab/window, use the latest access token
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
      sessionStorage.setItem('lexiaudit_token', token);
    }
  } catch (e) {
    // fallback to stored session token
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config || {};

    // 1. Auto-refresh token on 401 Unauthorized once
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (session && !error) {
          sessionStorage.setItem('lexiaudit_token', session.access_token);
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh session:', refreshErr);
      }
    }

    // 2. Retry transient server waking / cold-start errors (502, 503, 504, Network Error) up to 2 times
    const isTransientError =
      !err.response ||
      err.message === 'Network Error' ||
      [502, 503, 504].includes(err.response?.status);

    originalRequest._retryCount = originalRequest._retryCount || 0;

    if (isTransientError && originalRequest._retryCount < 3 && originalRequest.url !== '/health') {
      originalRequest._retryCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return api(originalRequest);
    }

    // 3. Format clear, human-friendly exception messages for Uploads, Audits, & Queries
    let message = err.response?.data?.detail || err.response?.data?.message || err.message || 'An unexpected error occurred.';

    if (err.message === 'Network Error' || err.response?.status === 503 || err.response?.status === 502) {
      message = 'Backend core server is waking up on Render. Please wait 15–30 seconds and try again.';
    } else if (err.response?.status === 504) {
      message = 'The contract audit request timed out. Please retry the upload or audit action.';
    } else if (err.response?.status === 413) {
      message = 'The uploaded document exceeds the maximum allowed file size (50MB).';
    } else if (err.response?.status === 415) {
      message = 'Invalid file format. Please upload a valid PDF document.';
    } else if (err.response?.status === 400 && message.includes('safety')) {
      message = 'Query blocked by security guardrails. Please ask a contract-focused legal audit question.';
    }

    const apiError: any = new Error(message);
    apiError.status = err.response?.status;
    apiError.code = err.response?.data?.error?.code || 'API_ERROR';
    apiError.response = err.response;
    return Promise.reject(apiError);
  }
);

// ─── Health ───────────────────────────────────────────────────────────────────
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    const res = await axios.get(`${BASE_URL}/health`, { timeout: 6000 });
    return res.status === 200 && res.data?.status === 'healthy';
  } catch {
    return false;
  }
};

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post('/api/auth/login', { email, password });

export const signup = (email: string, password: string) =>
  api.post('/api/auth/signup', { email, password });

// ─── Documents ────────────────────────────────────────────────────────────────
export const uploadDocument = (
  formData: FormData,
  onProgress?: (pct: number) => void
) =>
  api.post('/api/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

export const listDocuments = () => api.get('/api/documents');

export const getDocument = (docId: string) => api.get(`/api/documents/${docId}`);

export const deleteDocument = (docId: string) => api.delete(`/api/documents/${docId}`);

export const fetchDocumentFileBlob = (docId: string) =>
  api.get(`/api/documents/${docId}/file`, { responseType: 'blob' });

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const createSession = (documentId: string, title?: string) =>
  api.post('/api/chat/sessions', { document_id: documentId, title });

export const listAllSessions = () => api.get('/api/chat/sessions-all');

export const updateSessionTitle = (sessionId: string, title: string) =>
  api.patch(`/api/chat/sessions/${sessionId}`, { title });

export const deleteSession = (sessionId: string) =>
  api.delete(`/api/chat/sessions/${sessionId}`);

export const listSessions = (docId: string) => api.get(`/api/chat/sessions/${docId}`);

export const getMessages = (sessionId: string) => api.get(`/api/chat/messages/${sessionId}`);

export const streamQuery = async (
  sessionId: string,
  query: string,
  onEvent: (event: { type: string; [key: string]: any }) => void,
  signal?: AbortSignal
): Promise<void> => {
  try {
    const res = await api.post('/api/chat/query', { session_id: sessionId, query }, { signal });
    const data = res.data;
    onEvent({
      type: 'done',
      answer: data.answer || 'No response generated.',
      cited_nodes: data.cited_nodes || [],
      suggested_queries: data.suggested_queries || [],
    });
  } catch (err: any) {
    if (axios.isCancel(err) || err.name === 'CanceledError' || err.name === 'AbortError') {
      throw err;
    }
    const errorMsg = err.message || 'Failed to complete query. Please check your backend connection.';
    onEvent({
      type: 'error',
      error: errorMsg,
    });
    throw new Error(errorMsg);
  }
};

export const exportSessionPdf = async (sessionId: string): Promise<void> => {
  const res = await api.get(`/api/chat/export/${sessionId}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LexiAudit_Report_${sessionId.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default api;
