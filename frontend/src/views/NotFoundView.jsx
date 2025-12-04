import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFoundView = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#343541', color: '#ececf1' }}>
      <Typography variant="h1">404</Typography>
      <Button onClick={() => navigate('/')} sx={{ mt: 2, color: '#10a37f' }}>Go Home</Button>
    </Box>
  );
};
export default NotFoundView;
