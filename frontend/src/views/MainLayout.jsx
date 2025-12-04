import React, { useEffect, useState } from 'react';
import { Box, CssBaseline, AppBar, Toolbar, IconButton, Typography } from '@mui/material';
import { Menu } from '@mui/icons-material';
import { useChatStore } from '../store/chatStore';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import CanvasPanel from '../components/CanvasPanel';

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { init } = useChatStore();

  useEffect(() => { init(); }, []);

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#343541', overflow: 'hidden' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ display: { md: 'none' }, bgcolor: '#343541', boxShadow: 'none', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}><Menu /></IconButton>
          <Typography variant="h6" noWrap sx={{ ml: 2 }}>ChatPPT</Typography>
        </Toolbar>
      </AppBar>
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <Box sx={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', pt: { xs: 7, md: 0 } }}>
         <ChatArea />
         <CanvasPanel />
      </Box>
    </Box>
  );
};
export default MainLayout;
