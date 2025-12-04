import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

// 懒加载视图 (Code Splitting)
const MainLayout = lazy(() => import('./views/MainLayout'));
const LoginView = lazy(() => import('./views/LoginView'));
const NotFoundView = lazy(() => import('./views/NotFoundView'));

// Loading 组件
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#343541' }}>
    <CircularProgress sx={{ color: '#10a37f' }} />
  </Box>
);

// 路由表定义
const router = createBrowserRouter([
  {
    path: "/",
    element: <MainLayout />,
  },
  {
    path: "/login",
    element: <LoginView />,
  },
  {
    path: "/404",
    element: <NotFoundView />,
  },
  {
    path: "*",
    element: <Navigate to="/404" replace />,
  }
]);

// 导出路由提供者组件
export const AppRouter = () => (
  <Suspense fallback={<PageLoader />}>
    <RouterProvider router={router} />
  </Suspense>
);
