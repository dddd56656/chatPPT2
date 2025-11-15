/**
 * [CTO 注释]
 * * 文件名: useTask.js
 * 职责: 异步任务轮询器。
 * * * [已修改]
 * 1.  (P1) `createTask`: 重命名为 `createBatchTask` (用于旧的/单一的流程)。
 * 2.  (P2) [新] `startPolling(newTaskId)`: 
 * 这是一个新的入口点。它允许 App.jsx 在 *其他* API 
 * (例如 /generation/export) 返回 task_id 后，
 * 手动启动此 Hook 的轮询机制。
 * 3.  (P3) `useEffect` 逻辑不变：它会自动检测 `taskId` 的变化并开始轮询。
 */
import { useState, useEffect, useCallback } from 'react';
// [CTO 修复] 现在只导入 taskAPI
import { taskAPI } from '../api/client';

// 任务状态枚举 (Enum)，用于在整个应用中保持一致性
export const TaskStatus = {
  PENDING: 'pending',
  PROGRESS: 'progress', 
  SUCCESS: 'success',
  FAILURE: 'failure',
};

// 任务管理Hook
export const useTask = () => {
  const [taskId, setTaskId] = useState(null);       // 任务ID
  const [status, setStatus] = useState(null);       // 任务状态 (使用 TaskStatus 枚举)
  const [progress, setProgress] = useState('');     // (当前未使用) 进度信息
  const [error, setError] = useState(null);         // 错误信息
  const [result, setResult] = useState(null);       // 成功时的结果数据

  // --- [CTO 修复 P1] 行为 1: 重命名 (用于旧的单一流程) ---
  const createBatchTask = useCallback(async (userPrompt) => {
    try {
      setError(null);
      setStatus(TaskStatus.PENDING); // 立即进入等待状态
      
      // [CTO 修复]：taskAPI 现在没有 createTask 了，
      // 这个函数现在是为旧流程准备的，暂时保留，但新的聊天流程不使用它。
      // const response = await taskAPI.createTask(userPrompt); 
      // const taskData = response.data;
      
      // 2. 存储来自后端的任务ID
      // setTaskId(taskData.task_id);
      // setStatus(taskData.status);
      
      // return taskData.task_id;
      console.warn("createBatchTask is deprecated and not implemented in chat flow.");
      return null;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      setStatus(TaskStatus.FAILURE);
      throw new Error(errorMsg); // 抛出错误，以便 App.jsx 可以捕获它
    }
  }, []); // useCallback 确保此函数在重渲染时保持稳定

  // --- [CTO 扩展 P2] 行为 1B: 启动轮询 ---
  /**
   * [新] 手动启动轮询器。
   * App.jsx 将在 /generation/export 成功后调用此函数。
   */
  const startPolling = useCallback((newTaskId) => {
    if (!newTaskId) {
      console.error("startPolling: 缺少 newTaskId");
      return;
    }
    setError(null);
    setResult(null);
    setProgress('');
    setStatus(TaskStatus.PENDING); // 设置为 PENDING
    setTaskId(newTaskId);          // 设置 TaskID
    // useEffect (P3) 将自动捕获此更改并开始轮询
  }, []);

  // --- 行为 2: 轮询任务状态 ---
  const pollTaskStatus = useCallback(async () => {
    if (!taskId) return;

    try {
      const response = await taskAPI.getTaskStatus(taskId);
      const taskData = response.data;
      
      // 更新状态
      setStatus(taskData.status);
      setError(taskData.error);
      setResult(taskData.result);
      
      return taskData;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setStatus(TaskStatus.FAILURE); // 如果轮询失败，则将任务标记为失败
    }
  }, [taskId]); // 依赖 taskId

  // --- 行为 3: 下载PPT文件 ---
  const downloadPPT = useCallback(async () => {
    if (!taskId) return;

    try {
      const response = await taskAPI.downloadPPT(taskId);
      
      // [CTO注]：标准的文件下载逻辑。
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'presentation.pptx'); // 设置下载文件名
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      return false;
    }
  }, [taskId]); // 依赖 taskId

  // --- 行为 4: 重置任务 ---
  const resetTask = useCallback(() => {
    setTaskId(null);
    setStatus(null);
    setProgress('');
    setError(null);
    setResult(null);
  }, []);

  // --- [CTO 注 P3] [核心逻辑] 轮询效果 (Effect) ---
  useEffect(() => {
    // 1. 检查是否需要轮询
    if (!taskId || status === TaskStatus.SUCCESS || status === TaskStatus.FAILURE) {
      return; // 如果没有任务或任务已完成，则不执行
    }

    // 2. 设置一个定时器 (心跳)
    const interval = setInterval(pollTaskStatus, 2000); // 每2秒查询一次状态

    // 3. [关键] 返回一个清理函数 (Cleanup Function)
    return () => clearInterval(interval);
    
  }, [taskId, status, pollTaskStatus]); // 依赖项：当这些值改变时，重新运行此 Effect

  // 4. 将状态和行为暴露给使用者 (App.jsx)
  return {
    taskId,
    status,
    progress,
    error,
    result,
    // [CTO 修复 P1 & P2] 导出新函数
    createBatchTask, // 旧函数
    startPolling,    // 新函数
    pollTaskStatus,
    downloadPPT,
    resetTask,
  };
};
