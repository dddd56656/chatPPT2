/**
 * [CTO 注释]
 * * 文件名: App.jsx (已完全替换)
 * 职责: 两阶段聊天状态机。
 * * * 1.  (PHASE_OUTLINE): 渲染 <ChatWindow>。
 * -   `onSend` -> `handleOutlineSend` -> (调用 `generationAPI.generateOutline`)
 * -   `actionButton` -> `handleOutlineConfirm` (进入下一阶段)
 * * 2.  (PHASE_CONTENT): 渲染 <ChatWindow>。
 * -   `onSend` -> `handleContentSend` -> (调用 `generationAPI.generateContent`)
 * -   `actionButton` -> `handleExport` (进入最后阶段)
 * * 3.  (PHASE_EXPORTING): 渲染 <Monitor>。
 * -   使用 `useTask` 的 `startPolling` 来启动轮询。
 */
import { useState, useCallback } from 'react';
import { Monitor } from './components/Monitor';
// [CTO 修复] 导入新的 `startPolling`
import { useTask } from './hooks/useTask';
import { generationAPI } from './api/client';
// [CTO 扩展] 导入新的聊天UI组件
import { ChatWindow } from './components/ChatComponents';
import './index.css';

// 定义应用阶段
const PHASE_OUTLINE = 'PHASE_OUTLINE';
const PHASE_CONTENT = 'PHASE_CONTENT';
const PHASE_EXPORTING = 'PHASE_EXPORTING';

// 初始系统消息
const OUTLINE_SYSTEM_MSG = {
  role: 'assistant',
  content: '你好！我是 ChatPPT。请输入您想要生成的主题，我将为您创建一份大纲。'
};

const CONTENT_SYSTEM_MSG = {
  role: 'assistant',
  content: '大纲已确认！现在，我们可以基于这份大纲来生成详细内容。请提出您的要求，或者直接告诉我“开始生成”。'
};

function App() {
  // --- 状态定义 ---
  const [phase, setPhase] = useState(PHASE_OUTLINE); // 应用阶段
  const [isLoading, setIsLoading] = useState(false); // AI 是否正在响应
  const [chatHistory, setChatHistory] = useState([OUTLINE_SYSTEM_MSG]); // 聊天记录
  const [error, setError] = useState(null); // API 错误

  // 阶段性产物
  const [finalOutline, setFinalOutline] = useState(null); // 存储最终确认的大纲

  // [CTO注]：我们只在最后一步才需要 useTask
  const {
    taskId,
    status,
    error: exportError,
    result,
    startPolling, // <--- [CTO 修复] 使用新的 `startPolling`
    downloadPPT,
    resetTask
  } = useTask();

  // --- 辅助函数：安全地解析最后一条AI消息 ---
  const getJsonFromLastMessage = (history) => {
    // 从后往前找，找到最后一条 'assistant' 的消息
    const lastAiMsg = [...history].reverse().find(m => m.role === 'assistant');
    if (!lastAiMsg) throw new Error("在历史记录中未找到AI响应。");

    try {
      // 尝试将内容解析为 JSON
      return JSON.parse(lastAiMsg.content);
    } catch (e) {
      // 如果AI没有返回有效的JSON
      console.error("解析最后一条AI消息失败:", e, lastAiMsg.content);
      throw new Error("AI的最后一条回复不是有效的JSON。请让AI重新生成。");
    }
  };

  // --- 聊天处理 1: 大纲阶段 ---
  const handleOutlineSend = async (userInput) => {
    setIsLoading(true);
    setError(null);
    const newHistory = [...chatHistory, { role: 'user', content: userInput }];
    setChatHistory(newHistory);

    try {
      // [CTO注]：我们只发送 *当前* 的提示词。
      // (一个更高级的实现可能会发送整个 newHistory)
      // const response = await generationAPI.generateOutline(userInput);
      // [V2 修复]：我们现在发送 *整个* newHistory 来实现对话式修改
      const response = await generationAPI.generateOutline_conversational(newHistory);
      if (response.data.status === 'error') {
        throw new Error(response.data.error || "大纲生成失败");
      }

      // AI的回复是一个JSON对象，我们将其格式化后显示
      const aiResponse = JSON.stringify(response.data, null, 2);
      setChatHistory([...newHistory, { role: 'assistant', content: aiResponse }]);

    } catch (err) {
      const errorMsg = err.message || '大纲请求失败';
      setError(errorMsg);
      setChatHistory([...newHistory, { role: 'assistant', content: `错误: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 聊天处理 2: 内容阶段 ---
  const handleContentSend = async (userInput) => {
    setIsLoading(true);
    setError(null);
    const newHistory = [...chatHistory, { role: 'user', content: userInput }];
    setChatHistory(newHistory);

    try {
      // [CTO注]：我们发送 *最终确认的大纲* 和 *当前提示词*
      const response = await generationAPI.generateContent(userInput, finalOutline);

      if (response.data.status === 'error') {
        throw new Error(response.data.error || "内容生成失败");
      }

      const aiResponse = JSON.stringify(response.data.content, null, 2);
      setChatHistory([...newHistory, { role: 'assistant', content: aiResponse }]);

    } catch (err) {
      const errorMsg = err.message || '内容请求失败';
      setError(errorMsg);
      setChatHistory([...newHistory, { role: 'assistant', content: `错误: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 阶段转换 1: 大纲 -> 内容 ---
  const handleOutlineConfirm = () => {
    try {
      // 1. 解析最后一条AI消息以获取大纲
      const outlineJson = getJsonFromLastMessage(chatHistory);
      setFinalOutline(outlineJson); // 存储

      // 2. 转换到内容阶段
      setPhase(PHASE_CONTENT);
      setChatHistory([CONTENT_SYSTEM_MSG]); // 重置聊天
      setError(null);
    } catch (e) {
      setError(e.message);
      // 在聊天中显示错误
      setChatHistory([...chatHistory, { role: 'assistant', content: `错误: ${e.message}` }]);
    }
  };

  // --- 阶段转换 2: 内容 -> 导出 ---
  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. 解析最后一条AI消息以获取最终内容
      const contentJson = getJsonFromLastMessage(chatHistory);

      // 2. 提交异步导出任务
      const response = await generationAPI.exportPpt(contentJson);

      if (!response.data || !response.data.task_id) {
        throw new Error("启动导出任务失败");
      }

      // 3. [CTO 关键]：使用返回的 task_id 启动轮询器
      startPolling(response.data.task_id);

      // 4. 转换到导出阶段
      setPhase(PHASE_EXPORTING);

    } catch (e) {
      setError(e.message);
      setChatHistory([...chatHistory, { role: 'assistant', content: `导出失败: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 阶段转换 3: 导出 -> 重置 ---
  const handleResetAll = () => {
    resetTask(); // 重置 useTask hook
    setPhase(PHASE_OUTLINE);
    setChatHistory([OUTLINE_SYSTEM_MSG]);
    setFinalOutline(null);
    setError(null);
    setIsLoading(false);
  };

  // --- 条件渲染 ---
  const renderPhase = () => {
    switch (phase) {
      case PHASE_OUTLINE:
        return (
          <ChatWindow
            messages={chatHistory}
            onSend={handleOutlineSend}
            isLoading={isLoading}
            actionButton={{
              text: '确认大纲，下一步：生成内容',
              onClick: handleOutlineConfirm,
              disabled: chatHistory.length <= 1 // 如果只有系统消息，则禁用
            }}
          />
        );
      case PHASE_CONTENT:
        return (
          <ChatWindow
            messages={chatHistory}
            onSend={handleContentSend}
            isLoading={isLoading}
            actionButton={{
              text: '确认内容，最终导出PPT',
              onClick: handleExport,
              disabled: chatHistory.length <= 1
            }}
          />
        );
      case PHASE_EXPORTING:
        return (
          <Monitor
            taskId={taskId}
            status={status}
            error={exportError || error} // 显示轮询错误或导出错误
            result={result}
            onDownload={downloadPPT}
            onReset={handleResetAll}
          />
        );
      default:
        return <p>未知阶段</p>;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>ChatPPT (对话模式)</h1>
        <p>AI驱动的智能演示文稿生成器</p>
      </header>

      <main className="app-main">
        {renderPhase()}
      </main>

      <footer className="app-footer">
        <p>© 2024 ChatPPT - 基于FastAPI + React构建</p>
      </footer>
    </div>
  );
}

export default App;
