// --- 核心依赖导入（略） ---
import React, { useRef, useEffect, useState } from 'react';
import { useChatStore } from './store/chatStore';
import { PreviewPanel } from './components/SlidePreview';
import { 
  Box, Drawer, CssBaseline, AppBar, Toolbar, Typography, Divider, 
  List, ListItem, ListItemButton, ListItemText, IconButton, 
  TextField, Paper, Button, InputAdornment, Menu, MenuItem, Tooltip,
  useTheme, useMediaQuery, Collapse, Slide
} from '@mui/material';
import { 
  Menu as MenuIcon, Add as AddIcon, Edit as EditIcon, 
  Delete as DeleteIcon, Check as CheckIcon, 
  Send as SendIcon, Stop as StopIcon, 
  Slideshow as SlideshowIcon,
  Build as ToolIcon,
  KeyboardArrowRight, Close as CloseIcon,
  Download as DownloadIcon,
  AutoAwesome as MagicIcon,
    // [NEW ICON] 引入 RAG 上传/附件图标
    AttachFile as AttachFileIcon 
} from '@mui/icons-material';

const SIDEBAR_WIDTH = 260;
const TOOL_PANEL_WIDTH = 500;

function App() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const { 
    messages, currentSlides, isLoading, error, isRefusal, sessionId, historyList, isToolOpen,
    sendMessage, stopGeneration, updateSlide, handleExport, applyCanvas, setToolOpen,
    createNewSession, loadSession, deleteSession, renameSession, init 
  } = useChatStore();
  
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  
  // UI State
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null); 
  const openTools = Boolean(anchorEl);

  useEffect(() => { init(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputRef.current?.value;
    if (!text?.trim() || isLoading) return; 
    sendMessage(text);
    if(inputRef.current) inputRef.current.value = '';
  };

  const handleToolsClick = (event) => setAnchorEl(event.currentTarget);
  const handleToolsClose = () => setAnchorEl(null);
  
  // [NEW HANDLER] RAG 上传逻辑占位符
  const handleRAGUpload = () => {
    console.log("RAG Upload triggered. Opening file selector...");
    // TODO: Implement file input click or upload modal opening logic
  };

  const startEditing = (e, item) => { e.stopPropagation(); setEditingId(item.id); setEditTitle(item.title || ''); }; 
  const saveTitle = (e) => { e.stopPropagation(); if (editingId) { renameSession(editingId, editTitle); setEditingId(null); } };
  const hasSlideData = (content) => content && (content.includes('```json') || content.includes('['));

  const isCurrentSessionEmpty = messages.length === 0 && (historyList.find(h => h.id === sessionId)?.title || '').trim() === '';


  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#202123', color: '#ececf1' }}>
      <Box sx={{ p: 2 }}>
        <Button 
            fullWidth variant="outlined" startIcon={<AddIcon />} 
            onClick={() => { createNewSession(); if(isMobile) setMobileOpen(false); }}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'flex-start', py: 1.5, px: 2, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
            New chat
        </Button>
      </Box>
      <List sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {historyList
          .filter(item => item.id !== sessionId || !isCurrentSessionEmpty) 
          .map((item) => (
          <ListItem key={item.id} disablePadding sx={{ display: 'block', mb: 0.5 }}>
            <ListItemButton 
                selected={item.id === sessionId}
                onClick={() => { loadSession(item.id); if(isMobile) setMobileOpen(false); }}
                sx={{ borderRadius: 1, '&.Mui-selected': { bgcolor: '#343541' }, '&:hover': { bgcolor: '#2A2B32' }, minHeight: 44 }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                    <Box component="span" sx={{ mr: 1.5 }}>💬</Box>
                    {editingId === item.id ? (
                        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTitle(e)} autoFocus style={{ background: '#40414f', color: 'white', border: '1px solid #1a73e8', borderRadius: 4, width: '100%', padding: '2px 4px' }} />
                            <IconButton size="small" onClick={saveTitle} sx={{ color: '#10a37f', ml: 0.5 }}><CheckIcon fontSize="small"/></IconButton>
                        </Box>
                    ) : (
                        <>
                            <ListItemText primary={item.title} primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem', color: '#ececf1' }} />
                            {item.id === sessionId && (
                                <Box sx={{ display: 'flex' }}>
                                    <IconButton size="small" onClick={(e) => startEditing(e, item)} sx={{ color: '#acacbe' }}><EditIcon fontSize="small" /></IconButton>
                                    {item.id !== sessionId && (
                                      <IconButton size="small" onClick={() => deleteSession(item.id)} sx={{ color: '#acacbe' }}><DeleteIcon fontSize="small" /></IconButton>
                                    )}
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#343541', overflow: 'hidden' }}>
      <CssBaseline />
      
      {/* Mobile Header (略) */}
      <AppBar position="fixed" sx={{ display: { md: 'none' }, bgcolor: '#343541', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Toolbar>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}><MenuIcon /></IconButton>
            <Typography variant="h6" noWrap sx={{ ml: 2 }}>ChatPPT</Typography>
        </Toolbar>
      </AppBar>

      {/* 左侧 Sidebar Drawer (略) */}
      <Box component="nav" sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
            variant={isMobile ? "temporary" : "permanent"}
            open={isMobile ? mobileOpen : true}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: SIDEBAR_WIDTH, border: 'none', bgcolor: '#202123' } }}
        >
            {drawerContent}
        </Drawer>
      </Box>

      {/* --- Main Content Area (聊天区 + 工具区) --- */}
      <Box sx={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        
        {/* 1. Chat Area (主聊天区域) - 略 */}
        <Box sx={{ 
            flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#343541', 
            transition: 'margin-right 0.3s ease',
            mr: (isToolOpen && !isMobile) ? 0 : 0
        }}>
            
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', color: '#ececf1', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography variant="subtitle1" fontWeight="bold">ChatPPT</Typography>
                {isToolOpen && !isMobile && (
                    <Button 
                        size="small" variant="text" sx={{ position: 'absolute', right: 16, color: '#acacbe' }}
                        onClick={() => setToolOpen(false)}
                    >
                        Hide Canvas
                    </Button>
                )}
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '900px', mx: 'auto', width: '100%' }}>
                {messages.map((msg, idx) => (
                    <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <Paper sx={{ p: 2, maxWidth: '90%', borderRadius: 2, bgcolor: msg.role === 'user' ? 'transparent' : '#444654', color: '#ececf1', boxShadow: 'none' }}>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {msg.role === 'assistant' && <Box sx={{ width: 30, height: 30, bgcolor: '#10a37f', borderRadius: 1, flexShrink: 0, display:'flex', alignItems:'center', justifyContent:'center' }}><MagicIcon sx={{fontSize:20, color:'white'}}/></Box>}
                                <Box>
                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                        {msg.content || (isLoading && idx === messages.length-1 ? "Thinking..." : "")}
                                    </Typography>
                                    
                                    {msg.role === 'assistant' && hasSlideData(msg.content) && (
                                        <Button 
                                            variant="outlined" size="small" 
                                            startIcon={<SlideshowIcon />}
                                            onClick={() => { applyCanvas(msg.content); setToolOpen(true); }}
                                            sx={{ mt: 2, borderColor: '#565869', color: '#ececf1', textTransform: 'none', '&:hover':{ bgcolor: '#40414f', borderColor: '#acacbe' } }}
                                        >
                                            Canvas: Render PPT
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        </Paper>
                    </Box>
                ))}
                <div ref={messagesEndRef} />
            </Box>

            {/* Input Area (输入框区域) */}
            <Box sx={{ p: 3, bgcolor: '#343541', maxWidth: '900px', mx: 'auto', width: '100%' }}>
                {/* [NEW LOCATION] Tools 按钮区域 - 移至输入框上方/外部 */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
                    <Tooltip title="Tools (MCP)">
                        <IconButton size="small" onClick={handleToolsClick} sx={{ color: '#acacbe', '&:hover':{color:'white', bgcolor:'rgba(255,255,255,0.1)'}, p: '6px 12px', borderRadius: 2 }}>
                            <ToolIcon fontSize="small" /> 
                            <Typography variant="caption" sx={{ml:0.5, fontWeight:'bold'}}>Tools</Typography>
                        </IconButton>
                    </Tooltip>
                    <Menu 
                        anchorEl={anchorEl} open={openTools} onClose={handleToolsClose}
                        PaperProps={{ sx: { bgcolor: '#202123', color: 'white', border: '1px solid #444' } }}
                    >
                        <MenuItem onClick={() => { setToolOpen(true); handleToolsClose(); }} sx={{fontSize:'0.9rem'}}><SlideshowIcon sx={{mr:1, fontSize:18}}/> Open PPT Canvas</MenuItem>
                        <MenuItem onClick={handleToolsClose} sx={{fontSize:'0.9rem'}}><DownloadIcon sx={{mr:1, fontSize:18}}/> Export Options</MenuItem>
                    </Menu>
                </Box>
                
                <Box component="form" onSubmit={handleSend} sx={{ 
                    position: 'relative', bgcolor: '#40414f', borderRadius: 3, 
                    boxShadow: '0 0 15px rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.1)' 
                }}>
                    <TextField 
                        fullWidth multiline maxRows={4}
                        placeholder={isLoading ? "Generating..." : "Message ChatPPT..."}
                        variant="standard" disabled={isLoading} inputRef={inputRef}
                        // [NEW RAG ICON] 在输入框内部添加附件图标 (InputAdornment)
                        InputProps={{ 
                            disableUnderline: true,
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Tooltip title="Upload RAG Documents">
                                        <IconButton onClick={handleRAGUpload} sx={{ color: '#acacbe' }} size="small">
                                            <AttachFileIcon />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            )
                        }}
                        sx={{ p: 2, pr: 6, '& .MuiInputBase-input': { color: 'white' } }}
                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                    />
                    
                    {/* 发送/停止按钮 (右下角) */}
                    <Box sx={{ position: 'absolute', right: 10, bottom: 8 }}>
                        {isLoading ? (
                            <IconButton onClick={stopGeneration} size="small" sx={{ color: '#ececf1', bgcolor: 'transparent' }}><StopIcon /></IconButton>
                        ) : (
                            <IconButton type="submit" size="small" sx={{ color: 'white', bgcolor: '#19c37d', '&:hover': { bgcolor: '#1a7f5a' } }}><SendIcon fontSize="small" /></IconButton>
                        )}
                    </Box>
                </Box>
                <Typography variant="caption" align="center" display="block" sx={{ mt: 1, color: '#9a9a9a' }}>
                    ChatPPT can make mistakes. Consider checking important information.
                </Typography>
            </Box>
        </Box>

        {/* 2. Right Tool Panel (Canvas Artifact) - 略 */}
        <Slide direction="left" in={isToolOpen} mountOnEnter unmountOnExit>
            <Paper 
                elevation={4}
                sx={{ 
                    width: isMobile ? '100%' : TOOL_PANEL_WIDTH, 
                    borderLeft: '1px solid #444', 
                    bgcolor: '#f7f7f8',
                    display: 'flex', flexDirection: 'column',
                    position: isMobile ? 'absolute' : 'relative',
                    zIndex: 10, height: '100%'
                }}
            >
                <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
                    <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', color:'#333', fontWeight:'bold' }}>
                        <SlideshowIcon sx={{ mr: 1, color:'#10a37f' }} /> PPT Canvas Editor
                    </Typography>
                    <Box>
                        <Button size="small" startIcon={<DownloadIcon/>} onClick={handleExport} disabled={currentSlides.length === 0} sx={{mr:1}}>Export</Button>
                        <IconButton size="small" onClick={() => setToolOpen(false)}><CloseIcon /></IconButton>
                    </Box>
                </Box>

                <Box sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: '#f0f2f5' }}>
                    <PreviewPanel slides={currentSlides} onUpdateSlide={updateSlide} isLoading={isLoading} />
                </Box>
            </Paper>
        </Slide>

      </Box>
    </Box>
  );
}
export default App;