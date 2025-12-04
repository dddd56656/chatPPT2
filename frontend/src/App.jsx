import React from 'react';
// [CTO Note] 现在从独立的 routes 模块导入，结构更清晰
import { AppRouter } from './routes';

function App() {
  return <AppRouter />;
}

export default App;
