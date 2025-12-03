/**
 * [CTO Refactor] useChatMachine Hook
 * Includes: Robust JSON Parsing & State Management
 */
import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useStream } from './useStream';
import { streamEndpoints } from '../api/client';
import { useTask } from './useTask';

const initialState = {
  phase: 'outline', 
  messages: [
    { role: 'system', content: 'Welcome to ChatPPT. Tell me a topic to begin.' }
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
    case 'STREAM_UPDATE': 
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'assistant') last.content += action.payload;
      return { ...state, messages: msgs };
    case 'SET_PHASE': return { ...state, phase: action.payload };
    case 'SET_SLIDES': return { ...state, currentSlides: action.payload };
    case 'RESET': return { ...initialState, sessionId: state.sessionId };
    default: return state;
  }
}

// Helper: Clean raw output to extract valid JSON
const extractJSON = (rawStr) => {
  if (!rawStr) return null;
  // 1. Remove markdown code blocks
  let clean = rawStr.replace(/```json/g, '').replace(/```/g, '').trim();
  // 2. Try to find the outer brackets if there's noise around
  const startObj = clean.indexOf('{');
  const startArr = clean.indexOf('[');
  
  // Simple heuristic to find start
  let start = -1;
  if (startObj !== -1 && startArr !== -1) start = Math.min(startObj, startArr);
  else if (startObj !== -1) start = startObj;
  else if (startArr !== -1) start = startArr;

  if (start !== -1) {
    clean = clean.substring(start);
  }
  return clean;
};

const generateUUID = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

export const useChatMachine = () => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { streamRequest, abortStream } = useStream();
  const { startExportPolling } = useTask(); // Integrate Task Polling
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
    
    // Note: Ensure your backend supports these endpoints!
    // Fallback to conversational endpoints if stream not available
    // Here we assume V2 Async endpoints for now, but simulating stream structure
    // If you are using true V2 Async, this logic adapts to wait for tasks.
    // For this refactor, we align with the V2 Async API you provided earlier.
    
    // HACK: Since we are using V2 Async API (Task-based) in this environment,
    // we will simulate the stream experience or use the V2 task polling mechanism
    // if the backend hasn't been upgraded to true streaming yet.
    
    // However, per previous context, we stick to the provided API structure.
    // Let's assume the V2 API client is set up.
    
    // Using the generationAPI from client.js (V2 Async)
    try {
        const { generationAPI } = await import('../api/client');
        
        let response;
        if (phase === 'outline') {
            // Construct history for V2 API
            const history = stateRef.current.messages.map(m => ({
                role: m.role,
                content: m.content
            }));
            response = await generationAPI.generateOutline_conversational(history);
        } else {
            const history = [
                 { role: 'system', content: '用户正在修改内容' },
                 { role: 'user', content: text }
            ];
            response = await generationAPI.generateContent_conversational(history, currentSlides);
        }
        
        // V2 Async Logic: We get a Task ID, we need to poll it.
        // But useChatMachine was designed for Streaming.
        // We will bridge it here:
        
        const taskId = response.data.task_id;
        
        // Temporary Polling inside the Machine (Bridging V2 Async to Stream-like UX)
        const pollInterval = setInterval(async () => {
            const { taskAPI } = await import('../api/client');
            const res = await taskAPI.getTaskStatus(taskId);
            const status = res.data.status;
            
            if (status === 'success') {
                clearInterval(pollInterval);
                const result = res.data.result;
                
                let aiText = "";
                if (result.outline) {
                     aiText = JSON.stringify(result.outline, null, 2);
                     dispatch({ type: 'STREAM_UPDATE', payload: aiText });
                     // Auto confirm logic not needed, user clicks button
                } else if (result.slides_data) {
                     aiText = JSON.stringify(result.slides_data, null, 2); // Hidden raw data
                     dispatch({ type: 'STREAM_UPDATE', payload: "内容已更新，请查看右侧预览。" });
                     dispatch({ type: 'SET_SLIDES', payload: result.slides_data });
                }
                
                dispatch({ type: 'SET_LOADING', payload: false });
            } else if (status === 'failure') {
                clearInterval(pollInterval);
                dispatch({ type: 'STREAM_UPDATE', payload: `Error: ${res.data.error}` });
                dispatch({ type: 'SET_ERROR', payload: res.data.error });
            }
        }, 1000);
        
    } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: e.message });
        dispatch({ type: 'SET_LOADING', payload: false });
    }

  }, []);

  const confirmOutline = useCallback(() => {
    const { messages } = stateRef.current;
    const lastMsg = messages[messages.length - 1];
    try {
      // Robust JSON extraction
      const cleanJson = extractJSON(lastMsg.content);
      if (!cleanJson) throw new Error("No JSON found");
      
      const data = JSON.parse(cleanJson);

      const initialSlides = [
        { slide_type: "title", title: data.main_topic, subtitle: data.summary_topic || "" },
        ...data.outline.map(item => ({
          slide_type: "two_column",
          title: item.sub_topic,
          left_topic: item.topic1, left_content: [],
          right_topic: item.topic2, right_content: []
        })),
        { slide_type: "content", title: "Summary", content: ["Thank you"] }
      ];

      dispatch({ type: 'SET_SLIDES', payload: initialSlides });
      dispatch({ type: 'SET_PHASE', payload: 'content' });
      dispatch({ type: 'ADD_USER_MSG', payload: '大纲已确认，正在生成预览...' });
      
      // Auto-trigger content generation (Optional, but good UX)
      // sendMessage("Generate content for all slides"); 
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_ERROR', payload: "无法解析大纲 JSON，请重试。" });
    }
  }, []);

  const startExport = useCallback(async () => {
     try {
        const { currentSlides } = stateRef.current;
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const { generationAPI } = await import('../api/client');
        const contentJson = {
            title: currentSlides.find(s => s.slide_type === 'title')?.title || "Presentation",
            slides_data: currentSlides
        };
        
        const res = await generationAPI.exportPpt(contentJson);
        const taskId = res.data.task_id;
        
        // Handover to useTask for download handling
        startExportPolling(taskId);
        
        dispatch({ type: 'ADD_AI_PLACEHOLDER' });
        dispatch({ type: 'STREAM_UPDATE', payload: "正在后台导出 PPT..." });
        dispatch({ type: 'SET_LOADING', payload: false });
        
     } catch (e) {
        dispatch({ type: 'SET_ERROR', payload: "导出启动失败" });
     }
  }, [startExportPolling]);

  const reset = useCallback(() => { abortStream(); dispatch({ type: 'RESET' }); }, [abortStream]);

  return { state, actions: { sendMessage, confirmOutline, startExport, reset } };
};
