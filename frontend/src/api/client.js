import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // 依赖 Vite proxy
  timeout: 60000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// --- RAG API (文件上传) ---
export const ragAPI = {
  uploadFile: (file, sessionId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    return apiClient.post('/api/v1/rag/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

// --- Streaming API ---
export const streamEndpoints = {
  outline: '/api/v1/stream/outline',
  content: '/api/v1/stream/content',
};

// --- Task API ---
export const generationAPI = {
  exportPpt: (contentData) =>
    apiClient.post('/api/v1/generation/export', { content: contentData }),
};

export const taskAPI = {
  getTaskStatus: (taskId) => apiClient.get(`/api/v1/tasks/${taskId}`),
  downloadPPT: (taskId) => apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};
