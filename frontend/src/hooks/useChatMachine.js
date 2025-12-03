import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useStream } from './useStream';
import { streamEndpoints, generationAPI } from '../api/client';
import { exportToPPTX } from '../utils/pptxExporter';

const initialState = {
  phase: 'outline', 
  messages: [
    { role: 'system', content: '欢迎！请粘贴您的【文本数据】、【报告摘要】或【制作要求】，我将直接为您生成 PPT。' }
  ],
  currentSlides: [], 
  isLoading: false,
  error: null,
  sessionId: '',
  isRefusal: false,
};

function chatReducer(state, action) {
  switch (action.type) {
    case 'INIT_SESSION': return { ...state, sessionId: action.payload };
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

    case 'UPDATE_SLIDE': {
      const { index, field, value, subIndex } = action.payload;
      const newSlides = [...state.currentSlides];
      const targetSlide = { ...newSlides[index] };
      if (subIndex !== undefined && Array.isArray(targetSlide[field])) {
        const newArray = [...targetSlide[field]];
        newArray[subIndex] = value;
        targetSlide[field] = newArray;
      } else {
        targetSlide[field] = value;
      }
      newSlides[index] = targetSlide;
      return { ...state, currentSlides: newSlides };
    }

    case 'RESET': return { ...initialState, sessionId: state.sessionId };
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

const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export const useChatMachine = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { streamRequest, abortStream } = useStream();
  const stateRef = useRef(state);
  
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let sid = localStorage.getItem('chatppt_session_id');
    if (!sid) {
      sid = generateUUID();
      localStorage.setItem('chatppt_session_id', sid);
    }
    dispatch({ type: 'INIT_SESSION', payload: sid });
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

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
        if (err !== 'AbortError') {
            dispatch({ type: 'SET_ERROR', payload: err });
        }
      }
    });

  }, [streamRequest]);

  const handleExport = useCallback(async () => {
     try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const { currentSlides } = stateRef.current;
        await exportToPPTX(currentSlides); 
        dispatch({ type: 'SET_LOADING', payload: false });
     } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: "导出失败: " + e.message });
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

  const reset = useCallback(() => { abortStream(); dispatch({ type: 'RESET' }); }, [abortStream]);

  const generateDetails = useCallback(() => {
      sendMessage("请基于当前结构，丰富并填充详细内容，生成正式的 PPT");
  }, [sendMessage]);

  return { 
    state, 
    actions: { 
      sendMessage, 
      handleExport, 
      reset, 
      stopGeneration, 
      updateSlide,
      generateDetails
    } 
  };
};
