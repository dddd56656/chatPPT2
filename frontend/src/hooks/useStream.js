import { useCallback, useRef } from 'react';

export const useStream = () => {
  const abortControllerRef = useRef(null);

  const streamRequest = useCallback(async (url, body, callbacks) => {
    // Placeholder for future Streaming implementation
    // Currently logic is handled via Polling in useChatMachine for V2 compatibility
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { streamRequest, abortStream };
};
