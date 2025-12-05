/**
 * 统一环境变量读取工具
 * 1. 优先读取 Docker 运行时注入的 window._env_ (生产环境)
 * 2. 兜底读取 Vite 构建时的 import.meta.env (本地开发)
 */
export const getEnv = (key) => {
    // Docker Runtime Injection
    if (typeof window !== 'undefined' && window._env_ && window._env_[key]) {
        return window._env_[key];
    }
    
    // Local Development (Vite)
    const viteKey = `VITE_${key}`;
    if (import.meta.env[viteKey]) {
        return import.meta.env[viteKey];
    }
    
    return '';
};
