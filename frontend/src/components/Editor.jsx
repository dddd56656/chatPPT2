// 大纲编辑器组件
import { useState } from 'react';

export const Editor = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt('');
    }
  };

  return (
    <div className="editor">
      <h2>PPT生成器</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="请输入您想要的PPT主题和内容要求..."
          rows={4}
          disabled={isLoading}
        />
        <button type="submit" disabled={!prompt.trim() || isLoading}>
          {isLoading ? '生成中...' : '生成PPT'}
        </button>
      </form>
    </div>
  );
};