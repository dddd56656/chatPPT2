import axios from 'axios';
import { getEnv } from '../utils/env';

// 动态获取 Base URL
const baseURL = getEnv('API_BASE_URL') || '';

const apiClient = axios.create({
  baseURL: baseURL, 
  timeout: 60000,
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Network Error';
    console.error(`[API Fail] ${error.config?.url}:`, message);
    return Promise.reject(new Error(message));
  }
);

export const ragAPI = {
  uploadFile: (file, sessionId, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionId);
    
    return apiClient.post('/api/v1/rag/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    });
  },

  listFiles: (sessionId, signal) => {
    return apiClient.get(`/api/v1/rag/files`, {
      params: { session_id: sessionId },
      signal
    });
  },

  deleteFile: (fileId) => {
    return apiClient.delete(`/api/v1/rag/files/${fileId}`);
  },

  getIndexStatus: (sessionId) => {
    return apiClient.get(`/api/v1/rag/status`, {
      params: { session_id: sessionId }
    });
  }
};

export const streamEndpoints = {
  outline: `${baseURL}/api/v1/stream/outline`,
  content: `${baseURL}/api/v1/stream/content`,
};

export default apiClient;
