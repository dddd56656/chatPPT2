import React, { useRef, useEffect } from 'react';
import { useChatMachine } from './hooks/useChatMachine';
import { PreviewPanel } from './components/SlidePreview';
import './index.css';

function App() {
  const { state, actions } = useChatMachine();
  // 增加默认值保护
  const { messages = [], currentSlides = [], isLoading = false, phase = 'outline', error = null } = state || {};
  
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputRef.current?.value;
    if (!text?.trim() || isLoading) return;
    
    actions.sendMessage(text);
    if(inputRef.current) inputRef.current.value = '';
  };

  const renderActionButton = (msg, index) => {
    const isLast = index === messages.length - 1;
    // 安全转换 content 为字符串，防止 includes 报错
    const contentStr = String(msg.content || "");
    
    if (isLast && msg.role === 'assistant' && phase === 'outline' && contentStr.includes('main_topic')) {
      return (
        <div className="action-card">
          <h4>✅ 大纲已生成</h4>
          <p style={{fontSize: '0.85rem', color: '#5f6368', margin: '0.5rem 0'}}>
            请确认大纲，或输入意见进行修改。
          </p>
          <button className="action-btn" onClick={actions.confirmOutline}>
            确认并生成内容 &rarr;
          </button>
        </div>
      );
    }
    
    if (isLast && msg.role === 'assistant' && phase === 'content' && currentSlides.length > 0) {
       return (
        <div className="action-card">
          <h4>✨ 内容已就绪</h4>
          <button className="action-btn" onClick={actions.startExport} style={{background: '#188038'}}>
            下载 PPT 文件 ⬇️
          </button>
        </div>
       )
    }
    return null;
  };

  return (
    <div className="split-layout">
      {/* Left: Chat */}
      <div className="chat-panel">
        <header className="chat-header">
          <h1>ChatPPT <span>Pro</span></h1>
        </header>
        
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className={`message ${msg.role}`}>
                <div className="bubble">
                  {/* 这里的 || "" 非常重要，防止渲染 undefined */}
                  {msg.content || (isLoading && idx === messages.length - 1 ? "..." : "")}
                </div>
              </div>
              {renderActionButton(msg, idx)}
            </div>
          ))}
          {error && (
             <div className="message-wrapper assistant">
                <div className="bubble" style={{background: '#ffebee', color: '#c62828'}}>
                   ❌ 错误: {String(error)}
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <form onSubmit={handleSend} className="input-wrapper">
            <input 
              ref={inputRef} 
              type="text" 
              placeholder={phase === 'outline' ? "输入 PPT 主题..." : "输入修改建议..."} 
              disabled={isLoading} 
            />
            <button type="submit" className="send-btn" disabled={isLoading}>
              发送
            </button>
          </form>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="preview-panel">
        <div className="preview-scroll-container">
          <PreviewPanel slides={currentSlides} />
        </div>
      </div>
    </div>
  );
}

export default App;
