import React, { useState } from 'react';
import { Box, Drawer, Button, List, ListItem, ListItemButton, ListItemText, IconButton, useTheme, useMediaQuery } from '@mui/material';
import { Add, Delete, Edit, Check, ChatBubbleOutline } from '@mui/icons-material';
import { useChatStore } from '../store/chatStore';

const SIDEBAR_WIDTH = 260;

const Sidebar = ({ mobileOpen, setMobileOpen }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { sessionId, historyList, createNewSession, loadSession, deleteSession, renameSession } = useChatStore();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const handleEditStart = (e, item) => { e.stopPropagation(); setEditingId(item.id); setEditTitle(item.title); };
  const handleEditSave = (e) => { e.stopPropagation(); if (editingId) renameSession(editingId, editTitle); setEditingId(null); };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#202123', color: '#ececf1' }}>
      <Box sx={{ p: 2 }}>
        <Button fullWidth variant="outlined" startIcon={<Add />} onClick={() => { createNewSession(); if(isMobile) setMobileOpen(false); }} sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'flex-start', py: 1.5 }}>New chat</Button>
      </Box>
      <List sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {historyList.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ display: 'block', mb: 0.5 }}>
            <ListItemButton selected={item.id === sessionId} onClick={() => { loadSession(item.id); if(isMobile) setMobileOpen(false); }} sx={{ borderRadius: 1, '&.Mui-selected': { bgcolor: '#343541' } }}>
                <ChatBubbleOutline sx={{ fontSize: 16, mr: 1.5, color: '#acacbe' }} />
                {editingId === item.id ? (
                    <Box sx={{ display: 'flex', flex: 1, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEditSave(e)} autoFocus style={{ background: '#40414f', color: 'white', border: '1px solid #1a73e8', borderRadius: 4, width: '100%' }} />
                        <IconButton size="small" onClick={handleEditSave} sx={{ color: '#10a37f' }}><Check fontSize="small"/></IconButton>
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
