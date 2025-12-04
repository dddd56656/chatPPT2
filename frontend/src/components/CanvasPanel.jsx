import React from 'react';
import { Box, Slide, Paper, Typography, IconButton, Button } from '@mui/material';
import { Slideshow, Download, Close } from '@mui/icons-material';
import { PreviewPanel } from './SlidePreview'; 
import { useChatStore } from '../store/chatStore';

const TOOL_PANEL_WIDTH = 500;

const CanvasPanel = () => {
  const { isToolOpen, setToolOpen, currentSlides, updateSlide, handleExport, isLoading } = useChatStore();

  return (
    <Slide direction="left" in={isToolOpen} mountOnEnter unmountOnExit>
        <Paper elevation={4} sx={{ width: { xs: '100%', md: TOOL_PANEL_WIDTH }, borderLeft: '1px solid #444', bgcolor: '#f7f7f8', display: 'flex', flexDirection: 'column', position: { xs: 'absolute', md: 'relative' }, zIndex: 10, height: '100%' }}>
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
                <Typography variant="subtitle2" sx={{ display:'flex', alignItems:'center', fontWeight:'bold', color: '#333' }}><Slideshow sx={{ mr: 1, color:'#10a37f' }} /> Canvas Editor</Typography>
                <Box>
                    <Button size="small" startIcon={<Download/>} onClick={handleExport} disabled={currentSlides.length === 0} sx={{mr:1}}>Export</Button>
                    <IconButton size="small" onClick={() => setToolOpen(false)}><Close /></IconButton>
                </Box>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3, bgcolor: '#f0f2f5' }}>
                <PreviewPanel slides={currentSlides} onUpdateSlide={updateSlide} isLoading={isLoading} />
            </Box>
        </Paper>
    </Slide>
  );
};
export default CanvasPanel;
