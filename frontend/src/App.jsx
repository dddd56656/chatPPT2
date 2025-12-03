import { useState, useEffect, useRef } from 'react';
import { useTask, TaskStatus } from './hooks/useTask';
import { generationAPI } from './api/client';
import './index.css';

// --- 组件：消息气泡 ---
const MessageBubble = ({ role, content, type, data, onExport }) => {
  const isAI = role === 'assistant';
  
  // 如果是结构化数据（大纲或内容），渲染特殊卡片
  if (type === 'outline' && data) {
    return (
      <div className={`message ai-message`}>
        <div className="card outline-card">
          <h3>��� 大纲已生成</h3>
          <div className="card-content">
            <p><strong>主题:</strong> {data.main_topic}</p>
            <ul>
              {data.outline.map((item, i) => (
                <li key={i}>{item.sub_topic}</li>
              ))}
            </ul>
          </div>
          <div className="card-footer">
            <span className="info-text">您可以继续对话修改，或输入"生成内容"下一步</span>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'slides' && data) {
    return (
      <div className={`message ai-message`}>
        <div className="card slides-card">
          <h3>✨ 内容已就绪 ({data.length}页)</h3>
          <div className="slides-preview">
            {data.slice(0, 3).map((slide, i) => (
              <div key={i} className="mini-slide">
                <div className="slide-title">{slide.title}</div>
                <div className="slide-lines"></div>
              </div>
            ))}
            {data.length > 3 && <div className="more-slides">+{data.length - 3}</div>}
          </div>
          <button className="primary-btn export-btn" onClick={onExport}>
            ⬇️ 立即导出 PPT
          </button>
        </div>
      </div>
    );
  }

  // 普通文本消息
  return (
    <div className={`message ${isAI ? 'ai-message' : 'user-message'}`}>
      <div className="bubble-content">{content}</div>
    </div>
  );
};

// --- 主应用 ---
function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '你好！我是 ChatPPT。请告诉我你想做什么演示文稿？' }
  ]);
  
  // 核心状态
  const [currentSlides, setCurrentSlides] = useState([]); // 始终持有最新的幻灯片数据
  const [phase, setPhase] = useState('outline'); // outline -> content -> export
  const bottomRef = useRef(null);

  const { taskId, status, result, startPolling, downloadPPT, resetTask } = useTask();

  // 自动滚动
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // 监听异步任务结果
  useEffect(() => {
    if (status === TaskStatus.SUCCESS && result) {
      if (result.outline) {
        // 大纲生成成功
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '大纲已生成', 
          type: 'outline', 
          data: result.outline 
        }]);
        // 自动转换大纲为初始slides结构
        const initialSlides = convertOutlineToSlides(result.outline);
        setCurrentSlides(initialSlides);
        setPhase('content');
      } 
      else if (result.slides_data) {
        // 内容生成成功
        setCurrentSlides(result.slides_data);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '内容已更新', 
          type: 'slides', 
          data: result.slides_data 
        }]);
      }
      else if (result.ppt_file_path) {
        // 导出成功
        downloadPPT(); 
        setMessages(prev => [...prev, { role: 'assistant', content: 'PPT 下载已开始！' }]);
      }
      resetTask(); 
    } 
    else if (status === TaskStatus.FAILURE) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ 任务执行失败，请重试。' }]);
      resetTask();
    }
  }, [status, result]);

  // 发送处理
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userText }]);

    try {
      if (phase === 'outline') {
        // 发送给大纲生成接口
        const history = messages.concat({ role: 'user', content: userText })
          .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : 'JSON Data' }));
        
        const res = await generationAPI.generateOutline_conversational(history);
        startPolling(res.data.task_id);
      } 
      else if (phase === 'content') {
        // 发送给内容生成接口
        const history = [{ role: 'system', content: '用户正在修改内容' }, { role: 'user', content: userText }];
        const res = await generationAPI.generateContent_conversational(history, currentSlides);
        startPolling(res.data.task_id);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `请求错误: ${err.message}` }]);
    }
  };

  const handleExport = async () => {
    if (currentSlides.length === 0) return;
    setMessages(prev => [...prev, { role: 'assistant', content: '正在打包导出 PPT...' }]);
    try {
      const res = await generationAPI.exportPpt({ 
        title: currentSlides.find(s=>s.slide_type==='title')?.title || "Presentation", 
        slides_data: currentSlides 
      });
      startPolling(res.data.task_id);
    } catch (err) {
      console.error(err);
    }
  };

  // 辅助函数：大纲 -> 幻灯片结构
  const convertOutlineToSlides = (outlineData) => {
    return [
      { slide_type: "title", title: outlineData.main_topic, subtitle: outlineData.summary_topic },
      ...outlineData.outline.map(item => ({
        slide_type: "two_column",
        title: item.sub_topic,
        left_topic: item.topic1,
        right_topic: item.topic2,
        left_content: [], right_content: [] 
      })),
      { slide_type: "content", title: "谢谢", content: ["感谢观看"] }
    ];
  };

  return (
    <div className="app-container">
      <header>
        <h1>ChatPPT <span>Pro</span></h1>
      </header>
      
      <main className="chat-stream">
        {messages.map((msg, idx) => (
          <MessageBubble 
            key={idx} 
            {...msg} 
            onExport={handleExport}
          />
        ))}
        {status === 'pending' || status === 'progress' ? (
          <div className="message ai-message loading">
            <div className="typing-dots"><span>.</span><span>.</span><span>.</span></div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </main>

      <footer className="input-area">
        <form onSubmit={handleSend}>
          <input 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={phase === 'outline' ? "输入主题 (例如: 2025年AI趋势)" : "输入 '生成内容' 或具体修改意见..."}
            disabled={status === 'pending' || status === 'progress'}
          />
          <button type="submit" disabled={!input.trim() || status === 'pending' || status === 'progress'}>
            发送
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
