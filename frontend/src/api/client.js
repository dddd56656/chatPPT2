/**
 * [CTO Refactor] V3 Client
 * 职责: 定义 API 端点。
 * 变更: 新增流式端点定义，保留 Task API 用于导出。
 */
import axios from 'axios';

// 基础配置：依赖 Vite proxy 转发请求
const apiClient = axios.create({
  baseURL: '',
  timeout: 60000,
});

// 响应拦截器：统一错误日志
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// --- V3 流式端点 (供 useStream 使用) ---
export const streamEndpoints = {
  outline: '/api/v1/stream/outline',
  content: '/api/v1/stream/content',
};

// --- V3 任务 API (仅用于 CPU 密集型导出任务) ---
export const taskAPI = {
  // 触发导出
  exportPpt: (contentData) =>
    apiClient.post('/api/v1/generation/export', { content: contentData }),

  // 轮询状态
  getTaskStatus: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}`),

  // 下载文件
  downloadPPT: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};
