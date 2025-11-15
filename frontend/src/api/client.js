// API客户端 - 封装HTTP请求
import axios from 'axios';

// 创建axios实例
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API方法
export const taskAPI = {
  // 创建PPT生成任务
  createTask: (userPrompt) => 
    apiClient.post('/api/v1/tasks', { user_prompt: userPrompt }),
  
  // 获取任务状态
  getTaskStatus: (taskId) => 
    apiClient.get(`/api/v1/tasks/${taskId}`),
  
  // 下载PPT文件
  downloadPPT: (taskId) => 
    apiClient.get(`/api/v1/tasks/${taskId}/file`, { responseType: 'blob' }),
};

export default apiClient;