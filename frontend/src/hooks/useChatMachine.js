import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useStream } from './useStream';
import { streamEndpoints, generationAPI } from '../api/client';
import { useTask } from './useTask';

const initialState = {
  phase: 'outline', 
  messages: [
    { role: 'system', content: '欢迎！我是 ChatPPT。请输入 PPT 主题（例如：2025年人工智能趋势）。' }
  ],
  currentSlides: [], 
  isLoading: false,
  error: null,
  sessionId: '',
};

function chatReducer(state, action) {
  switch (action.type) {
    case 'INIT_SESSION': return { ...state, sessionId: action.payload };
    case 'SET_LOADING': return { ...state, isLoading: action.payload, error: null };
    case 'SET_ERROR': return { ...state, isLoading: false, error: action.payload };
    case 'ADD_USER_MSG': return { ...state, messages: [...state.messages, { role: 'user', content: action.payload }] };
    case 'ADD_AI_PLACEHOLDER': return { ...state, messages: [...state.messages, { role: 'assistant', content: '' }] };
    
    case 'STREAM_UPDATE': {
      const msgs = [...state.messages];
      const lastIndex = msgs.length - 1;
      if (lastIndex >= 0 && msgs[lastIndex].role === 'assistant') {
        const newLastMsg = { ...msgs[lastIndex] };
        // 安全追加字符串
        newLastMsg.content += String(action.payload || "");
        msgs[lastIndex] = newLastMsg;
      }
      return { ...state, messages: msgs };
    }

    case 'SET_PHASE': return { ...state, phase: action.payload };
    case 'SET_SLIDES': return { ...state, currentSlides: action.payload };
    case 'RESET': return { ...initialState, sessionId: state.sessionId };
    default: return state;
  }
}

const extractJSON = (rawStr) => {
  if (!rawStr) return null;
  let clean = rawStr.replace(/```json/g, '').replace(/```/g, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return clean.substring(start, end + 1);
  }
  return null;
};

const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export const useChatMachine = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { streamRequest, abortStream } = useStream();
  const { startExportPolling } = useTask();
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
    const endpoint = phase === 'outline' ? streamEndpoints.outline : streamEndpoints.content;
    
    const body = { 
      session_id: sessionId, 
      user_message: text,
      current_slides: phase === 'content' ? currentSlides : undefined 
    };

    await streamRequest(endpoint, body, {
      onChunk: (textChunk) => {
        dispatch({ type: 'STREAM_UPDATE', payload: textChunk });
      },
      onDone: () => {
        dispatch({ type: 'SET_LOADING', payload: false });
        if (stateRef.current.phase === 'content') {
            const msgs = stateRef.current.messages;
            const content = msgs[msgs.length - 1].content;
            try {
                const cleanJson = extractJSON(content);
                if (cleanJson) {
                    const slides = JSON.parse(cleanJson);
                    if (Array.isArray(slides)) {
                        dispatch({ type: 'SET_SLIDES', payload: slides });
                    }
                }
            } catch (e) {
                console.warn("JSON Parse Warning:", e);
            }
        }
      },
      onError: (err) => {
        dispatch({ type: 'SET_ERROR', payload: err });
        dispatch({ type: 'STREAM_UPDATE', payload: `\n[系统错误]: ${err}` });
      }
    });

  }, [streamRequest]);

  const confirmOutline = useCallback(() => {
    const { messages } = stateRef.current;
    const lastMsg = messages[messages.length - 1];
    try {
      const cleanJson = extractJSON(lastMsg.content);
      if (!cleanJson) throw new Error("无法识别有效的大纲数据");
      
      const data = JSON.parse(cleanJson);

      const initialSlides = [
        { slide_type: "title", title: data.main_topic, subtitle: data.summary_topic || "" },
        ...data.outline.map(item => ({
          slide_type: "two_column",
          title: item.sub_topic,
          left_topic: item.topic1, left_content: [],
          right_topic: item.topic2, right_content: []
        })),
        { slide_type: "content", title: "总结", content: ["感谢您的时间"] }
      ];

      dispatch({ type: 'SET_SLIDES', payload: initialSlides });
      dispatch({ type: 'SET_PHASE', payload: 'content' });
      dispatch({ type: 'ADD_USER_MSG', payload: '大纲已确认，正在生成详细内容...' });
      
      sendMessage("请为所有页面填充详细的中文内容"); 
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_ERROR', payload: "大纲格式错误，请重试。" });
    }
  }, [sendMessage]);

  const startExport = useCallback(async () => {
     try {
        const { currentSlides } = stateRef.current;
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const contentJson = {
            title: currentSlides.find(s => s.slide_type === 'title')?.title || "Presentation",
            slides_data: currentSlides
        };
        
        const res = await generationAPI.exportPpt(contentJson);
        const taskId = res.data.task_id;
        
        startExportPolling(taskId);
        
        dispatch({ type: 'ADD_AI_PLACEHOLDER' });
        dispatch({ type: 'STREAM_UPDATE', payload: "正在生成 PPT 文件，请稍候..." });
        dispatch({ type: 'SET_LOADING', payload: false });
        
     } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: "导出失败，请检查网络" });
        dispatch({ type: 'SET_LOADING', payload: false });
     }
  }, [startExportPolling]);

  const reset = useCallback(() => { abortStream(); dispatch({ type: 'RESET' }); }, [abortStream]);

  return { state, actions: { sendMessage, confirmOutline, startExport, reset } };
};
