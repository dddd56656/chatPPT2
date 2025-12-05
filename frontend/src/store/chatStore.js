import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { streamEndpoints, ragAPI } from '../api/client';
import { exportToPPTX } from '../utils/pptxExporter';

const SESSION_PREFIX = 'chatppt_session_';
const INDEX_KEY = 'chatppt_history_index';
const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const extractJSON = (str) => {
  if (!str) return null;
  const startArr = str.indexOf('[');
  const startObj = str.indexOf('{');
  if (startArr === -1 && startObj === -1) return null;
  let start = (startArr !== -1 && startObj !== -1) ? Math.min(startArr, startObj) : (startArr !== -1 ? startArr : startObj);
  return str.substring(start).replace(/```json/g, '').replace(/```/g, '').trim();
};

let currentController = null;

export const useChatStore = create(
  immer((set, get) => ({
    sessionId: generateUUID(),
    title: '新对话',
    messages: [{ role: 'system', content: '👋 欢迎！请输入主题、数据或文章，为您生成 PPT。' }],
    currentSlides: [],
    historyList: [],
    phase: 'outline',
    isLoading: false,
    isToolOpen: false,
    ragStatus: 'idle',
    ragFiles: [], 
    // [New] 已勾选的文件 ID 集合
    selectedRagFileIds: [], 

    init: () => {
      try {
        const indexStr = localStorage.getItem(INDEX_KEY);
        if (indexStr) set(state => { state.historyList = JSON.parse(indexStr) });
      } catch (e) { console.error(e) }
    },

    // [New Action] 切换文件勾选状态
    toggleRagFileSelection: (fileId) => {
        set(state => {
            const index = state.selectedRagFileIds.indexOf(fileId);
            if (index > -1) {
                state.selectedRagFileIds.splice(index, 1); // 取消勾选
            } else {
                state.selectedRagFileIds.push(fileId); // 勾选
            }
        });
    },

    uploadRAGFile: async (file) => {
      const { sessionId } = get();
      set(state => { state.ragStatus = 'uploading'; });
      try {
        await ragAPI.uploadFile(file, sessionId);
        
        // 刷新列表
        await get().fetchRagFiles();
        
        set(state => {
          state.ragStatus = 'success';
          // [UX] 上传成功后，自动默认勾选最新上传的文件
          // 找到刚上传的文件（假设是列表第一个，因为后端按时间倒序）
          const newFile = state.ragFiles[0]; 
          if(newFile && !state.selectedRagFileIds.includes(newFile.id)) {
              state.selectedRagFileIds.push(newFile.id);
          }
          
          state.messages.push({
            role: 'assistant',
            content: `📄 文档 **${file.name}** 已上传并选中。`
          });
        });

      } catch (e) {
        set(state => { state.ragStatus = 'error'; });
        alert(`上传失败: ${e.message}`);
      } finally {
        setTimeout(() => set(state => { state.ragStatus = 'idle'; }), 2000);
      }
    },

    fetchRagFiles: async () => {
      const { sessionId } = get();
      if (!sessionId) return;
      try {
        const files = await ragAPI.listFiles(sessionId);
        set(state => { 
            state.ragFiles = files; 
            // [Optional] 如果是初次加载，可以保留之前的选中状态，或者全选？
            // 这里保持用户之前的选中状态，如果文件被删除了，过滤掉
            state.selectedRagFileIds = state.selectedRagFileIds.filter(id => files.find(f => f.id === id));
        });
      } catch (e) { console.error(e); }
    },

    deleteRagFile: async (fileId) => {
      const previousFiles = get().ragFiles;
      set(state => {
        state.ragFiles = state.ragFiles.filter(f => f.id !== fileId);
        // 删除时同时也取消勾选
        state.selectedRagFileIds = state.selectedRagFileIds.filter(id => id !== fileId);
      });
      try {
        await ragAPI.deleteFile(fileId);
      } catch (e) {
        set(state => { state.ragFiles = previousFiles; });
        alert(`删除失败: ${e.message}`);
      }
    },

    sendMessage: async (text) => {
      if (!text.trim()) return;
      // [Modified] 获取 selectedRagFileIds
      const { sessionId, phase, currentSlides, selectedRagFileIds } = get();

      set(state => {
        if (state.messages.length <= 1) state.title = text.slice(0, 15);
        state.messages.push({ role: 'user', content: text });
        state.messages.push({ role: 'assistant', content: '' });
        state.isLoading = true;
      });

      if (currentController) currentController.abort();
      currentController = new AbortController();

      const endpoint = (phase === 'outline' && currentSlides.length === 0)
        ? streamEndpoints.outline
        : streamEndpoints.content;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            user_message: text,
            current_slides: currentSlides.length > 0 ? currentSlides : undefined,
            // [Critical Fix] 只发送用户勾选的文件 ID
            rag_file_ids: selectedRagFileIds.length > 0 ? selectedRagFileIds : undefined
          }),
          signal: currentController.signal,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n');
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
                }
              } catch (e) { }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      } finally {
        currentController = null;
        set(state => { state.isLoading = false });
        get().saveSession();
      }
    },

    // ... (applyCanvas, handleExport, updateSlide, etc. 保持不变)
    applyCanvas: (content) => {
      const jsonStr = extractJSON(content);
      if (!jsonStr) { alert("未检测到 PPT 数据"); return; }
      try {
        const data = JSON.parse(jsonStr);
        if (Array.isArray(data)) {
          set(state => {
            state.currentSlides = data;
            state.phase = 'content';
            state.isToolOpen = true;
          });
          get().saveSession();
        }
      } catch (e) { alert("解析失败"); }
    },

    handleExport: async () => {
      try {
        set(state => { state.isLoading = true });
        await exportToPPTX(get().currentSlides);
      } catch (e) {
        alert("导出失败: " + e.message);
      } finally {
        set(state => { state.isLoading = false });
      }
    },

    setToolOpen: (isOpen) => set(state => { state.isToolOpen = isOpen }),
    updateSlide: (idx, field, val, subIdx) => {
      set(state => {
        const slide = state.currentSlides[idx];
        if (subIdx !== undefined) slide[field][subIdx] = val;
        else slide[field] = val;
      });
      get().saveSession();
    },

    stopGeneration: () => {
      if (currentController) currentController.abort();
      set(state => { state.isLoading = false; });
    },

    createNewSession: () => {
      if (currentController) currentController.abort();
      set(state => {
        state.sessionId = generateUUID();
        state.title = '新对话';
        state.messages = [{ role: 'system', content: '👋 欢迎！请输入主题、数据或文章。' }];
        state.currentSlides = [];
        state.phase = 'outline';
        state.isToolOpen = false;
        state.ragFiles = []; // 清空文件列表
        state.selectedRagFileIds = []; // 清空勾选
      });
    },

    loadSession: (id) => {
      try {
        const data = JSON.parse(localStorage.getItem(SESSION_PREFIX + id));
        if (data) set(state => ({ ...state, ...data, sessionId: id, isToolOpen: !!data.currentSlides?.length }));
      } catch (e) { }
    },

    saveSession: () => {
      const s = get();
      if (s.messages.length <= 1) return;
      localStorage.setItem(SESSION_PREFIX + s.sessionId, JSON.stringify({
        title: s.title, messages: s.messages, currentSlides: s.currentSlides, phase: s.phase
      }));
      set(state => {
        const newItem = { id: s.sessionId, title: s.title, time: Date.now() };
        const idx = state.historyList.findIndex(i => i.id === s.sessionId);
        if (idx >= 0) state.historyList[idx] = newItem;
        else state.historyList.unshift(newItem);
        localStorage.setItem(INDEX_KEY, JSON.stringify(state.historyList));
      });
    },

    deleteSession: (id) => {
      localStorage.removeItem(SESSION_PREFIX + id);
      set(state => {
        state.historyList = state.historyList.filter(i => i.id !== id);
        localStorage.setItem(INDEX_KEY, JSON.stringify(state.historyList));
        if (state.sessionId === id) get().createNewSession();
      });
    },

    renameSession: (id, newTitle) => {
      set(state => {
        if (state.sessionId === id) state.title = newTitle;
        const item = state.historyList.find(i => i.id === id);
        if (item) item.title = newTitle;
        localStorage.setItem(INDEX_KEY, JSON.stringify(state.historyList));
      });
    }
  }))
);