import React, { useState, useRef, useEffect } from 'react';

export const ChatBubble = ({ message }) => {
  const { role, content } = message;
  const isUser = role === 'user';
  
  return (
    <div className={`chat-bubble-wrapper ${isUser ? 'user' : 'assistant'}`}>
      <div className="chat-bubble">
        {/* 使用 pre-wrap 保留流式生成的换行符 */}
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{content}</pre>
      </div>
    </div>
  );
};

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
        placeholder={isLoading ? "AI 正在生成..." : "输入指令..."}
        disabled={isLoading} 
        className="chat-input"
      />
      <button 
        type="submit" 
        disabled={isLoading || !input.trim()} 
        className={`chat-send-btn ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        发送
      </button>
    </form>
  );
};

export const ChatWindow = ({ messages, onSend, isLoading, actionButton }) => {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length-1]?.content]);

  return (
    <div className="chat-window-container h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="chat-messages-area flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <ChatBubble key={index} message={msg} />
        ))}
        {isLoading && messages[messages.length-1]?.role !== 'assistant' && (
           <div className="text-gray-400 text-sm italic ml-2 animate-pulse">连接中...</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {actionButton && (
        <div className="chat-action-bar p-3 bg-gray-50 border-t border-gray-100">
          <button 
            onClick={actionButton.onClick} 
            disabled={isLoading || actionButton.disabled}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                isLoading || actionButton.disabled 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
            }`}
          >
            {actionButton.text}
          </button>
        </div>
      )}
      
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
};
