/**
 * [CTO 注释]
 * 职责: API 服务层。
 * * [已修复]
 * 1.  (P1) `baseURL`: 设置为 `''`。这 *至关重要*，它将强制 axios 
 * 使用相对路径，从而激活 `vite.config.js` 中定义的 'proxy'。
 * 这将解决所有开发环境中的 CORS 跨域问题。
 * 2.  (P1) `paths`: 所有路径现在都是相对于 `baseURL` 的。
 * * [已扩展]
 * 1.  (P2) 添加了 `generationAPI`，它包含了匹配您后端
 * `generation.py` 路由的三个新方法：
 * - `generateOutline`: (同步) 提交提示词，获取大纲。
 * - `generateContent`: (同步) 提交提示词和大纲，获取内容。
 * - `exportPpt`: (异步) 提交内容，获取 TaskID。
 */
import axios from 'axios';

// [CTO 修复 P1] baseURL 设置为 '' 来启用 Vite 代理
const apiClient = axios.create({
  baseURL: '', // 之前是: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
  timeout: 60000,
});

// 请求拦截器 (日志)
apiClient.interceptors.request.use(
  (config) => {
    // URL 现在是相对的 (例如 /api/v1/tasks)，代理会处理它
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

// --- 用于旧的 `/tasks` 路由 (现在仅用于轮询) ---
export const taskAPI = {
  // [CTO 修复 P1] 路径更新为相对路径
  getTaskStatus: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}`),

  downloadPPT: (taskId) =>
    apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};


// --- [CTO 扩展 P2] ---
// --- 用于新的 `/generation` 路由 (向导式流程) ---
export const generationAPI = {
  /**
   * 步骤 1: (同步) 生成大纲
   */
  generateOutline: (userPrompt) =>
    apiClient.post('/api/v1/generation/outline', { user_prompt: userPrompt }),
  /**
     * [V2 修复] 步骤 1 (新的, V2): 
     * 支持对话式生成大纲
     *
     * @param {Array} chatHistory - 完整的聊天记录 (例如: [{role: 'user', content: '...'}])
     */
  generateOutline_conversational: (chatHistory) =>
    // [V2 修复] 调用新的后端端点
    apiClient.post('/api/v1/generation/outline_conversational', {
      history: chatHistory // 将整个聊天记录数组作为 'history' 键发送
    }),
  /**
   * 步骤 2: (同步) 生成内容
   */
  generateContent: (userPrompt, outlineData) =>
    apiClient.post('/api/v1/generation/content', {
      user_prompt: userPrompt,
      outline: outlineData
    }),

  /**
   * 步骤 3: (异步) 导出PPT，返回 TaskID
   */
  exportPpt: (contentData) =>
    apiClient.post('/api/v1/generation/export', { content: contentData }),
};
