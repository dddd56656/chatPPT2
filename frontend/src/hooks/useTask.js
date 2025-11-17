/**
 * [CTO 注释与修复]
 * 职责: 异步任务轮询器。
 * [V2 重构]: 移除了未使用的 `createBatchTask` 函数，使 Hook 职责更单一：
 * 只负责 "轮询" (Polling) 和 "下载" (Downloading)。
 */
import { useState, useEffect, useCallback } from 'react';
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
  const [result, setResult] = useState(null);       // 成功时的结果数据 (TaskResultData)

  // --- 行为 1: 启动轮询 ---
  /**
   * [V2 核心] 手动启动轮询器。
   * App.jsx 将在 (节点1, 2, 3) API 调用成功后调用此函数。
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
  }, []);

  // --- 行为 2: 轮询任务状态 ---
  const pollTaskStatus = useCallback(async () => {
    if (!taskId) return;

    try {
      const response = await taskAPI.getTaskStatus(taskId);
      const taskData = response.data;
      
      setStatus(taskData.status);
      setError(taskData.error);
      setResult(taskData.result); // result 包含 { ppt_file_path, outline, slides_data }
      
      return taskData;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setStatus(TaskStatus.FAILURE); // 如果轮询失败，则将任务标记为失败
    }
  }, [taskId]); // 依赖 taskId

  // --- 行为 3: 下载PPT文件 ---
  const downloadPPT = useCallback(async () => {
    if (!taskId || !result || !result.ppt_file_path) {
      setError("下载失败：任务ID或文件路径无效。");
      return false;
    }

    try {
      const response = await taskAPI.downloadPPT(taskId);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // [CTO 修复]：从 result.message 中提取文件名 (更健壮)
      // "PPT {title} 生成成功。"
      const filename = result.message?.split(' ')[1] || 'presentation';
      link.setAttribute('download', `${filename}.pptx`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      return false;
    }
  }, [taskId, result]); // 依赖 taskId 和 result

  // --- 行为 4: 重置任务 ---
  const resetTask = useCallback(() => {
    setTaskId(null);
    setStatus(null);
    setProgress('');
    setError(null);
    setResult(null);
  }, []);

  // --- [核心逻辑] 轮询效果 (Effect) ---
  useEffect(() => {
    if (!taskId || status === TaskStatus.SUCCESS || status === TaskStatus.FAILURE) {
      return; // 如果没有任务或任务已完成，则不执行
    }
    const interval = setInterval(pollTaskStatus, 2000); // 每2秒查询一次状态
    return () => clearInterval(interval);
  }, [taskId, status, pollTaskStatus]);

  return {
    taskId,
    status,
    progress,
    error,
    result,
    startPolling,    // V2 的主要入口
    downloadPPT,
    resetTask,
  };
};
