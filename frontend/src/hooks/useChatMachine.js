import { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { useStream } from './useStream';
import { streamEndpoints, generationAPI } from '../api/client';
import { exportToPPTX } from '../utils/pptxExporter';

const INDEX_KEY = 'chatppt_history_index'; 
const SESSION_PREFIX = 'chatppt_session_';

const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const defaultState = {
  phase: 'outline', 
  messages: [
    { role: 'system', content: '��� 欢迎！请输入主题、数据或文章，为您生成 PPT。' }
  ],
  currentSlides: [], 
  isLoading: false,
  error: null,
  sessionId: '', 
  title: '新对话', 
  isRefusal: false,
};

const init = () => ({ ...defaultState, sessionId: generateUUID() });

function chatReducer(state, action) {
  switch (action.type) {
    case 'LOAD_SESSION': return { ...action.payload, isLoading: false, error: null };
    case 'NEW_SESSION': return { ...defaultState, sessionId: generateUUID() };
    
    case 'SET_LOADING': return { ...state, isLoading: action.payload, error: null, isRefusal: false };
    case 'SET_ERROR': return { ...state, isLoading: false, error: action.payload };
    case 'ADD_USER_MSG': return { ...state, messages: [...state.messages, { role: 'user', content: action.payload }] };
    case 'ADD_AI_PLACEHOLDER': return { ...state, messages: [...state.messages, { role: 'assistant', content: '' }] };
    
    case 'STREAM_UPDATE': {
      const msgs = [...state.messages];
      const lastIndex = msgs.length - 1;
      if (lastIndex >= 0 && msgs[lastIndex].role === 'assistant') {
        const newLastMsg = { ...msgs[lastIndex] };
        newLastMsg.content += String(action.payload || "");
        msgs[lastIndex] = newLastMsg;
      }
      return { ...state, messages: msgs };
    }

    case 'SET_PHASE': return { ...state, phase: action.payload };
    case 'SET_SLIDES': return { ...state, currentSlides: action.payload };
    case 'SET_REFUSAL': return { ...state, isRefusal: true, isLoading: false };
    case 'SET_TITLE': return { ...state, title: action.payload };

    case 'UPDATE_SLIDE': {
      const { index, field, value, subIndex } = action.payload;
      const newSlides = [...state.currentSlides];
      const targetSlide = { ...newSlides[index] };
      if (subIndex !== undefined && Array.isArray(targetSlide[field])) {
        targetSlide[field][subIndex] = value;
      } else {
        targetSlide[field] = value;
      }
      newSlides[index] = targetSlide;
      return { ...state, currentSlides: newSlides };
    }

    default: return state;
  }
}

const extractJSON = (rawStr) => {
  if (!rawStr) return null;
  let clean = rawStr.replace(/```json/g, '').replace(/```/g, '').trim();
  const startArr = clean.indexOf('[');
  const startObj = clean.indexOf('{');
  let start = -1;
  if (startArr !== -1 && startObj !== -1) start = Math.min(startArr, startObj);
  else if (startArr !== -1) start = startArr;
  else if (startObj !== -1) start = startObj;
  if (start !== -1) return clean.substring(start);
  return null;
};

export const useChatMachine = () => {
  const [state, dispatch] = useReducer(chatReducer, undefined, init);
  const { streamRequest, abortStream } = useStream();
  const stateRef = useRef(state);
  
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Load History Index
  useEffect(() => {
    try {
      const indexStr = localStorage.getItem(INDEX_KEY);
      if (indexStr) setHistoryList(JSON.parse(indexStr));
    } catch (e) { console.error("History load error", e); }
  }, []);

  // Auto-save & Update Index (Triggered by state change)
  useEffect(() => {
    if (!state.sessionId) return;
    
    localStorage.setItem(SESSION_PREFIX + state.sessionId, JSON.stringify(state));

    setHistoryList(prevList => {
      const existingIdx = prevList.findIndex(item => item.id === state.sessionId);
      
      // Construct the item
      const newItem = {
        id: state.sessionId,
        title: state.title, // This title comes from the current session state
        time: Date.now(),
        preview: state.messages.length > 1 ? state.messages[1].content.slice(0, 30) : '空对话'
      };

      let newList;
      if (existingIdx >= 0) {
        // Optimization: Only update if title/preview actually changed to avoid loop
        // But here we need to be careful. The Rename Action updates the LIST, not the STATE directly.
        // So we should only auto-update if the current session title matches the state title.
        // To avoid conflicts, we will let renameSession handle explicit renames, 
        // and this effect only handles auto-saves from conversation updates.
        
        // Simple merge:
        newList = [...prevList];
        // Preserve the title if it was manually renamed (we assume manual rename updates state.title too)
        newList[existingIdx] = { ...newList[existingIdx], ...newItem };
      } else {
        newList = [newItem, ...prevList];
      }
      
      localStorage.setItem(INDEX_KEY, JSON.stringify(newList));
      return newList;
    });
  }, [state]);

  // --- Actions ---

  const loadSession = useCallback((sessionId) => {
    try {
      const dataStr = localStorage.getItem(SESSION_PREFIX + sessionId);
      if (dataStr) {
        abortStream();
        dispatch({ type: 'LOAD_SESSION', payload: JSON.parse(dataStr) });
      }
    } catch (e) { console.error("Load session failed", e); }
  }, [abortStream]);

  const deleteSession = useCallback((sessionId, e) => {
    e.stopPropagation();
    if (!window.confirm("确定删除此对话吗？不可恢复。")) return;

    localStorage.removeItem(SESSION_PREFIX + sessionId);
    
    setHistoryList(prev => {
        const newList = prev.filter(item => item.id !== sessionId);
        localStorage.setItem(INDEX_KEY, JSON.stringify(newList));
        return newList;
    });

    if (stateRef.current.sessionId === sessionId) {
        dispatch({ type: 'NEW_SESSION' });
    }
  }, []);

  // [New] 重命名会话
  const renameSession = useCallback((sessionId, newTitle) => {
    if (!newTitle.trim()) return;
    
    // 1. 更新列表
    setHistoryList(prev => {
        const newList = prev.map(item => 
            item.id === sessionId ? { ...item, title: newTitle } : item
        );
        localStorage.setItem(INDEX_KEY, JSON.stringify(newList));
        return newList;
    });

    // 2. 如果重命名的是当前会话，同步更新当前状态
    if (stateRef.current.sessionId === sessionId) {
        dispatch({ type: 'SET_TITLE', payload: newTitle });
    }
    
    // 3. 更新具体的 Session 存储中的标题
    try {
        const sessionDataStr = localStorage.getItem(SESSION_PREFIX + sessionId);
        if (sessionDataStr) {
            const sessionData = JSON.parse(sessionDataStr);
            sessionData.title = newTitle;
            localStorage.setItem(SESSION_PREFIX + sessionId, JSON.stringify(sessionData));
        }
    } catch(e) {}

  }, []);

  const createNewSession = useCallback(() => {
    abortStream();
    dispatch({ type: 'NEW_SESSION' });
  }, [abortStream]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    // Auto-title for first message
    if (stateRef.current.messages.length <= 1) {
        dispatch({ type: 'SET_TITLE', payload: text.slice(0, 15) });
    }

    dispatch({ type: 'ADD_USER_MSG', payload: text });
    dispatch({ type: 'ADD_AI_PLACEHOLDER' });
    dispatch({ type: 'SET_LOADING', payload: true });

    const { phase, sessionId, currentSlides } = stateRef.current;
    
    const endpoint = (phase === 'outline' && currentSlides.length === 0) 
        ? streamEndpoints.outline 
        : streamEndpoints.content;
    
    const body = { 
      session_id: sessionId, 
      user_message: text,
      current_slides: currentSlides.length > 0 ? currentSlides : undefined 
    };

    await streamRequest(endpoint, body, {
      onChunk: (textChunk) => {
        dispatch({ type: 'STREAM_UPDATE', payload: textChunk });
      },
      onDone: () => {
        dispatch({ type: 'SET_LOADING', payload: false });
        
        const msgs = stateRef.current.messages;
        const lastContent = msgs[msgs.length - 1].content;
        
        try {
            const cleanJson = extractJSON(lastContent);
            if (!cleanJson) return; 
            const data = JSON.parse(cleanJson);

            if (data.refusal) {
                dispatch({ type: 'SET_REFUSAL' });
                return;
            }
            if (Array.isArray(data)) {
                dispatch({ type: 'SET_SLIDES', payload: data });
                dispatch({ type: 'SET_PHASE', payload: 'content' });
            }
        } catch (e) {
            console.warn("JSON Parse Warning:", e);
        }
      },
      onError: (err) => {
        if (err !== 'AbortError') dispatch({ type: 'SET_ERROR', payload: err });
      }
    });
  }, [streamRequest]);

  const handleExport = useCallback(async () => {
     try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await exportToPPTX(stateRef.current.currentSlides); 
        dispatch({ type: 'SET_LOADING', payload: false });
     } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e.message });
        dispatch({ type: 'SET_LOADING', payload: false });
     }
  }, []);

  const stopGeneration = useCallback(() => {
    abortStream();
    dispatch({ type: 'SET_LOADING', payload: false });
    dispatch({ type: 'STREAM_UPDATE', payload: "\n[已停止]" });
  }, [abortStream]);

  const updateSlide = useCallback((index, field, value, subIndex) => {
    dispatch({ type: 'UPDATE_SLIDE', payload: { index, field, value, subIndex } });
  }, []);

  const generateDetails = useCallback(() => {
      sendMessage("请基于当前结构，丰富并填充详细内容，生成正式的 PPT");
  }, [sendMessage]);

  return { 
    state, 
    historyList, 
    actions: { 
      sendMessage, handleExport, stopGeneration, updateSlide, generateDetails,
      createNewSession, loadSession, deleteSession, renameSession // [New]
    } 
  };
};
