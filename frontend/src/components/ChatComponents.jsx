import React, { useRef, useEffect } from 'react';

export const ChatBubble = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'} msg-animate`}>
      <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
        isUser 
        ? 'bg-blue-600 text-white rounded-br-sm shadow-md' 
        : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200 shadow-sm'
      }`}>
        {/* Hide JSON blocks from Chat UI for cleaner look */}
        <div className="whitespace-pre-wrap font-sans">
          {message.content.includes('```json') 
            ? <span className="italic opacity-80">Generating structured data... (Check Preview)</span>
            : message.content
          }
        </div>
      </div>
    </div>
  );
};

export const ChatInput = ({ onSend, isLoading }) => {
  const [input, setInput] = React.useState('');
  const handleSubmit = (e) => { e.preventDefault(); if(input.trim() && !isLoading){ onSend(input); setInput(''); }};

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "AI is writing..." : "Type your instruction..."}
          disabled={isLoading}
          className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm"
          aria-label="Chat input"
        />
        <button 
          type="submit" 
          disabled={isLoading || !input.trim()}
          className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Send message"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export const ChatWindow = ({ messages, onSend, isLoading, actionButton }) => {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m, i) => <ChatBubble key={i} message={m} />)}
        {isLoading && messages[messages.length-1]?.role !== 'assistant' && (
          <div className="flex items-center text-gray-500 text-sm ml-4">
            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>
      {actionButton && (
        <div className="px-4 pb-2">
          <button 
            onClick={actionButton.onClick} 
            disabled={actionButton.disabled} 
            className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {actionButton.text}
          </button>
        </div>
      )}
      <ChatInput onSend={onSend} isLoading={isLoading} />
    </div>
  );
};
