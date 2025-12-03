import React, { useRef, useEffect } from 'react';
import { useChatMachine } from './hooks/useChatMachine';
import { PreviewPanel } from './components/SlidePreview';
import './index.css';

/**
 * [CTO Refactor] App Component
 * 架构: Split-Screen View (Chat | Preview)
 * 职责: 仅负责布局和事件绑定，逻辑下沉至 useChatMachine
 */
function App() {
  // 1. 初始化状态机
  const { state, actions } = useChatMachine();
  const { messages, currentSlides, isLoading, phase } = state;

  // 2. 引用与滚动
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // 3. 处理发送
  const handleSend = (e) => {
    e.preventDefault();
    const text = inputRef.current.value;
    if (!text.trim() || isLoading) return;
    
    actions.sendMessage(text);
    inputRef.current.value = '';
  };

  // 4. 辅助渲染：渲染操作按钮 (Action Button)
  const renderActionButton = (msg, index) => {
    // 只有最后一条 AI 消息，且处于 outline 阶段，且内容看起来像 JSON 时才显示
    const isLast = index === messages.length - 1;
    if (isLast && msg.role === 'assistant' && phase === 'outline' && msg.content.includes('main_topic')) {
      return (
        <div className="action-card">
          <h4>✅ AI 建议大纲已生成</h4>
          <p style={{fontSize: '0.85rem', color: '#5f6368', margin: '0.5rem 0'}}>
            您可以继续对话修改，或者点击下方按钮开始生成正文。
          </p>
          <button className="action-btn" onClick={actions.confirmOutline}>
            确认大纲并生成内容 &rarr;
          </button>
        </div>
      );
    }
    
    // 导出按钮 (Content 阶段)
    if (isLast && msg.role === 'assistant' && phase === 'content' && currentSlides.length > 0) {
       return (
        <div className="action-card">
          <h4>✨ 内容生成完毕</h4>
           <p style={{fontSize: '0.85rem', color: '#5f6368', margin: '0.5rem 0'}}>
            如果不满意，可以继续对话修改（例如："把第2页的内容改短一点"）。
          </p>
          <button className="action-btn" onClick={actions.startExport} style={{background: '#188038'}}>
            导出 PPTX 文件 ⬇️
          </button>
        </div>
       )
    }
    return null;
  };

  return (
    <div className="split-layout">
      {/* === Left Pane: Chat Interface === */}
      <div className="chat-panel">
        <header className="chat-header">
          <h1>ChatPPT <span>Pro</span></h1>
        </header>

        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className={`message ${msg.role}`}>
                <div className="bubble">
                  {/* 简单的文本渲染，生产环境可用 Markdown 组件 */}
                  {msg.content || (isLoading && idx === messages.length - 1 ? "..." : "")}
                </div>
              </div>
              {renderActionButton(msg, idx)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <form onSubmit={handleSend} className="input-wrapper">
            <input 
              ref={inputRef}
              type="text" 
              placeholder={
                phase === 'outline' 
                ? "输入主题，例如：2024年人工智能发展趋势..." 
                : "输入修改意见，例如：把第2页的左侧内容改短一点..."
              }
              disabled={isLoading}
            />
            <button type="submit" className="send-btn" disabled={isLoading}>
              {/* Send Icon SVG */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* === Right Pane: Live Preview === */}
      <div className="preview-panel">
        <PreviewPanel slides={currentSlides} />
      </div>
    </div>
  );
}

export default App;
