import React, { useRef, useEffect } from 'react';
import { useChatMachine } from './hooks/useChatMachine';
import { PreviewPanel } from './components/SlidePreview';
import './index.css';

function App() {
  const { state, actions } = useChatMachine();
  const { messages = [], currentSlides = [], isLoading = false, phase = 'outline', error = null, isRefusal = false } = state || {};
  
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, error]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputRef.current?.value;
    if (!text?.trim() || isLoading) return;
    
    actions.sendMessage(text);
    if(inputRef.current) inputRef.current.value = '';
  };

  const renderMessageContent = (msg) => {
    const content = msg.content || "";
    if (msg.role === 'assistant' && content.includes('{')) {
        if (content.includes('"refusal"')) {
            try {
                const match = content.match(/"refusal":\s*"(.*?)"/);
                if (match) return `[拒绝] ${match[1]}`;
            } catch(e) {}
        }
        if (content.includes('"outline"') || content.includes('"slide_type"')) {
            return "[系统] 数据已接收，右侧预览已更新。";
        }
    }
    return content;
  };

  const renderActionButton = (msg, index) => {
    const isLast = index === messages.length - 1;
    
    // 大纲阶段
    if (isLast && msg.role === 'assistant' && phase === 'outline') {
      if (msg.content?.includes('main_topic')) {
          return (
            <div className="action-card">
              <h4>[完成] 大纲已生成</h4>
              <p style={{fontSize: '0.85rem', color: '#5f6368', margin: '0.5rem 0'}}>
                右侧为预览。满意请点击生成，不满意请输入修改意见。
              </p>
              <button className="action-btn" onClick={actions.generateDetails}>
                生成详细 PPT
              </button>
            </div>
          );
      }
    }
    
    // 内容阶段
    if (isLast && msg.role === 'assistant' && phase === 'content' && currentSlides.length > 0) {
       return (
        <div className="action-card">
          <h4>[完成] PPT 制作完成</h4>
          <p style={{fontSize: '0.85rem', color: '#5f6368', margin: '0.5rem 0'}}>
            图片已自动配图。所见即所得。
          </p>
          <button className="action-btn" onClick={actions.handleExport} style={{background: '#188038'}}>
            立即导出 PPTX
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
                <div className={`bubble ${msg.role === 'assistant' && isRefusal && idx === messages.length-1 ? 'refusal' : ''}`}>
                  {renderMessageContent(msg)}
                  {isLoading && idx === messages.length - 1 && !msg.content && "..."}
                </div>
              </div>
              {renderActionButton(msg, idx)}
            </div>
          ))}
          {error && (
             <div className="message-wrapper assistant">
                <div className="bubble error">[错误] {String(error)}</div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <form onSubmit={handleSend} className="input-wrapper">
            <input 
              ref={inputRef} 
              type="text" 
              placeholder={isLoading ? "AI 正在思考..." : "输入修改意见..."} 
              disabled={isLoading} 
            />
            {isLoading ? (
                <button type="button" className="stop-btn" onClick={actions.stopGeneration} title="停止">Stop</button>
            ) : (
                <button type="submit" className="send-btn">Send</button>
            )}
          </form>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="preview-panel">
        <div className="preview-scroll-container">
          <PreviewPanel slides={currentSlides} onUpdateSlide={actions.updateSlide} />
        </div>
      </div>
    </div>
  );
}

export default App;
