import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { streamEndpoints } from '../api/client';
import { exportToPPTX } from '../utils/pptxExporter';

const SESSION_PREFIX = 'chatppt_session_';
const INDEX_KEY = 'chatppt_history_index';
const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const extractJSON = (str) => {
    if (!str) return null;
    const startArr = str.indexOf('[');
    const startObj = str.indexOf('{');
    if (startArr === -1 && startObj === -1) return null;
    let start = -1;
    if (startArr !== -1 && startObj !== -1) start = Math.min(startArr, startObj);
    else if (startArr !== -1) start = startArr;
    else start = startObj;
    return str.substring(start).replace(/```json/g, '').replace(/```/g, '').trim();
};

let currentController = null;

export const useChatStore = create(
  immer((set, get) => ({
    sessionId: generateUUID(),
    title: '新对话',
    messages: [{ role: 'system', content: '��� 欢迎！请输入主题、数据或文章，为您生成 PPT。' }],
    currentSlides: [],
    phase: 'outline',
    isLoading: false,
    error: null,
    isRefusal: false,
    historyList: [],
    
    // [New] 工具面板状态：默认关闭，作为 MCP 工具按需打开
    isToolOpen: false, 

    init: () => {
      try {
        const indexStr = localStorage.getItem(INDEX_KEY);
        if (indexStr) set(state => { state.historyList = JSON.parse(indexStr) });
      } catch (e) { console.error(e) }
    },

    createNewSession: () => {
      if (currentController) currentController.abort();
      set(state => {
        state.sessionId = generateUUID();
        state.title = '新对话';
        state.messages = [{ role: 'system', content: '��� 欢迎！请输入主题、数据或文章，为您生成 PPT。' }];
        state.currentSlides = [];
        state.phase = 'outline';
        state.isLoading = false;
        state.error = null;
        state.isRefusal = false;
        state.isToolOpen = false; // 重置工具状态
      });
    },

    loadSession: (sessionId) => {
        if (currentController) currentController.abort();
        try {
            const dataStr = localStorage.getItem(SESSION_PREFIX + sessionId);
            if (dataStr) {
                const data = JSON.parse(dataStr);
                set(state => ({ 
                    ...state, ...data, sessionId, 
                    isLoading: false, error: null,
                    isToolOpen: data.currentSlides?.length > 0 // 如果有内容，自动打开工具
                }));
            }
        } catch (e) {}
    },

    setToolOpen: (isOpen) => set(state => { state.isToolOpen = isOpen }),

    sendMessage: async (text) => {
      if (!text.trim()) return;
      const { sessionId, phase, currentSlides } = get();

      set(state => {
        if (state.messages.length <= 1) state.title = text.slice(0, 15);
        state.messages.push({ role: 'user', content: text });
        state.messages.push({ role: 'assistant', content: '' });
        state.isLoading = true;
        state.error = null;
        state.isRefusal = false;
      });

      if (currentController) currentController.abort();
      currentController = new AbortController();

      const endpoint = (phase === 'outline' && currentSlides.length === 0) 
        ? streamEndpoints.outline 
        : streamEndpoints.content;

      const body = { 
        session_id: sessionId, 
        user_message: text,
        current_slides: currentSlides.length > 0 ? currentSlides : undefined 
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: currentController.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr.trim() === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  set(state => {
                    const lastMsg = state.messages[state.messages.length - 1];
                    lastMsg.content += parsed.text;
                  });
                } else if (parsed.error) throw new Error(parsed.error);
              } catch (e) {}
            }
          }
        }
        get().checkRefusal();
      } catch (err) {
        if (err.name !== 'AbortError') set(state => { state.error = err.message });
      } finally {
        currentController = null;
        set(state => { state.isLoading = false });
        get().saveSession();
      }
    },

    checkRefusal: () => {
        const msgs = get().messages;
        const lastContent = msgs[msgs.length - 1].content;
        if (lastContent.includes('"refusal": true')) {
            set(state => { state.isRefusal = true });
        }
    },

    // 核心：应用数据并打开工具面板
    applyCanvas: (content) => {
        const jsonStr = extractJSON(content);
        if (!jsonStr) { alert("未检测到 PPT 数据"); return; }
        try {
            const data = JSON.parse(jsonStr);
            if (Array.isArray(data)) {
                set(state => { 
                    state.currentSlides = data; 
                    state.phase = 'content';
                    state.isToolOpen = true; // Auto-open tool
                });
                get().saveSession();
            } else { alert("数据格式错误"); }
        } catch (e) { alert("解析失败"); }
    },

    updateSlide: (index, field, value, subIndex) => {
      set(state => {
        const slide = state.currentSlides[index];
        if (subIndex !== undefined && Array.isArray(slide[field])) {
          slide[field][subIndex] = value;
        } else {
          slide[field] = value;
        }
      });
      get().saveSession();
    },

    handleExport: async () => {
        try {
            set(state => { state.isLoading = true });
            await exportToPPTX(get().currentSlides);
        } catch (e) {
            set(state => { state.error = "导出失败: " + e.message });
        } finally {
            set(state => { state.isLoading = false });
        }
    },
    
    stopGeneration: () => {
        if (currentController) {
            currentController.abort();
            currentController = null;
            set(state => { state.isLoading = false; state.messages[state.messages.length - 1].content += "\n[已停止]"; });
        }
    },

    // Persistence (Safe Guarded)
    saveSession: () => {
        const state = get();
        if (state.messages.length <= 1 && state.currentSlides.length === 0) return;
        const sessionData = {
            sessionId: state.sessionId,
            title: state.title,
            messages: state.messages,
            currentSlides: state.currentSlides,
            phase: state.phase
        };
        localStorage.setItem(SESSION_PREFIX + state.sessionId, JSON.stringify(sessionData));
        get().syncToLocalStorage();
    },

    syncToLocalStorage: () => {
        const state = get();
        if (state.messages.length <= 1 && state.currentSlides.length === 0) return;
        const previewText = state.messages.length > 1 ? state.messages[1].content.slice(0, 30) : '空对话';
        const newItem = { id: state.sessionId, title: state.title, time: Date.now(), preview: previewText };
        set(s => {
            const idx = s.historyList.findIndex(item => item.id === state.sessionId);
            if (idx >= 0) s.historyList[idx] = { ...s.historyList[idx], ...newItem };
            else s.historyList.unshift(newItem);
        });
        localStorage.setItem(INDEX_KEY, JSON.stringify(get().historyList));
    },

    renameSession: (id, title) => { /* ...Same as before... */
        set(state => {
            if (state.sessionId === id) state.title = title;
            const item = state.historyList.find(i => i.id === id);
            if (item) item.title = title;
        });
        get().syncToLocalStorage();
        try { const s=JSON.parse(localStorage.getItem(SESSION_PREFIX+id)); s.title=title; localStorage.setItem(SESSION_PREFIX+id, JSON.stringify(s)); } catch(e){}
    },
    deleteSession: (id) => { /* ...Same as before... */
        if (!window.confirm("确定删除？")) return;
        localStorage.removeItem(SESSION_PREFIX + id);
        set(state => {
            state.historyList = state.historyList.filter(item => item.id !== id);
            if (state.sessionId === id) {
                state.sessionId = generateUUID();
                state.title = '新对话';
                state.messages = [{ role: 'system', content: '��� 欢迎！请输入主题、数据或文章，为您生成 PPT。' }];
                state.currentSlides = [];
                state.phase = 'outline';
                state.isToolOpen = false;
            }
        });
        localStorage.setItem(INDEX_KEY, JSON.stringify(get().historyList));
    }
  }))
);
