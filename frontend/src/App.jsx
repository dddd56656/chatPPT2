/**
 * [CTO 注释与修复]
 * * 文件名: App.jsx (V2 纯净版 - V6 修复)
 * * 职责: V2 聊天状态机 (全异步)。
 *
 * [V6 修复]:
 * 1.  引入 `currentSlides` 状态：这是“内容阶段”的单一数据源。
 * 2.  `handleOutlineConfirm`: 现在负责将 `result.outline` 转换为
 * `initialSlides`，并调用 `setCurrentSlides` 来初始化内容阶段。
 * [V6] 它 *不再* 将这个骨架JSON显示在聊天框中。
 * 3.  `handleContentSend`: 现在发送 *干净的* `history` (仅含系统提示和用户输入)
 * 和 `currentSlides` 状态 (包含骨架/内容)。
 * 4.  `useEffect` (on Task SUCCESS): 在 `PHASE_CONTENT` 阶段，
 * 它现在会调用 `setCurrentSlides(result.slides_data)` 来更新 "记忆"，
 * 并只在聊天框中显示 *最新的* 用户消息和AI响应。
 * 5.  `handleExport`: 现在从 `currentSlides` 状态获取最终数据。
 */
import { useState, useCallback, useEffect } from 'react';
import { Monitor } from './components/Monitor';
import { useTask, TaskStatus } from './hooks/useTask';
import { generationAPI } from './api/client';
import { ChatWindow } from './components/ChatComponents';
import './index.css';

// 定义应用阶段
const PHASE_OUTLINE = 'PHASE_OUTLINE';
const PHASE_CONTENT = 'PHASE_CONTENT';
const PHASE_EXPORTING = 'PHASE_EXPORTING';

// 初始系统消息
const OUTLINE_SYSTEM_MSG = {
  role: 'assistant',
  content: '你好！我是 ChatPPT (V2 异步模式)。\n请输入您想要生成的主题，我将为您创建一份大纲。'
};

// [CTO V6 修复] 简化消息。骨架不应显示在聊天中。
const CONTENT_SYSTEM_MSG = {
  role: 'assistant',
  content: "大纲已确认！\n\n您现在可以对话式地修改内容 (例如：\"为幻灯片2的左栏添加要点'xxx'\")，或者输入 \"生成所有内容\" 来让AI填充所有幻灯片。"
};

function App() {
  // --- 状态定义 ---
  const [phase, setPhase] = useState(PHASE_OUTLINE);
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([OUTLINE_SYSTEM_MSG]);
  const [error, setError] = useState(null);

  // [CTO 修复 P1]：为内容阶段创建单一数据源
  const [currentSlides, setCurrentSlides] = useState([]);

  // useTask Hook 现在是所有异步操作的核心
  const {
    taskId,
    status,
    error: taskError,
    result, // result 包含 { outline, slides_data, ppt_file_path }
    startPolling,
    downloadPPT,
    resetTask
  } = useTask();

  // --- 核心异步处理逻辑 ---
  useEffect(() => {
    // 1. 仅在任务成功时触发
    if (status === TaskStatus.SUCCESS && result) {
      setError(null); // 清除旧错误

      // 2. 根据当前阶段，处理不同的成功结果
      if (phase === PHASE_OUTLINE && result.outline) {
        // [V2 节点 1 成功]: 我们收到了大纲
        const outlineJson = JSON.stringify(result.outline, null, 2);
        setChatHistory((prev) => [...prev, { role: 'assistant', content: outlineJson }]);
        
      } else if (phase === PHASE_CONTENT && result.slides_data) {
        // [V2 节点 2 成功]: 我们收到了内容
        const contentJson = JSON.stringify(result.slides_data, null, 2);
        
        // [CTO V6 修复]：用AI返回的新内容替换旧的聊天记录，
        // 这样 history 就不会无限增长。
        setChatHistory((prev) => [
            // 保留上一条的用户消息 (prev[prev.length - 1])
            prev[prev.length - 1], 
            { role: 'assistant', content: contentJson } // 显示新内容
        ]);
        
        // [CTO 关键修复]：更新 currentSlides 状态以实现 "记忆"
        setCurrentSlides(result.slides_data);

      } else if (phase === PHASE_EXPORTING && result.ppt_file_path) {
        // [V2 节点 3 成功]: 导出完成 (由 <Monitor> 组件处理)
      }

      setIsLoading(false);
    }
    
    // 4. 处理任务失败
    if (status === TaskStatus.FAILURE) {
      const errorMsg = taskError || "任务失败";
      setError(errorMsg);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `错误: ${errorMsg}` }]);
      setIsLoading(false);
    }
  }, [status, result, taskError, phase]); // 依赖 useTask 的状态


  // --- 聊天处理 1: 大纲阶段 ---
  const handleOutlineSend = async (userInput) => {
    setIsLoading(true);
    setError(null);
    const newHistory = [...chatHistory, { role: 'user', content: userInput }];
    setChatHistory(newHistory); // 立即显示用户消息

    try {
      // [V2 节点 1]：只提交任务，不等待结果
      const response = await generationAPI.generateOutline_conversational(newHistory);
      startPolling(response.data.task_id); // 启动轮询
      
    } catch (err) { // API 提交失败
      const errorMsg = err.response?.data?.detail || err.message || '大纲请求提交失败';
      setError(errorMsg);
      setChatHistory([...newHistory, { role: 'assistant', content: `错误: ${errorMsg}` }]);
      setIsLoading(false);
    }
  };

  // --- 聊天处理 2: 内容阶段 (已修复) ---
  const handleContentSend = async (userInput) => {
    setIsLoading(true);
    setError(null);

    // [CTO V6 修复]：创建一个 *干净的* history。
    // 我们只发送系统提示和用户的最新输入。
    // `currentSlides`（骨架）将通过 `generationAPI` 的第二个参数单独传递。
    const cleanHistory = [
      { role: 'system', content: CONTENT_SYSTEM_MSG.content },
      { role: 'user', content: userInput }
    ];

    // [CTO V6 修复]：只在 UI 上显示用户的输入，
    // AI 的响应将由 useEffect 在成功时添加。
    setChatHistory((prev) => [...prev, { role: 'user', content: userInput }]);

    try {
      if (currentSlides.length === 0) {
        throw new Error("内部错误：currentSlides 状态为空。");
      }

      // [V2 节点 2]：发送 *干净的* 历史记录和 *当前* 的幻灯片状态
      const response = await generationAPI.generateContent_conversational(cleanHistory, currentSlides);
      startPolling(response.data.task_id); // 启动轮询

    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || '内容请求提交失败';
      setError(errorMsg);
      // [CTO V6 修复]：使用 (prev) => ... 来获取正确的 'prev' 状态
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `错误: ${errorMsg}` }]);
      setIsLoading(false);
    }
  };

  // --- 阶段转换 1: 大纲 -> 内容 (已修复) ---
  const handleOutlineConfirm = () => {
    // [CTO 修复]：从 `useTask.result` 获取上一步的产物
    const lastOutline = result?.outline;
    if (!lastOutline) {
      const errorMsg = "错误: 无法确认，未找到有效的大纲 (useTask.result.outline)。";
      setError(errorMsg);
      setChatHistory([...chatHistory, { role: 'assistant', content: errorMsg }]);
      return;
    }
    
    // [CTO 关键修复 V3]：创建 *明确的* 骨架
    const initialSlides = [
      { 
        slide_type: "title", 
        title: lastOutline.main_topic, 
        subtitle: lastOutline.summary_topic || "" 
      },
      ...lastOutline.outline.map((item) => ({
        slide_type: "two_column",
        title: item.sub_topic,
        // [CTO V3] 添加明确的 *主题* 字段作为输入
        left_topic: item.topic1, 
        right_topic: item.topic2,
        // [CTO V3] 将 *内容* 字段留空，以便 LLM 填充
        left_content: [], 
        right_content: [] 
      })),
      { 
        slide_type: "content", 
        title: lastOutline.summary_topic, 
        content: ["谢谢观看"] // 添加一个默认的总结页
      }
    ];

    // [CTO 关键修复]：设置 V2 状态机
    setCurrentSlides(initialSlides); // 1. 更新 slides 状态
    setPhase(PHASE_CONTENT); // 2. 切换阶段
    setError(null);
    resetTask(); // 3. 重置 useTask 以准备下一次轮询

    // [CTO V6 修复]：重置聊天记录，但 *不* 显示骨架 JSON。
    // 骨架 JSON 现在只存在于 `currentSlides` 状态中。
    setChatHistory([
      CONTENT_SYSTEM_MSG
      // { role: 'assistant', content: JSON.stringify(initialSlides, null, 2) } // <-- [V6] 移除
    ]);
  };

  // --- 阶段转换 2: 内容 -> 导出 (已修复) ---
  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // [CTO 修复 P1]：从 `currentSlides` 状态获取最终数据
      const finalSlides = currentSlides;
      if (finalSlides.length === 0) {
        throw new Error("无法导出：未找到有效的内容 (currentSlides 状态为空)。");
      }

      // [V2 节点 3]：后端 `export_ppt_task` 期望的格式
      const contentJson = {
        title: finalSlides.find(s => s.slide_type === 'title')?.title || "演示文稿",
        slides_data: finalSlides
      };
      
      const response = await generationAPI.exportPpt(contentJson);
      if (!response.data || !response.data.task_id) {
        throw new Error("启动导出任务失败");
      }

      resetTask();
      startPolling(response.data.task_id);
      setPhase(PHASE_EXPORTING); 

    } catch (e) {
      const errorMsg = e.message || "导出失败";
      setError(errorMsg);
      setChatHistory([...chatHistory, { role: 'assistant', content: `导出失败: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- 阶段转换 3: 导出 -> 重置 ---
  const handleResetAll = () => {
    resetTask();
    setPhase(PHASE_OUTLINE);
    setChatHistory([OUTLINE_SYSTEM_MSG]);
    setCurrentSlides([]); // [CTO 修复 P1]：清空 slides 状态
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
              disabled: isLoading || !result // 仅当不加载且有结果时才可确认
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
              disabled: isLoading || currentSlides.length === 0 // 仅当不加载且有内容时才可导出
            }}
          />
        );
      case PHASE_EXPORTING:
        return (
          <Monitor
            taskId={taskId}
            status={status}
            error={taskError || error}
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
        <h1>ChatPPT (V2 异步模式)</h1>
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