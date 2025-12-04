import React, { useRef, useEffect } from 'react';
import { 
  Box, Paper, Typography, TextField, IconButton, 
  InputAdornment, Tooltip, CircularProgress, Button 
} from '@mui/material';
import { 
  Send, Stop, AttachFile, AutoAwesome, Slideshow 
} from '@mui/icons-material';
import { useChatStore } from '../store/chatStore';

const ChatArea = () => {
  const { 
    messages, isLoading, ragStatus, 
    sendMessage, uploadRAGFile, applyCanvas, 
    setToolOpen, stopGeneration 
  } = useChatStore();

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = textInputRef.current?.value;
    if (!text?.trim() || isLoading) return;
    sendMessage(text);
    textInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadRAGFile(file);
    e.target.value = null;
  };

  const hasSlideData = (content) => content && (content.includes('```json') || content.includes('['));

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', mx: 'auto', width: '100%' }}>
      
      {/* 消息列表 */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {messages.map((msg, idx) => (
          <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <Paper sx={{ p: 2, maxWidth: '85%', borderRadius: 2, bgcolor: msg.role === 'user' ? 'transparent' : '#444654', color: '#ececf1', boxShadow: 'none' }}>
               <Box sx={{ display: 'flex', gap: 2 }}>
                  {msg.role === 'assistant' && (
                    <Box sx={{ width: 30, height: 30, bgcolor: '#10a37f', borderRadius: 1, display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
                        <AutoAwesome sx={{ color: 'white', fontSize: 20 }} />
                    </Box>
                  )}
                  <Box>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {msg.content || (isLoading && idx === messages.length-1 ? "Thinking..." : "")}
                    </Typography>
                    {/* [Entry Point] 唯一的 Render PPT 入口 */}
                    {msg.role === 'assistant' && hasSlideData(msg.content) && (
                        <Button 
                            variant="outlined" size="small" startIcon={<Slideshow />} 
                            onClick={() => { applyCanvas(msg.content); setToolOpen(true); }} 
                            sx={{ mt: 2, color: '#ececf1', borderColor: '#565869', textTransform: 'none', '&:hover': { bgcolor: '#40414f' } }}
                        >
                            Render PPT
                        </Button>
                    )}
                  </Box>
               </Box>
            </Paper>
          </Box>
        ))}
        <div ref={messagesEndRef} />
      </Box>

      {/* 底部输入区 (无 Tools) */}
      <Box sx={{ p: 3, bgcolor: '#343541' }}>
        <Box component="form" onSubmit={handleSend} sx={{ 
            display: 'flex', alignItems: 'center', 
            bgcolor: '#40414f', borderRadius: 3, 
            boxShadow: '0 0 15px rgba(0,0,0,0.1)', 
            border: '1px solid rgba(255,255,255,0.1)', p: 1.5 
        }}>
            <TextField
                fullWidth multiline maxRows={4}
                placeholder={isLoading ? "AI 正在思考..." : "输入主题，生成 PPT..."}
                disabled={isLoading}
                inputRef={textInputRef}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                InputProps={{
                    disableUnderline: true,
                    startAdornment: (
                        <InputAdornment position="start" sx={{mr: 1}}>
                            <input type="file" ref={fileInputRef} hidden accept=".txt,.md,.csv,.json" onChange={handleFileChange} />
                            <Tooltip title="上传参考文档 (RAG)">
                                <IconButton 
                                    onClick={() => fileInputRef.current?.click()} 
                                    sx={{ color: '#acacbe', '&:hover': { color: 'white' }, p: 0.5 }}
                                    disabled={ragStatus === 'uploading'}
                                >
                                    {ragStatus === 'uploading' ? <CircularProgress size={20} color="inherit" /> : <AttachFile fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                        </InputAdornment>
                    )
                }}
                sx={{ flex: 1, '& .MuiInputBase-input': { color: 'white', p: 0.5 } }}
            />
            <Box sx={{ ml: 1 }}> 
                {isLoading ? (
                    <IconButton onClick={stopGeneration} sx={{ color: '#ececf1', p: 0.5 }}><Stop /></IconButton>
                ) : (
                    <IconButton type="submit" size="small" sx={{ color: 'white', bgcolor: '#19c37d', '&:hover': { bgcolor: '#1a7f5a' }, p: 0.5 }}>
                        <Send fontSize="small" />
                    </IconButton>
                )}
            </Box>
        </Box>
        <Typography variant="caption" align="center" display="block" sx={{ mt: 1, color: '#9a9a9a' }}>
            ChatPPT can make mistakes.
        </Typography>
      </Box>
    </Box>
  );
};
export default ChatArea;
