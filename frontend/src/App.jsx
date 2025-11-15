// 主应用组件
import { useState } from 'react';
import { Editor } from './components/Editor';
import { Monitor } from './components/Monitor';
import { useTask } from './hooks/useTask';
import './index.css';

function App() {
  const { 
    taskId, 
    status, 
    error, 
    result, 
    createTask, 
    downloadPPT, 
    resetTask 
  } = useTask();
  
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (prompt) => {
    setIsLoading(true);
    try {
      await createTask(prompt);
    } catch (err) {
      console.error('创建任务失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    await downloadPPT();
  };

  const handleReset = () => {
    resetTask();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>ChatPPT</h1>
        <p>AI驱动的智能演示文稿生成器</p>
      </header>
      
      <main className="app-main">
        <Editor 
          onSubmit={handleSubmit}
          isLoading={isLoading || (taskId && status !== 'success' && status !== 'failure')}
        />
        
        <Monitor
          taskId={taskId}
          status={status}
          error={error}
          result={result}
          onDownload={handleDownload}
          onReset={handleReset}
        />
      </main>
      
      <footer className="app-footer">
        <p>© 2024 ChatPPT - 基于FastAPI + React构建</p>
      </footer>
    </div>
  );
}

export default App;