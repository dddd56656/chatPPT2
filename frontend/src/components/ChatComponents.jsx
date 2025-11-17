/**
 * [CTO 注释]
 * * 文件名: ChatComponents.jsx (新)
 * 职责: 存放聊天界面的可重用UI组件。
 */
import React, { useState, useRef, useEffect } from 'react';

/**
 * 聊天气泡 (ChatBubble)
 * 根据 'role' (user 或 assistant) 显示不同样式
 */
export const ChatBubble = ({ message }) => {
  const { role, content } = message;
  const isUser = role === 'user';

  return (
    <div className={`chat-bubble-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-bubble">
        {/* CTO注：我们使用 <pre> 和 <code> 来渲染JSON */}
        <pre><code>{content}</code></pre>
      </div>
    </div>
  );
};

/**
 * 聊天输入框 (ChatInput)
 */
export const ChatInput = ({ onSend, isLoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="chat-input-form">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isLoading ? "AI 正在思考..." : "输入您的主题或要求..."}
        disabled={isLoading}
        className="chat-input"
      />
      <button type="submit" disabled={isLoading} className="chat-send-btn">
        {isLoading ? '...' : '发送'}
      </button>
    </form>
  );
};

/**
 * 聊天窗口 (ChatWindow)
 * 封装了消息列表和输入框
 */
export const ChatWindow = ({ messages, onSend, isLoading, actionButton }) => {
  const messagesEndRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-window-container">
      <div className="chat-messages-area">
        {messages.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}
        {isLoading && (
          <div className="chat-bubble-wrapper assistant">
            <div className="chat-bubble typing-indicator">
              AI 正在输入...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 仅在有 Action Button 时显示 */}
      {actionButton && (
        <div className="chat-action-bar">
          <button 
            onClick={actionButton.onClick} 
            disabled={isLoading || actionButton.disabled}
            className="wizard-btn export-btn"
          >
            {actionButton.text}
          </button>
        </div>
      )}
      
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
};
