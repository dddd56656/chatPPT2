/**
 * [CTO Refactor] useTask Hook
 * 职责: 仅负责导出任务 (Export Task) 的轮询与下载。
 * 变更: 移除了 Generate Polling。
 */
import { useState, useEffect, useCallback } from 'react';
import { taskAPI } from '../api/client';

export const TaskStatus = {
  PENDING: 'pending',
  PROGRESS: 'progress', 
  SUCCESS: 'success',
  FAILURE: 'failure',
};

export const useTask = () => {
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const startExportPolling = useCallback((newTaskId) => {
    if (!newTaskId) return;
    setError(null);
    setResult(null);
    setStatus(TaskStatus.PENDING);
    setTaskId(newTaskId);
  }, []);

  const pollTaskStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const response = await taskAPI.getTaskStatus(taskId);
      const data = response.data;
      setStatus(data.status);
      setError(data.error);
      setResult(data.result);
    } catch (err) {
      setError(err.message);
      setStatus(TaskStatus.FAILURE);
    }
  }, [taskId]);

  const downloadPPT = useCallback(async () => {
    if (!taskId || !result?.ppt_file_path) return false;
    try {
      const response = await taskAPI.downloadPPT(taskId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const filename = result.message?.split(' ')[1] || 'presentation';
      link.setAttribute('download', `${filename}.pptx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      setError("下载失败");
      return false;
    }
  }, [taskId, result]);

  const resetTask = useCallback(() => {
    setTaskId(null);
    setStatus(null);
    setError(null);
    setResult(null);
  }, []);

  useEffect(() => {
    if (!taskId || status === TaskStatus.SUCCESS || status === TaskStatus.FAILURE) return;
    const interval = setInterval(pollTaskStatus, 2000);
    return () => clearInterval(interval);
  }, [taskId, status, pollTaskStatus]);

  return {
    taskId, status, error, result,
    startExportPolling, downloadPPT, resetTask
  };
};
