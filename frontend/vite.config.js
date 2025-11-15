import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 配置开发服务器代理，解决跨域问题
    proxy: {
      // 匹配所有以 /api 开头的请求
      // 例如 /api/v1/tasks -> http://localhost:8000/api/v1/tasks
      '/api': {
        target: 'http://localhost:8000', // 后端 API 的基础 URL
        changeOrigin: true, // 更改请求头的 Origin 字段
      }
    }
  }
});
