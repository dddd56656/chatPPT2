/**
 * [CTO Refactor] useChatMachine Hook
 * 职责: 核心业务状态机。
 * 包含: Phase 管理、Session 管理、消息流处理、幻灯片状态同步。
 */
import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useStream } from './useStream';
import { streamEndpoints } from '../api/client';

// 初始状态定义
const initialState = {
  phase: 'outline', // outline | content | exporting
  messages: [
    { role: 'system', content: '你好！我是 ChatPPT V3。请输入主题，我将为您实时生成大纲。' }
  ],
  currentSlides: [], // 结构化数据
  isLoading: false,
  error: null,
  sessionId: '',
};

// Reducer: 纯函数状态更新
function chatReducer(state, action) {
  switch (action.type) {
    case 'INIT_SESSION':
      return { ...state, sessionId: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'ADD_USER_MSG':
      return {
        ...state,
        messages: [...state.messages, { role: 'user', content: action.payload }]
      };
    case 'ADD_AI_PLACEHOLDER':
      return {
        ...state,
        messages: [...state.messages, { role: 'assistant', content: '' }]
      };
    case 'STREAM_UPDATE':
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') {
        last.content += action.payload;
      }
      return { ...state, messages: msgs };
    case 'SET_PHASE':
      return { ...state, phase: action.payload };
    case 'SET_SLIDES':
      return { ...state, currentSlides: action.payload };
    case 'RESET':
      return { ...initialState, sessionId: state.sessionId };
    default:
      return state;
  }
}

const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export const useChatMachine = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { streamRequest, abortStream } = useStream();
  
  // Ref 用于在闭包中访问最新状态
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Session 初始化
  useEffect(() => {
    let sid = localStorage.getItem('chatppt_session_id');
    if (!sid) {
      sid = generateUUID();
      localStorage.setItem('chatppt_session_id', sid);
    }
    dispatch({ type: 'INIT_SESSION', payload: sid });
  }, []);

  // --- 动作 1: 发送消息 ---
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
        // 尝试自动解析 Content JSON
        if (stateRef.current.phase === 'content') {
            const msgs = stateRef.current.messages;
            const content = msgs[msgs.length - 1].content;
            try {
                // 提取可能的 JSON 字符串
                const jsonMatch = content.match(/\[.*\]/s) || content.match(/\{.*\}/s);
                const jsonStr = jsonMatch ? jsonMatch[0] : content;
                const slides = JSON.parse(jsonStr);
                if (Array.isArray(slides)) dispatch({ type: 'SET_SLIDES', payload: slides });
            } catch (e) {
                console.warn("Auto-parse failed:", e);
            }
        }
      },
      onError: (err) => {
        dispatch({ type: 'SET_ERROR', payload: err });
        dispatch({ type: 'STREAM_UPDATE', payload: `\n[系统错误]: ${err}` });
      }
    });
  }, [streamRequest]);

  // --- 动作 2: 确认大纲 ---
  const confirmOutline = useCallback(() => {
    const { messages } = stateRef.current;
    const lastMsg = messages[messages.length - 1];
    
    try {
      const jsonMatch = lastMsg.content.match(/\{.*\}/s);
      const jsonStr = jsonMatch ? jsonMatch[0] : lastMsg.content;
      const data = JSON.parse(jsonStr);

      const initialSlides = [
        { slide_type: "title", title: data.main_topic, subtitle: data.summary_topic || "" },
        ...data.outline.map(item => ({
          slide_type: "two_column",
          title: item.sub_topic,
          left_topic: item.topic1, left_content: [],
          right_topic: item.topic2, right_content: []
        })),
        { slide_type: "content", title: "总结", content: ["谢谢观看"] }
      ];

      dispatch({ type: 'SET_SLIDES', payload: initialSlides });
      dispatch({ type: 'SET_PHASE', payload: 'content' });
      dispatch({ type: 'ADD_USER_MSG', payload: '[系统] 大纲已确认，进入内容生成阶段。' });
      
    } catch (e) {
      dispatch({ type: 'SET_ERROR', payload: "大纲解析失败，请确保 AI 生成了有效的 JSON。" });
    }
  }, []);

  // --- 动作 3: 开始导出 ---
  const startExport = useCallback(() => {
    dispatch({ type: 'SET_PHASE', payload: 'exporting' });
  }, []);

  const reset = useCallback(() => {
    abortStream();
    dispatch({ type: 'RESET' });
  }, [abortStream]);

  return {
    state,
    actions: { sendMessage, confirmOutline, startExport, reset }
  };
};
