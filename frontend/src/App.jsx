// React 核心钩子：useRef(DOM引用), useEffect(副作用), useState(本地状态)
import React, { useRef, useEffect, useState } from 'react'; 
// 全局状态管理：引入 Zustand Store 钩子。
import { useChatStore } from './store/chatStore'; 
// 核心子组件：幻灯片预览/编辑界面。
import { PreviewPanel } from './components/SlidePreview'; 
// Material UI 组件：引入所有UI元素，遵循 Google Material Design。
import { 
  Box, Drawer, CssBaseline, AppBar, Toolbar, Typography, Divider, 
  List, ListItem, ListItemButton, ListItemText, IconButton, 
  TextField, Paper, Button, InputAdornment, Menu, MenuItem, Tooltip,
  useTheme, useMediaQuery, Collapse, Slide // MUI 核心辅助和布局组件，用于响应式和动画效果。
} from '@mui/material';
// Material UI Icons：引入所有所需的图标。
import { 
  Menu as MenuIcon, Add as AddIcon, Edit as EditIcon, 
  Delete as DeleteIcon, Check as CheckIcon, 
  Send as SendIcon, Stop as StopIcon, 
  Slideshow as SlideshowIcon,
  Build as ToolIcon,
  KeyboardArrowRight, Close as CloseIcon,
  Download as DownloadIcon,
  AutoAwesome as MagicIcon,
    // [NEW ICON] AttachFile：用于 RAG 文档上传/附件图标。
    AttachFile as AttachFileIcon 
} from '@mui/icons-material';

const SIDEBAR_WIDTH = 260; // 常量：左侧导航栏宽度 (Desktop)
const TOOL_PANEL_WIDTH = 500; // 常量：右侧工具面板/Canvas宽度

function App() {
  // MUI 钩子：获取主题对象和响应式断点判断。
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // 策略：判断是否为移动设备 (用于切换侧边栏 Drawer 模式)
  
  // 1. Store状态与行为解构 (Zustand)
  const { 
    messages, currentSlides, isLoading, error, isRefusal, sessionId, historyList, isToolOpen, // 状态数据
    sendMessage, stopGeneration, updateSlide, handleExport, applyCanvas, setToolOpen, // 核心操作 (含 Canvas 控制)
    createNewSession, loadSession, deleteSession, renameSession, init // 会话管理
  } = useChatStore();
  
  // 2. 本地状态 (Local State) 与引用 (Refs)
  const inputRef = useRef(null); // Ref: 聊天输入框DOM引用
  const messagesEndRef = useRef(null); // Ref: 消息列表底部锚点
  const [editingId, setEditingId] = useState(null); // State: 正在重命名的会话ID
  const [editTitle, setEditTitle] = useState(''); // State: 重命名输入框值
  
  // UI State
  const [mobileOpen, setMobileOpen] = useState(false); // State: 移动端侧边栏的开关状态 (Drawer专用)
  const [anchorEl, setAnchorEl] = useState(null); // State: 工具菜单的锚点元素 (用于定位 Menu 组件)
  const openTools = Boolean(anchorEl); // 派生状态：判断工具菜单是否打开 (MUI标准)

  // 3. 生命周期副作用 (Effects)
  useEffect(() => { init(); }, []); // Effect 1: 应用初始化 (仅在挂载时执行一次)
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]); // Effect 2: 自动滚动 (依赖 messages 或 isLoading 变化触发)

  // 4. 事件处理函数 (Handlers)
  
  // 消息发送处理
  const handleSend = (e) => {
    e.preventDefault();
    const text = inputRef.current?.value;
    // 执行守卫：防止空消息或并发请求
    if (!text?.trim() || isLoading) return; 
    sendMessage(text);
    if(inputRef.current) inputRef.current.value = '';
  };

  const handleToolsClick = (event) => setAnchorEl(event.currentTarget); // 打开工具菜单
  const handleToolsClose = () => setAnchorEl(null); // 关闭工具菜单
  
  // [RAG HANDLER] RAG 上传逻辑占位符
  const handleRAGUpload = () => {
    console.log("RAG Upload triggered. Opening file selector...");
    // TODO: Implement file input click or upload modal opening logic (RAG 附件的核心业务逻辑)
  };

  // 会话重命名逻辑
  const startEditing = (e, item) => { e.stopPropagation(); setEditingId(item.id); setEditTitle(item.title || ''); }; // [修正] 移除默认文本 "New Chat"
  const saveTitle = (e) => { e.stopPropagation(); if (editingId) { renameSession(editingId, editTitle); setEditingId(null); } };
  // Helper：检测 AI 消息是否包含结构化数据 (JSON/Array)
  const hasSlideData = (content) => content && (content.includes('```json') || content.includes('['));

  // Helper: 检查当前会话是否为空 (策略：无消息，且标题为空，用于隐藏历史列表中的空项)
  const isCurrentSessionEmpty = messages.length === 0 && (historyList.find(h => h.id === sessionId)?.title || '').trim() === '';


  // --- 5. 左侧 Drawer 内容渲染 (Sidebar) ---
  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#202123', color: '#ececf1' }}>
      <Box sx={{ p: 2 }}>
        {/* 新建对话按钮 */}
        <Button 
            fullWidth variant="outlined" startIcon={<AddIcon />} 
            // 策略：新建会话后，如果是移动端，自动关闭侧边栏
            onClick={() => { createNewSession(); if(isMobile) setMobileOpen(false); }}
            sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'flex-start', py: 1.5, px: 2, textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
            New chat
        </Button>
      </Box>
      {/* 历史记录列表 (List/ListItem 组件) */}
      <List sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {historyList
            // 策略：过滤掉当前的空会话，实现视觉隐藏
            .filter(item => item.id !== sessionId || !isCurrentSessionEmpty) 
            .map((item) => (
          <ListItem key={item.id} disablePadding sx={{ display: 'block', mb: 0.5 }}>
            <ListItemButton 
                selected={item.id === sessionId} // 策略：高亮当前选中项
                onClick={() => { loadSession(item.id); if(isMobile) setMobileOpen(false); }} // 加载会话并关闭移动端抽屉
                sx={{ borderRadius: 1, '&.Mui-selected': { bgcolor: '#343541' }, '&:hover': { bgcolor: '#2A2B32' }, minHeight: 44 }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden' }}>
                    <Box component="span" sx={{ mr: 1.5 }}>💬</Box> {/* 聊天图标 */}
                    {/* 条件渲染：编辑模式 vs. 标题模式 */}
                    {editingId === item.id ? (
                        <Box sx={{ display: 'flex', flex: 1, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                            {/* 重命名输入框 */}
                            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveTitle(e)} autoFocus style={{ background: '#40414f', color: 'white', border: '1px solid #1a73e8', borderRadius: 4, width: '100%', padding: '2px 4px' }} />
                            <IconButton size="small" onClick={saveTitle} sx={{ color: '#10a37f', ml: 0.5 }}><CheckIcon fontSize="small"/></IconButton>
                        </Box>
                    ) : (
                        <>
                            {/* 标题显示 (item.title 为空时，MUI 默认会忽略显示) */}
                            <ListItemText primary={item.title} primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem', color: '#ececf1' }} />
                            {/* 动作按钮：仅在当前活跃会话显示 */}
                            {item.id === sessionId && (
                                <Box sx={{ display: 'flex' }}>
                                    <IconButton size="small" onClick={(e) => startEditing(e, item)} sx={{ color: '#acacbe' }}><EditIcon fontSize="small" /></IconButton>
                                    {/* 策略：只能删除非当前会话。 */}
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
      <CssBaseline /> {/* 策略：重置CSS基础样式，确保跨浏览器一致性 */}
      
      {/* Mobile Header (略) */}
      <AppBar position="fixed" sx={{ display: { md: 'none' }, bgcolor: '#343541', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Toolbar>
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}><MenuIcon /></IconButton>
            <Typography variant="h6" noWrap sx={{ ml: 2 }}>ChatPPT</Typography>
        </Toolbar>
      </AppBar>

      {/* 左侧 Sidebar Drawer (响应式导航) */}
      <Box component="nav" sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
            variant={isMobile ? "temporary" : "permanent"}
            open={isMobile ? mobileOpen : true} 
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }} // 策略：保持挂载，提升打开性能
            sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: SIDEBAR_WIDTH, border: 'none', bgcolor: '#202123' } }}
        >
            {drawerContent}
        </Drawer>
      </Box>

      {/* --- Main Content Area (聊天区 + 工具区) --- */}
      <Box sx={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        
        {/* 1. Chat Area (主聊天区域) */}
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
                {/* [NEW LOCATION] Tools 按钮区域 - 移至输入框上方/外部 (Gemini 风格) */}
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
                        InputProps={{ 
                            disableUnderline: true,
                            // RAG Upload Icon Adornment (InputAdornment: 输入框内部的装饰元素)
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
                        onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }} // 支持多行输入
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
                {/* 法律/隐私声明 */}
                <Typography variant="caption" align="center" display="block" sx={{ mt: 1, color: '#9a9a9a' }}>
                    ChatPPT can make mistakes. Consider checking important information.
                </Typography>
            </Box>
        </Box>

        {/* 2. Right Tool Panel (Canvas Artifact) */}
        {/* 策略：使用 Slide 组件实现从右侧滑入/滑出的动画 */}
        <Slide direction="left" in={isToolOpen} mountOnEnter unmountOnExit>
            <Paper 
                elevation={4}
                sx={{ 
                    width: isMobile ? '100%' : TOOL_PANEL_WIDTH, 
                    borderLeft: '1px solid #444', 
                    bgcolor: '#f7f7f8', // 预览区使用浅色背景
                    display: 'flex', flexDirection: 'column',
                    position: isMobile ? 'absolute' : 'relative', // 移动端绝对定位覆盖全屏
                    zIndex: 10, height: '100%'
                }}
            >
                {/* Tool Header */}
                <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
                    <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', color:'#333', fontWeight:'bold' }}>
                        <SlideshowIcon sx={{ mr: 1, color:'#10a37f' }} /> PPT Canvas Editor
                    </Typography>
                    <Box>
                        <Button size="small" startIcon={<DownloadIcon/>} onClick={handleExport} disabled={currentSlides.length === 0} sx={{mr:1}}>Export</Button>
                        <IconButton size="small" onClick={() => setToolOpen(false)}><CloseIcon /></IconButton>
                    </Box>
                </Box>

                {/* Tool Content (Preview) */}
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