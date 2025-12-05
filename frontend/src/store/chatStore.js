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
    messages: [{ role: 'system', content: '��� 欢迎！请输入主题、数据或文章，为您生成 PPT。' }],
    currentSlides: [],
    historyList: [],
    phase: 'outline',
    isLoading: false,
    isToolOpen: false,
    ragStatus: 'idle',
    // [New] 知识库文件列表：单一真实源
    ragFiles: [],
    init: () => {
      try {
        const indexStr = localStorage.getItem(INDEX_KEY);
        if (indexStr) set(state => { state.historyList = JSON.parse(indexStr) });
      } catch (e) { console.error(e) }
    },

    uploadRAGFile: async (file) => {
      const { sessionId } = get();
      set(state => { state.ragStatus = 'uploading'; });
      try {
        // [Modified]: 增加上传进度回调 (可选，预留接口)
        await ragAPI.uploadFile(file, sessionId);

        set(state => {
          state.ragStatus = 'success';
          state.messages.push({
            role: 'assistant',
            content: `📄 文档 **${file.name}** 已上传并开始索引。`
          });
        });

        // [New]: 上传成功后，立即刷新列表
        get().fetchRagFiles();

      } catch (e) {
        set(state => { state.ragStatus = 'error'; });
        // 使用标准 alert 是一种妥协，正式版建议用 Toast
        alert(`上传失败: ${e.message}`);
      } finally {
        // 2秒后重置状态，让 "Success" 图标展示一会儿
        setTimeout(() => set(state => { state.ragStatus = 'idle'; }), 2000);
      }
    },
    // [New Action] 获取文件列表
    fetchRagFiles: async () => {
      const { sessionId } = get();
      // 1. 防御性编程：如果会话未建立，不执行
      if (!sessionId) return;

      try {
        // 2. 调用我们在 client.js 定义的新 API
        // 注意：这里暂时不传 signal，简化 Store 逻辑，但在复杂场景下建议加上
        const files = await ragAPI.listFiles(sessionId);
        set(state => { state.ragFiles = files; });
      } catch (e) {
        console.error("Failed to fetch files:", e);
      }
    },

    // [New Action] 删除文件 (采用 Optimistic UI 模式)
    deleteRagFile: async (fileId) => {
      // 1. 截图：保存当前状态，以便回滚
      const previousFiles = get().ragFiles;

      // 2. 乐观更新：立即从 UI 移除，无需等待服务器响应
      set(state => {
        state.ragFiles = state.ragFiles.filter(f => f.id !== fileId);
      });

      try {
        // 3. 发送真实请求
        await ragAPI.deleteFile(fileId);
      } catch (e) {
        // 4. 回滚：如果失败，恢复原状并通知用户
        set(state => { state.ragFiles = previousFiles; });
        alert(`删除失败: ${e.message}`);
      }
    },
    sendMessage: async (text) => {
      if (!text.trim()) return;
      const { sessionId, phase, currentSlides } = get();

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
            current_slides: currentSlides.length > 0 ? currentSlides : undefined
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
        state.messages = [{ role: 'system', content: '��� 欢迎！请输入主题、数据或文章。' }];
        state.currentSlides = [];
        state.phase = 'outline';
        state.isToolOpen = false;
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
