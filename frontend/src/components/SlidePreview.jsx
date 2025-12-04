import React, { useState, useEffect } from 'react';
import { getSmartImageUrl } from '../utils/smartImage';
import { Box, CircularProgress, Typography } from '@mui/material';

const EditableText = ({ value, onChange, className, style, tagName = 'div' }) => {
  const Tag = tagName;
  return (
    <Tag
      className={`editable-field ${className || ''}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.target.innerText)}
    >
      {value}
    </Tag>
  );
};

const SlideRenderer = ({ slide, index, onUpdate }) => {
  if (!slide) return null;
  const [bgImage, setBgImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // 异步加载图片 + 800ms 防抖
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
        const load = async () => {
            setLoading(true);
            const url = await getSmartImageUrl(slide.title, 800, 600); // 预览用 800x600
            if (active) { setBgImage(url); setLoading(false); }
        };
        load();
    }, 800);
    return () => { clearTimeout(timer); active = false; };
  }, [slide.title]);

  const handleChange = (field, value, subIndex) => onUpdate(index, field, value, subIndex);
  const isTitle = slide.slide_type === 'title';

  const strongTextShadow = '0 0 5px black, 0 0 5px black, 0 0 5px black'; 
  
  const containerStyle = {
      position: 'relative', aspectRatio: '16 / 9',
      borderRadius: '8px', overflow: 'hidden', 
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      marginBottom: '30px', border: '1px solid #eee',
      backgroundImage: bgImage ? `url(${bgImage})` : 'linear-gradient(135deg, #202124 0%, #333 100%)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      transition: 'background-image 0.5s ease',
      display: 'flex', flexDirection: 'column', 
      color: 'white' 
  };

  const contentAreaStyle = {
      position: 'relative', zIndex: 2, flex: 1,
      padding: isTitle ? '60px 40px' : '40px 60px',
      background: 'transparent',
      textAlign: isTitle ? 'center' : 'left'
  };

  const textContent = [...(slide.content||[]), ...(slide.left_content||[]), ...(slide.right_content||[])];

  return (
    <div style={containerStyle}>
        {/* 图片遮罩层 (用于增加文字对比度) */}
        <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.3)', zIndex: 1}} />

        {/* 悬浮文字内容 */}
        <div style={contentAreaStyle}>
            {loading && <Box sx={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:3}}><CircularProgress color="inherit" /></Box>}

            {/* 标题 */}
            <EditableText 
                tagName={isTitle ? "h1" : "h2"} 
                value={slide.title || "Title"} 
                onChange={(v) => handleChange('title', v)}
                style={{
                    fontSize: isTitle ? '2rem' : '1.5rem', 
                    fontWeight:'bold', 
                    marginBottom: '1rem', 
                    textShadow: strongTextShadow, 
                    width: '100%', color: 'white'
                }} 
            />
            
            {/* 副标题 / 列表内容 */}
            {isTitle && slide.subtitle && (
                <EditableText tagName="p" value={slide.subtitle} onChange={(v) => handleChange('subtitle', v)} style={{fontSize:'1.2rem', textShadow: strongTextShadow}} />
            )}

            {!isTitle && (
                <div style={{fontSize:'0.9rem', lineHeight: 1.8, width:'100%', marginTop:'20px'}}>
                    {textContent.map((item, i) => (
                        <div key={i} style={{display:'flex', marginBottom:'8px'}}>
                            <span style={{color:'#1A73E8', marginRight:'12px', fontWeight:'bold', textShadow:'none'}}>•</span>
                            <EditableText value={item} onChange={(v) => handleChange('content', v, i)} style={{textShadow: strongTextShadow, lineHeight: 1.6, fontSize:'0.9rem'}} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export const PreviewPanel = ({ slides, onUpdateSlide, isLoading }) => {
// ... 保持 PreviewPanel 的其余逻辑不变 ...
  const safeSlides = Array.isArray(slides) ? slides : [];
  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', paddingBottom: '50px' }}>
      <Box sx={{ mb: 3, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <Typography variant="h5" sx={{fontWeight:'bold', color:'#202124'}}>Canvas Preview</Typography>
        <Typography variant="caption" color="text.secondary">Immersive Floating Design</Typography>
      </Box>
      <div style={{ opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
        {safeSlides.map((slide, i) => <SlideRenderer key={i} slide={slide} index={i} onUpdate={onUpdateSlide} />)}
      </div>
    </div>
  );
};
