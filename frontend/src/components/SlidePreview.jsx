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

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
        const load = async () => {
            setLoading(true);
            const url = await getSmartImageUrl(slide.title, 800, 600);
            if (active) { setBgImage(url); setLoading(false); }
        };
        load();
    }, 800);
    return () => { clearTimeout(timer); active = false; };
  }, [slide.title]);

  const handleChange = (field, value, subIndex) => onUpdate(index, field, value, subIndex);
  const isTitle = slide.slide_type === 'title';
  const strongTextShadow = '0 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)'; 
  
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
      // [VISUAL] 宽屏模式下，边距看起来会稍微宽一点
      padding: isTitle ? '40px 30px' : '30px 6%', 
      background: 'transparent',
      textAlign: isTitle ? 'center' : 'left'
  };

  const textContent = [...(slide.content||[]), ...(slide.left_content||[]), ...(slide.right_content||[])];

  return (
    <div style={containerStyle}>
        <div style={{position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', zIndex: 1}} />

        <div style={contentAreaStyle}>
            {loading && <Box sx={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:3}}><CircularProgress color="inherit" /></Box>}

            {/* 标题 */}
            <EditableText 
                tagName={isTitle ? "h1" : "h2"} 
                value={slide.title || "Title"} 
                onChange={(v) => handleChange('title', v)}
                style={{
                    fontSize: isTitle ? '2.5rem' : '1.8rem', // 宽屏大字
                    fontWeight:'bold', 
                    marginBottom: isTitle ? '1rem' : '1rem', 
                    textShadow: strongTextShadow, 
                    width: '100%', color: 'white'
                }} 
            />
            
            {isTitle && slide.subtitle && (
                <EditableText tagName="p" value={slide.subtitle} onChange={(v) => handleChange('subtitle', v)} style={{fontSize:'1.3rem', textShadow: strongTextShadow}} />
            )}

            {!isTitle && (
                <div style={{
                    fontSize:'1rem', // 16pt 对应 Web 约为 1rem
                    lineHeight: 1.6, 
                    width:'100%', 
                    marginTop:'10px'
                }}>
                    {textContent.map((item, i) => (
                        <div key={i} style={{display:'flex', marginBottom:'8px', alignItems:'flex-start'}}>
                            <span style={{color:'#1A73E8', marginRight:'10px', fontWeight:'bold', textShadow:'none', lineHeight: 1.6}}>•</span>
                            <EditableText value={item} onChange={(v) => handleChange('content', v, i)} style={{textShadow: strongTextShadow, lineHeight: 1.6}} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

export const PreviewPanel = ({ slides, onUpdateSlide, isLoading }) => {
  const safeSlides = Array.isArray(slides) ? slides : [];
  return (
    <div style={{ maxWidth:'900px', margin:'0 auto', paddingBottom: '50px' }}>
      <Box sx={{ mb: 3, display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
        <Typography variant="h5" sx={{fontWeight:'bold', color:'#202124'}}>Canvas Preview</Typography>
        <Typography variant="caption" color="text.secondary">Widescreen Layout (16:9)</Typography>
      </Box>
      <div style={{ opacity: isLoading ? 0.7 : 1, transition: 'opacity 0.3s' }}>
        {safeSlides.map((slide, i) => <SlideRenderer key={i} slide={slide} index={i} onUpdate={onUpdateSlide} />)}
      </div>
    </div>
  );
};
