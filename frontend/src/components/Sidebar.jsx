import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Drawer, Button, List, ListItem, ListItemButton, ListItemText,
  IconButton, useTheme, useMediaQuery, Typography, Divider, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip, LinearProgress,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Checkbox
} from '@mui/material';
import {
  Add, Delete, Edit, Check, ChatBubbleOutline,
  FolderOpen, CloudUpload, InsertDriveFile, Close,
  CheckCircle, Error as ErrorIcon, Autorenew
} from '@mui/icons-material';
import { useChatStore } from '../store/chatStore';

const SIDEBAR_WIDTH = 260;

const KnowledgeBaseDialog = ({ open, onClose, files = [], selectedIds = [], onUpload, onDelete, onToggle, status }) => {
  const fileInputRef = useRef(null);

  const getStatusChip = (fileStatus) => {
    if (status === 'uploading') return <Chip icon={<Autorenew sx={{ animation: 'spin 2s linear infinite' }} />} label="索引中" size="small" color="primary" variant="outlined" />;
    if (status === 'error') return <Chip icon={<ErrorIcon />} label="失败" size="small" color="error" variant="outlined" />;
    return <Chip icon={<CheckCircle />} label="已就绪" size="small" color="success" variant="outlined" sx={{ bgcolor: '#e6f4ea', color: '#137333', borderColor: 'transparent' }} />;
  };

  const safeFiles = Array.isArray(files) ? files : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, maxHeight: '80vh' } }}>
      <DialogTitle sx={{ borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderOpen sx={{ color: '#1a73e8' }} />
          <Typography variant="h6" fontWeight="bold">知识库管理</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: '#f8f9fa' }}>
        <Paper
          elevation={0}
          onClick={() => status !== 'uploading' && fileInputRef.current?.click()}
          sx={{ border: '2px dashed #1a73e8', bgcolor: '#f0f7ff', borderRadius: 2, p: 4, mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: status === 'uploading' ? 'not-allowed' : 'pointer', transition: 'all 0.2s', '&:hover': { bgcolor: '#e8f0fe', borderColor: '#174ea6' } }}
        >
          {/* [CTO Fix]: 修正文件类型限制，与后端对齐 */}
          <input type="file" ref={fileInputRef} hidden accept=".pdf,.docx,.txt,.md,.json,.csv" onChange={onUpload} />

          <CloudUpload sx={{ fontSize: 48, color: '#1a73e8', mb: 1, opacity: status === 'uploading' ? 0.5 : 1 }} />
          <Typography variant="subtitle1" fontWeight="bold" color="#1a73e8">{status === 'uploading' ? '正在上传并索引...' : '点击上传文档'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>支持 PDF, DOCX, TXT, MD, CSV (Max 10MB)</Typography>
          {status === 'uploading' && <LinearProgress sx={{ width: '60%', mt: 2, borderRadius: 1 }} />}
        </Paper>

        <Typography variant="subtitle2" sx={{ mb: 1.5, color: '#5f6368', fontWeight: 'bold' }}>已收录文档 ({safeFiles.length})</Typography>

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
              <TableRow>
                <TableCell padding="checkbox" width="50">启用</TableCell>
                <TableCell>文档名称</TableCell>
                <TableCell width="120">状态</TableCell>
                <TableCell width="100" align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {safeFiles.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: '#999' }}>暂无文档，请上传</TableCell></TableRow>
              ) : (
                safeFiles.map((file) => {
                  const isSelected = safeSelectedIds.includes(file.id);
                  return (
                    <TableRow key={file.id} hover selected={isSelected}>
                      <TableCell padding="checkbox">
                        <Checkbox color="primary" checked={isSelected} onChange={() => onToggle && onToggle(file.id)} />
                      </TableCell>
                      <TableCell sx={{ display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: 'none', py: 2 }}>
                        <Box sx={{ p: 1, bgcolor: '#e8f0fe', borderRadius: 1, color: '#1a73e8', display: 'flex' }}><InsertDriveFile fontSize="small" /></Box>
                        <Typography variant="body2" fontWeight={500}>{file.name}</Typography>
                      </TableCell>
                      <TableCell>{getStatusChip('success')}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => onDelete(file.id)} sx={{ color: '#5f6368', '&:hover': { color: '#d93025', bgcolor: '#fce8e6' } }}><Delete fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #eee' }}>
        <Button onClick={onClose} sx={{ color: '#5f6368' }}>关闭</Button>
        <Button variant="contained" onClick={() => fileInputRef.current?.click()} disabled={status === 'uploading'} sx={{ bgcolor: '#1a73e8' }}>继续导入</Button>
      </DialogActions>
    </Dialog>
  );
};

const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // [CTO Fix]: 防御性获取 Store，防止因 Store 未更新导致的崩溃
  const store = useChatStore();

  // 安全提取属性，如果 store 里的方法不存在（旧代码），则提供空函数兜底
  const {
    sessionId, historyList = [], createNewSession, loadSession, deleteSession, renameSession,
    ragFiles = [], ragStatus = 'idle'
  } = store;

  const fetchRagFiles = store.fetchRagFiles || (() => console.warn("fetchRagFiles not ready"));
  const deleteRagFile = store.deleteRagFile || (() => { });
  const uploadRAGFile = store.uploadRAGFile || (() => { });
  const selectedRagFileIds = store.selectedRagFileIds || [];
  const toggleRagFileSelection = store.toggleRagFileSelection || (() => { });

  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isKbOpen, setKbOpen] = useState(false);

  // [Fix]: 增加依赖检查，只有当 fetchRagFiles 真正存在时才调用
  useEffect(() => {
    if (sessionId && typeof fetchRagFiles === 'function') {
      fetchRagFiles();
    }
  }, [sessionId]); // 移除 fetchRagFiles 依赖以避免死循环，或者确保它是稳定的

  const handleEditStart = (e, item) => { e.stopPropagation(); setEditingId(item.id); setEditTitle(item.title); };
  const handleEditSave = (e) => { e.stopPropagation(); if (editingId) renameSession(editingId, editTitle); setEditingId(null); };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadRAGFile(file);
    e.target.value = null;
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#202123', color: '#ececf1' }}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button fullWidth variant="outlined" startIcon={<Add />} onClick={() => { createNewSession(); if (isMobile) setMobileOpen(false); }} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'flex-start', py: 1.5, textTransform: 'none' }}>New chat</Button>
        <Button fullWidth variant="text" startIcon={<FolderOpen />} onClick={() => setKbOpen(true)} sx={{ color: '#ececf1', justifyContent: 'flex-start', py: 1.5, textTransform: 'none', bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
          知识库管理 ({ragFiles.length})
        </Button>
      </Box>
      <Divider sx={{ bgcolor: 'rgba(255,255,255,0.1)', mb: 1 }} />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        <Typography variant="caption" sx={{ color: '#8e8ea0', fontWeight: 'bold', ml: 1, mb: 1, display: 'block', mt: 1 }}>HISTORY</Typography>
        <List>
          {historyList.map((item) => (
            <ListItem key={item.id} disablePadding sx={{ display: 'block', mb: 0.5 }}>
              <ListItemButton selected={item.id === sessionId} onClick={() => { loadSession(item.id); if (isMobile) setMobileOpen(false); }} sx={{ borderRadius: 1, '&.Mui-selected': { bgcolor: '#343541' } }}>
                <ChatBubbleOutline sx={{ fontSize: 16, mr: 1.5, color: '#acacbe' }} />
                {editingId === item.id ? (
                  <Box sx={{ display: 'flex', flex: 1, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave(e)} autoFocus style={{ background: '#40414f', color: 'white', border: '1px solid #1a73e8', borderRadius: 4, width: '100%' }} />
                    <IconButton size="small" onClick={handleEditSave} sx={{ color: '#10a37f' }}><Check fontSize="small" /></IconButton>
                  </Box>
                ) : (
                  <>
                    <ListItemText primary={item.title || 'New Chat'} primaryTypographyProps={{ noWrap: true, fontSize: '0.9rem' }} />
                    {item.id === sessionId && (
                      <Box sx={{ display: 'flex' }}>
                        <IconButton size="small" onClick={(e) => handleEditStart(e, item)} sx={{ color: '#acacbe' }}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteSession(item.id); }} sx={{ color: '#acacbe' }}><Delete fontSize="small" /></IconButton>
                      </Box>
                    )}
                  </>
                )}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
      <KnowledgeBaseDialog open={isKbOpen} onClose={() => setKbOpen(false)} files={ragFiles} selectedIds={selectedRagFileIds} onUpload={handleFileUpload} onDelete={deleteRagFile} onToggle={toggleRagFileSelection} status={ragStatus} />
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: SIDEBAR_WIDTH }, flexShrink: { md: 0 } }}>
      <Drawer variant={isMobile ? "temporary" : "permanent"} open={isMobile ? mobileOpen : true} onClose={() => setMobileOpen(false)} sx={{ '& .MuiDrawer-paper': { boxSizing: 'border-box', width: SIDEBAR_WIDTH, bgcolor: '#202123', border: 'none' } }}>
        {drawerContent}
      </Drawer>
    </Box>
  );
};
export default Sidebar;