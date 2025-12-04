import React from 'react';
import { Box, Paper, Typography, Button, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LoginView = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#202123', color: 'white' }}>
      <Paper sx={{ p: 4, width: 400, bgcolor: '#343541', textAlign: 'center' }}>
        <Typography variant="h5" fontWeight="bold" mb={3}>ChatPPT Pro</Typography>
        <Button fullWidth variant="contained" onClick={() => navigate('/')} sx={{ bgcolor: '#10a37f', py: 1.5 }}>
          Enter Workspace
        </Button>
      </Paper>
    </Box>
  );
};
export default LoginView;
