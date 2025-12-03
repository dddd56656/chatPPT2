import { useCallback, useRef } from 'react';

/**
 * [V3 Standard] SSE Stream Hook
 * 职责: 处理 Server-Sent Events 流式响应
 */
export const useStream = () => {
  const abortControllerRef = useRef(null);

  const streamRequest = useCallback(async (url, body, callbacks) => {
    const { onChunk, onDone, onError } = callbacks;

    // 1. 竞态处理：取消前一个未完成的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // 2. 发起 Fetch 请求 (原生支持流)
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, details: ${errText}`);
      }

      // 3. 读取流数据
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // 4. 解析 SSE 数据块 (格式: data: {...}\n\n)
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // 保留末尾可能不完整的块

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            
            // 检查结束标记
            if (dataStr.trim() === '[DONE]') {
              if (onDone) onDone();
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                if (onChunk) onChunk(parsed.text);
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              console.warn("JSON Parse Warning:", e);
            }
          }
        }
      }

      if (onDone) onDone();

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream failed:', err);
        if (onError) onError(err.message);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { streamRequest, abortStream };
};
