/**
 * [CTO Refactor] App.jsx
 * 职责: 布局容器。
 * 逻辑: 委托给 useChatMachine 和 useTask。
 * 复杂度: 极低 (< 100 行)。
 */
import React from 'react';
import { useChatMachine } from './hooks/useChatMachine';
import { useTask } from './hooks/useTask';
import { ChatWindow } from './components/ChatComponents';
import { PreviewPanel } from './components/SlidePreview';
import { Monitor } from './components/Monitor';
import { taskAPI } from './api/client';
import './index.css';

function App() {
  // 1. 挂载业务逻辑 Hook
  const { state, actions } = useChatMachine();
  const { phase, messages, isLoading, currentSlides, error } = state;
  
  // 2. 挂载导出任务 Hook
  const { 
    taskId, status, error: exportError, result, 
    startExportPolling, downloadPPT, resetTask 
  } = useTask();

  // 导出处理函数
  const handleExportClick = async () => {
    actions.startExport();
    try {
      const exportContent = {
        title: currentSlides.find(s => s.slide_type === 'title')?.title || "演示文稿",
        slides_data: currentSlides
      };
      const res = await taskAPI.exportPpt(exportContent);
      startExportPolling(res.data.task_id);
    } catch (e) {
      console.error("Export start failed", e);
    }
  };

  const handleReset = () => {
    actions.reset();
    resetTask();
  };

  // 渲染主体内容
  const renderContent = () => {
    if (phase === 'exporting') {
      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
          <div className="w-full max-w-2xl">
            <Monitor 
              taskId={taskId} status={status} error={exportError} result={result}
              onDownload={downloadPPT} onReset={handleReset}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex gap-6 p-6 h-[calc(100vh-80px)] overflow-hidden">
        {/* 左栏: 聊天 */}
        <div className="w-5/12 flex flex-col min-w-[350px]">
           <ChatWindow
              messages={messages}
              onSend={actions.sendMessage}
              isLoading={isLoading}
              actionButton={
                phase === 'outline' 
                ? { 
                    text: '确认大纲，生成内容 ->', 
                    onClick: actions.confirmOutline, 
                    disabled: isLoading || messages.length < 2 
                  }
                : { 
                    text: '确认内容，导出 PPT ->', 
                    onClick: handleExportClick, 
                    disabled: isLoading 
                  }
              }
           />
           {error && (
             <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded border border-red-200 text-center">
               {error}
             </div>
           )}
        </div>

        {/* 右栏: 预览 */}
        <div className="w-7/12 shadow-lg rounded-xl overflow-hidden">
           <PreviewPanel slides={currentSlides} />
        </div>
      </div>
    );
  };

  return (
    <div className="app min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
      <header className="app-header bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 shadow-md flex justify-between items-center z-20">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ChatPPT <span className="text-indigo-200 text-sm font-normal">V3</span></h1>
          <p className="text-xs text-indigo-100 opacity-80">Stream Enabled • Real-time Preview</p>
        </div>
        <div className="flex items-center space-x-4 text-xs font-semibold uppercase tracking-wider">
            <div className={`px-3 py-1 rounded-full ${phase === 'outline' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-300'}`}>1. 大纲</div>
            <div className="w-4 h-px bg-indigo-400"></div>
            <div className={`px-3 py-1 rounded-full ${phase === 'content' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-300'}`}>2. 内容</div>
            <div className="w-4 h-px bg-indigo-400"></div>
            <div className={`px-3 py-1 rounded-full ${phase === 'exporting' ? 'bg-white text-indigo-600' : 'bg-indigo-700 text-indigo-300'}`}>3. 导出</div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-[1600px] mx-auto">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
