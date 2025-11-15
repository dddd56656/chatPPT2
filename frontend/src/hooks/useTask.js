// 任务状态管理Hook
import { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../api/client';

// 任务状态枚举
export const TaskStatus = {
  PENDING: 'pending',
  PROGRESS: 'progress', 
  SUCCESS: 'success',
  FAILURE: 'failure',
};

// 任务管理Hook
export const useTask = () => {
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // 创建任务
  const createTask = useCallback(async (userPrompt) => {
    try {
      setError(null);
      setStatus(TaskStatus.PENDING);
      
      const response = await taskAPI.createTask(userPrompt);
      const taskData = response.data;
      
      setTaskId(taskData.task_id);
      setStatus(taskData.status);
      
      return taskData.task_id;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message;
      setError(errorMsg);
      setStatus(TaskStatus.FAILURE);
      throw new Error(errorMsg);
    }
  }, []);

  // 轮询任务状态
  const pollTaskStatus = useCallback(async () => {
    if (!taskId) return;

    try {
      const response = await taskAPI.getTaskStatus(taskId);
      const taskData = response.data;
      
      setStatus(taskData.status);
      setError(taskData.error);
      setResult(taskData.result);
      
      return taskData;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setStatus(TaskStatus.FAILURE);
    }
  }, [taskId]);

  // 下载PPT文件
  const downloadPPT = useCallback(async () => {
    if (!taskId) return;

    try {
      const response = await taskAPI.downloadPPT(taskId);
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'presentation.pptx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      return false;
    }
  }, [taskId]);

  // 重置任务状态
  const resetTask = useCallback(() => {
    setTaskId(null);
    setStatus(null);
    setProgress('');
    setError(null);
    setResult(null);
  }, []);

  // 自动轮询
  useEffect(() => {
    if (!taskId || status === TaskStatus.SUCCESS || status === TaskStatus.FAILURE) {
      return;
    }

    const interval = setInterval(pollTaskStatus, 2000);
    return () => clearInterval(interval);
  }, [taskId, status, pollTaskStatus]);

  return {
    taskId,
    status,
    progress,
    error,
    result,
    createTask,
    pollTaskStatus,
    downloadPPT,
    resetTask,
  };
};