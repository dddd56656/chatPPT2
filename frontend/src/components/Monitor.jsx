// Task Monitor Component - Material Design with Tailwind
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

  const getStatusColor = () => {
    switch (status) {
      case TaskStatus.SUCCESS:
        return 'bg-green-100 text-green-800 border-green-300';
      case TaskStatus.FAILURE:
        return 'bg-red-100 text-red-800 border-red-300';
      case TaskStatus.PROGRESS:
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case TaskStatus.SUCCESS:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case TaskStatus.FAILURE:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      case TaskStatus.PROGRESS:
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full mx-auto border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">任务状态</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 ${getStatusColor()}`}>
          <span>{getStatusIcon()}</span>
          <span>{getStatusText()}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <strong className="text-red-700">错误:</strong>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      {status === TaskStatus.SUCCESS && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-green-700">PPT已成功生成，可以下载。</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onDownload}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              下载PPT
            </button>
            <button
              onClick={onReset}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              新建任务
            </button>
          </div>
        </div>
      )}

      {status === TaskStatus.FAILURE && (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700">生成失败，请重试或检查错误信息。</p>
          </div>
          <button
            onClick={onReset}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            重试
          </button>
        </div>
      )}

      {(status === TaskStatus.PENDING || status === TaskStatus.PROGRESS) && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-blue-700">任务正在处理中，请稍候...</p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-full rounded-full ${status === TaskStatus.PROGRESS ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`} style={{ width: status === TaskStatus.PROGRESS ? '60%' : '30%' }}></div>
          </div>
        </div>
      )}
    </div>
  );
};