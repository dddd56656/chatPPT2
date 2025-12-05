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
// [Retention]: 仍用于上传参考文档
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
// [Retention]: 核心 AI 生成流
export const streamEndpoints = {
  outline: '/api/v1/stream/outline',
  content: '/api/v1/stream/content',
};

// [CTO Cleanup]: Removed deprecated 'generationAPI' and 'taskAPI' (SSR logic)
