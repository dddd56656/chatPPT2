import React, { useRef, useEffect, useState } from 'react';
import { useChatMachine } from './hooks/useChatMachine';
import { PreviewPanel } from './components/SlidePreview';
import './index.css';

// SVG Icons
const MenuIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>;
const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>;
const SaveIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>;

function App() {
  const { state, actions, historyList } = useChatMachine();
  const { messages = [], currentSlides = [], isLoading = false, error = null, isRefusal = false, sessionId } = state || {};
  
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

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

  // 重命名处理
  const startEditing = (e, item) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditTitle(item.title || "新对话");
  };

  const saveTitle = (e) => {
    e.stopPropagation();
    if (editingId) {
        actions.renameSession(editingId, editTitle);
        setEditingId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveTitle(e);
  };

  const renderMessageContent = (msg) => {
    const content = msg.content || "";
    if (isLoading && !content) return <span className="typing-dots">AI 思考中...</span>;
    if (msg.role === 'assistant' && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
        if (content.includes('refusal')) return "��� 内容无关，已拒绝。";
        return isLoading ? "��� 正在构建..." : "✅ 预览已更新";
    }
    return content;
  };

  return (
    <div className="app-container">
      
      {/* 1. Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? '' : 'closed'}`}>
        <button className="new-chat-btn-sidebar" onClick={actions.createNewSession}>
          <span style={{fontSize:'1.2rem'}}>+</span> 新建对话
        </button>
        
        <div className="history-list">
          {historyList.map(item => (
            <div 
                key={item.id} 
                className={`history-item ${item.id === sessionId ? 'active' : ''}`}
                onClick={() => actions.loadSession(item.id)}
            >
                {/* 标题区域: 编辑态 vs 显示态 */}
                {editingId === item.id ? (
                    <div style={{display:'flex', alignItems:'center', width:'100%', gap:'5px'}}>
                        <input 
                            className="rename-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button className="icon-btn" onClick={saveTitle}><SaveIcon/></button>
                    </div>
                ) : (
                    <>
                        <span className="history-title">{item.title || "未命名对话"}</span>
                        <div className="history-actions">
                            <button className="icon-btn" onClick={(e) => startEditing(e, item)} title="重命名"><EditIcon/></button>
                            <button className="icon-btn" onClick={(e) => actions.deleteSession(item.id, e)} title="删除"><TrashIcon/></button>
                        </div>
                    </>
                )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. Chat Panel */}
      <div className="chat-panel">
        <header className="chat-header">
          {/* 折叠按钮 */}
          <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)} title={isSidebarOpen ? "收起侧边栏" : "展开侧边栏"}>
            <MenuIcon />
          </button>
          <h1>ChatPPT <span>Pro</span></h1>
        </header>
        
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className={`message ${msg.role}`}>
                <div className={`bubble ${msg.role === 'assistant' && isRefusal && idx === messages.length-1 ? 'refusal-bubble' : ''}`}>
                  {renderMessageContent(msg)}
                </div>
              </div>
            </div>
          ))}
          {error && <div className="bubble error" style={{alignSelf:'center', color:'red'}}>⚠️ {String(error)}</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <form onSubmit={handleSend} className="input-wrapper">
            <input 
              ref={inputRef} 
              type="text" 
              placeholder={isLoading ? "生成中..." : "输入需求..."} 
              disabled={isLoading} 
            />
            {isLoading ? (
                <button type="button" className="stop-btn" onClick={actions.stopGeneration} style={{background:'none', color:'red', fontSize:'1.2rem', border:'none', cursor:'pointer'}}>⏹</button>
            ) : (
                <button type="submit" className="send-btn" style={{width:'32px', height:'32px'}}>➤</button>
            )}
          </form>
        </div>
      </div>

      {/* 3. Preview Panel */}
      <div className="preview-panel">
        <div className="preview-scroll-container">
          <PreviewPanel 
            slides={currentSlides} 
            onUpdateSlide={actions.updateSlide} 
            onExport={actions.handleExport}
            isLoading={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}

export default App;
