/**
 * [CTO Refactor] useChatMachine Hook
 * Includes: Robust JSON Parsing & State Management
 */
import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useStream } from './useStream';
import { streamEndpoints } from '../api/client';

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
    // Note: We don't strictly find the end because streaming might be incomplete,
    // but JSON.parse will fail gracefully.
  }
  return clean;
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
    const endpoint = phase === 'outline' ? streamEndpoints.outline : streamEndpoints.content;
    const body = { session_id: sessionId, user_message: text, current_slides: phase === 'content' ? currentSlides : undefined };

    await streamRequest(endpoint, body, {
      onChunk: (textChunk) => dispatch({ type: 'STREAM_UPDATE', payload: textChunk }),
      onDone: () => {
        dispatch({ type: 'SET_LOADING', payload: false });
        // Auto-parse content
        if (stateRef.current.phase === 'content') {
            const msgs = stateRef.current.messages;
            const content = msgs[msgs.length - 1].content;
            try {
                const cleanJson = extractJSON(content);
                const slides = JSON.parse(cleanJson);
                if (Array.isArray(slides)) dispatch({ type: 'SET_SLIDES', payload: slides });
            } catch (e) {
                console.warn("Parsing partial JSON failed (expected during stream):", e);
            }
        }
      },
      onError: (err) => {
        dispatch({ type: 'SET_ERROR', payload: err });
        dispatch({ type: 'STREAM_UPDATE', payload: `\n[System Error]: ${err}` });
      }
    });
  }, [streamRequest]);

  const confirmOutline = useCallback(() => {
    const { messages } = stateRef.current;
    const lastMsg = messages[messages.length - 1];
    try {
      const cleanJson = extractJSON(lastMsg.content);
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
      dispatch({ type: 'ADD_USER_MSG', payload: 'Outline confirmed. Generating content previews...' });
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_ERROR', payload: "Failed to parse outline JSON. Please try regenerating." });
    }
  }, []);

  const startExport = useCallback(() => { dispatch({ type: 'SET_PHASE', payload: 'exporting' }); }, []);
  const reset = useCallback(() => { abortStream(); dispatch({ type: 'RESET' }); }, [abortStream]);

  return { state, actions: { sendMessage, confirmOutline, startExport, reset } };
};
