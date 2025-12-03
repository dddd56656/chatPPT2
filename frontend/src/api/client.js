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

// --- V3 流式端点 (Core) ---
// 前端将通过 useStream Hook 直接连接这些端点
export const streamEndpoints = {
  outline: '/api/v1/stream/outline',
  content: '/api/v1/stream/content',
};

// --- V3 任务 API (Export Only) ---
// 仅用于 PPT 导出这种非流式的耗时任务
export const generationAPI = {
  exportPpt: (contentData) =>
    apiClient.post('/api/v1/generation/export', { content: contentData }),
};

export const taskAPI = {
  getTaskStatus: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}`),

  downloadPPT: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};
