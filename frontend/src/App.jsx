import React from 'react';
import { useChatMachine } from './hooks/useChatMachine';
import { useTask } from './hooks/useTask';
import { ChatWindow } from './components/ChatComponents';
import { PreviewPanel } from './components/SlidePreview';
import { Monitor } from './components/Monitor';
import { taskAPI } from './api/client';
import './index.css';

function App() {
  const { state, actions } = useChatMachine();
  const { phase, messages, isLoading, currentSlides, error } = state;
  const { taskId, status, error: exportError, result, startExportPolling, downloadPPT, resetTask } = useTask();

  const handleExportClick = async () => {
    actions.startExport();
    try {
      const exportContent = { title: currentSlides.find(s => s.slide_type === 'title')?.title || "Presentation", slides_data: currentSlides };
      const res = await taskAPI.exportPpt(exportContent);
      startExportPolling(res.data.task_id);
    } catch (e) { console.error(e); }
  };

  const handleReset = () => { actions.reset(); resetTask(); };

  if (phase === 'exporting') {
    return (
      <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-lg border-4 border-indigo-100">
          <Monitor taskId={taskId} status={status} error={exportError} result={result} onDownload={downloadPPT} onReset={handleReset} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-50 font-sans">
      {/* Sidebar (Chat) */}
      <div className="w-[450px] min-w-[350px] flex flex-col bg-white border-r border-gray-200 shadow-xl z-20">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-md">
          <h1 className="text-2xl font-black tracking-tight flex items-center">
            <span className="text-3xl mr-2">✨</span> ChatPPT <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-md font-medium">V3 Pro</span>
          </h1>
          <p className="text-blue-100 text-sm mt-1 opacity-90">AI-Powered Presentation Architect</p>
        </div>

        {/* Phase Indicator */}
        <div className="flex items-center justify-between px-6 py-4 bg-blue-50 border-b border-blue-100 text-sm font-semibold uppercase tracking-wide text-blue-900">
          <span className={`px-3 py-1 rounded-full ${phase === 'outline' ? 'bg-blue-600 text-white' : 'text-blue-700 opacity-60'}`}>
            1. Outline
          </span>
          <span className="text-blue-300">➔</span>
          <span className={`px-3 py-1 rounded-full ${phase === 'content' ? 'bg-blue-600 text-white' : 'text-blue-700 opacity-60'}`}>
            2. Content
          </span>
          <span className="text-blue-300">➔</span>
          <span className={`px-3 py-1 rounded-full ${phase === 'exporting' ? 'bg-blue-600 text-white' : 'text-blue-700 opacity-60'}`}>
            3. Export
          </span>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 overflow-hidden bg-gray-50/30">
          <ChatWindow
            messages={messages}
            onSend={actions.sendMessage}
            isLoading={isLoading}
            actionButton={
              phase === 'outline' 
              ? { text: 'Confirm Outline & Next', onClick: actions.confirmOutline, disabled: isLoading || messages.length < 2 }
              : { text: 'Generate File (.pptx)', onClick: handleExportClick, disabled: isLoading }
            }
          />
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border-t border-red-200 flex items-center text-red-700 text-sm">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Main Content (Preview) */}
      <div className="flex-1 flex flex-col h-full bg-slate-100 relative">
        <div className="flex-1 overflow-y-auto p-10">
          <PreviewPanel slides={currentSlides} />
        </div>
      </div>
    </div>
  );
}
export default App;
