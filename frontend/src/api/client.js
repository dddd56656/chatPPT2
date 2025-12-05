import axios from 'axios';

const apiClient = axios.create({
  baseURL: '', // 依赖 Vite proxy
  timeout: 60000,
});

// [修改前]:
// (response) => response,
// ... return Promise.reject(error);

// [修改后]:
apiClient.interceptors.response.use(
  (response) => response.data, // <--- 关键点：直接解包
  (error) => {
    // 优先取后端返回的业务错误 msg，其次取 HTTP 状态文本，最后兜底
    const message = error.response?.data?.message || error.message || 'Network Error';
    console.error(`[API Fail] ${error.config?.url}:`, message); // SRE 日志规范
    return Promise.reject(new Error(message)); // <--- 关键点：归一化为 Error 对象
  }
);

export const ragAPI = {
  // 1. 上传 (增强：支持进度回调)
  uploadFile: (file, sessionId, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);

    return apiClient.post('/api/v1/rag/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress // <--- UX 提升：进度条支持
    });
  },

  // 2. 列表 (关键：支持取消)
  listFiles: (sessionId, signal) => {
    return apiClient.get('/api/v1/rag/files', {
      params: { session_id: sessionId },
      signal // <--- 架构级防御：防止 Race Condition
    });
  },

  // 3. 删除 (RESTful 规范)
  deleteFile: (fileId) => {
    return apiClient.delete(`/api/v1/rag/files/${fileId}`);
  },

  // 4. 状态检查 (用于轮询索引构建进度)
  getIndexStatus: (sessionId) => {
    return apiClient.get('/api/v1/rag/status', {
      params: { session_id: sessionId }
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
