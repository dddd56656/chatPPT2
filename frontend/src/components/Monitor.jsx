// 任务监控组件
import { TaskStatus } from '../hooks/useTask';

export const Monitor = ({ taskId, status, error, result, onDownload, onReset }) => {
  if (!taskId) return null;

  const getStatusText = () => {
    switch (status) {
      case TaskStatus.PENDING:
        return '任务排队中...';
      case TaskStatus.PROGRESS:
        return '正在生成PPT...';
      case TaskStatus.SUCCESS:
        return 'PPT生成完成！';
      case TaskStatus.FAILURE:
        return '生成失败';
      default:
        return '未知状态';
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case TaskStatus.SUCCESS:
        return 'status-success';
      case TaskStatus.FAILURE:
        return 'status-error';
      default:
        return 'status-info';
    }
  };

  return (
    <div className="monitor">
      <h3>任务状态</h3>
      <div className={`status ${getStatusClass()}`}>
        {getStatusText()}
      </div>
      
      {error && (
        <div className="error">
          <strong>错误:</strong> {error}
        </div>
      )}
      
      {status === TaskStatus.SUCCESS && (
        <div className="actions">
          <button onClick={onDownload} className="download-btn">
            下载PPT
          </button>
          <button onClick={onReset} className="reset-btn">
            新建任务
          </button>
        </div>
      )}
      
      {status === TaskStatus.FAILURE && (
        <button onClick={onReset} className="reset-btn">
          重试
        </button>
      )}
    </div>
  );
};