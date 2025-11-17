/**
 * [CTO 注释与修复]
 * 职责: API 服务层。
 * [V2 重构]: 已移除所有 V1 (Batch) API 调用。
 * [V2 修复]: `baseURL` 设置为 `''` 以激活 Vite 代理。
 */
import axios from 'axios';

// [CTO 修复] baseURL 设置为 '' 来启用 Vite 代理
const apiClient = axios.create({
  baseURL: '',
  timeout: 60000,
});

// 请求拦截器 (日志)
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 (日志)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// --- API 1: 任务轮询与下载 (Task API) ---
// (由 useTask.js 和 App.jsx 的最后一步使用)
export const taskAPI = {
  getTaskStatus: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}`),

  downloadPPT: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};


// --- API 2: V2 对话式生成 (Generation API) ---
// (由 App.jsx 的聊天步骤使用)
export const generationAPI = {
  /**
   * [V2 节点 1] (异步)
   * 提交聊天记录，启动大纲生成任务。
   */
  generateOutline_conversational: (chatHistory) =>
    apiClient.post('/api/v1/generation/outline_conversational', {
      history: chatHistory
    }),

  /**
   * [V2 节点 2] (异步)
   * 提交聊天记录和当前幻灯片，启动内容修改任务。
   */
  generateContent_conversational: (chatHistory, currentSlides) =>
    apiClient.post('/api/v1/generation/content_conversational', {
      history: chatHistory,
      current_slides: currentSlides
    }),

  /**
   * [V2 节点 3] (异步)
   * 提交最终内容，启动导出任务。
   */
  exportPpt: (contentData) =>
    apiClient.post('/api/v1/generation/export', { content: contentData }),
};
