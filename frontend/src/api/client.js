import axios from 'axios';

const apiClient = axios.create({
  baseURL: '',
  timeout: 60000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// --- V3 流式端点 (预留) ---
export const streamEndpoints = {
  outline: '/api/v1/stream/outline',
  content: '/api/v1/stream/content',
};

// --- V2 异步生成 API ---
export const generationAPI = {
  generateOutline_conversational: (chatHistory) =>
    apiClient.post('/api/v1/generation/outline_conversational', {
      history: chatHistory
    }),

  generateContent_conversational: (chatHistory, currentSlides) =>
    apiClient.post('/api/v1/generation/content_conversational', {
      history: chatHistory,
      current_slides: currentSlides
    }),

  exportPpt: (contentData) =>
    apiClient.post('/api/v1/generation/export', { content: contentData }),
};

// --- V1/V2 任务管理 API ---
export const taskAPI = {
  getTaskStatus: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}`),

  downloadPPT: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};
