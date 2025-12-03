import React from 'react';

// [CTO Fix]: 严格遵循 Pollinations Cheatsheet
// 移除 nologo 参数以防 API 变动导致 404 (虽然通常支持，但保稳)
const getImageUrl = (prompt) => {
  if (!prompt) return null;
  // 优化 Prompt 关键词：写实、宽幅、高质量
  const enhancedPrompt = encodeURIComponent(prompt + " ,wide angle, cinematic lighting, 4k, photorealistic, no text");
  // 保持宽高比 16:9
  return `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=1280&height=720&nologo=true`;
};

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
  
  const bgImage = slide.image_prompt ? getImageUrl(slide.image_prompt) : null;
  
  const handleChange = (field, value, subIndex) => {
    onUpdate(index, field, value, subIndex);
  };

  // [CTO Fix]: 背景图不再覆盖厚重的白色遮罩，而是直接展示
  const slideContainerStyle = {
    backgroundImage: bgImage ? `url(${bgImage})` : 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
  };

  // [CTO Fix]: 文字容器使用“毛玻璃”效果，确保文字在复杂背景上依然清晰
  const glassCardStyle = {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(8px)',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  };

  return (
    <div className="ppt-slide group" style={slideContainerStyle}>
      {/* 页码标记 */}
      <div style={{
          position: 'absolute', top: '10px', right: '20px', 
          background: 'rgba(0,0,0,0.5)', color: 'white', 
          padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', zIndex: 10
      }}>
        P{index + 1}
      </div>

      <div className="slide-body" style={{padding: '3rem'}}>
        
        {/* Title Slide: 中心大卡片 */}
        {slide.slide_type === 'title' && (
          <div style={{...glassCardStyle, alignItems: 'center', textAlign: 'center', height: 'auto', minHeight: '60%'}}>
            <EditableText 
                tagName="h1" 
                value={slide.title} 
                onChange={(val) => handleChange('title', val)}
                style={{fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748'}} 
            />
            <div className="separator" style={{background: '#4299e1', width: '80px', height: '4px', margin: '1rem auto'}}></div>
            <EditableText 
                tagName="p" 
                value={slide.subtitle || "点击输入副标题"} 
                onChange={(val) => handleChange('subtitle', val)} 
                style={{fontSize: '1.2rem', color: '#718096'}}
            />
          </div>
        )}

        {/* Content Slide: 左侧卡片，右侧留白展示背景 */}
        {slide.slide_type === 'content' && (
          <div className="two-col-grid">
             <div style={{...glassCardStyle, width: '100%'}}>
                <EditableText 
                    tagName="h2" 
                    value={slide.title || "标题"} 
                    onChange={(val) => handleChange('title', val)}
                    style={{fontSize: '1.5rem', marginBottom: '1.5rem', color: '#2b6cb0', borderBottom: '2px solid #bee3f8', paddingBottom: '0.5rem'}}
                />
                <ul className="col-list">
                  {(Array.isArray(slide.content) ? slide.content : []).map((item, i) => (
                    <li key={i} style={{marginBottom: '0.8rem'}}>
                        <EditableText 
                            value={item} 
                            onChange={(val) => handleChange('content', val, i)} 
                        />
                    </li>
                  ))}
                </ul>
             </div>
             {/* 右侧空置，专门用来展示背景图 */}
             <div style={{display: 'flex', alignItems: 'end', justifyContent: 'end', padding: '1rem'}}>
                <span style={{background: 'rgba(0,0,0,0.4)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem'}}>
                    ✨ AI 配图
                </span>
             </div>
          </div>
        )}

        {/* Two Column: 双卡片 */}
        {slide.slide_type === 'two_column' && (
          <>
            <div style={{
                background: 'rgba(255,255,255,0.9)', padding: '1rem', borderRadius: '8px', 
                marginBottom: '1rem', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
                <EditableText 
                    tagName="h2" 
                    value={slide.title || "标题"} 
                    onChange={(val) => handleChange('title', val)}
                    style={{fontSize: '1.4rem', color: '#2d3748', margin: 0}}
                />
            </div>
            <div className="two-col-grid" style={{height: 'auto', gap: '1.5rem'}}>
                <div style={{...glassCardStyle, padding: '1.5rem'}}>
                <h4 className="col-title" style={{color: '#3182ce'}}>
                    <EditableText 
                        value={slide.left_topic || '观点 A'} 
                        onChange={(val) => handleChange('left_topic', val)} 
                    />
                </h4>
                <ul className="col-list">
                    {(Array.isArray(slide.left_content) ? slide.left_content : []).map((item, i) => (
                    <li key={i}>
                        <EditableText value={item} onChange={(val) => handleChange('left_content', val, i)} />
                    </li>
                    ))}
                </ul>
                </div>
                <div style={{...glassCardStyle, padding: '1.5rem'}}>
                <h4 className="col-title" style={{color: '#3182ce'}}>
                    <EditableText 
                        value={slide.right_topic || '观点 B'} 
                        onChange={(val) => handleChange('right_topic', val)} 
                    />
                </h4>
                <ul className="col-list">
                    {(Array.isArray(slide.right_content) ? slide.right_content : []).map((item, i) => (
                    <li key={i}>
                        <EditableText value={item} onChange={(val) => handleChange('right_content', val, i)} />
                    </li>
                    ))}
                </ul>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const PreviewPanel = ({ slides, onUpdateSlide, isLoading }) => {
  const safeSlides = Array.isArray(slides) ? slides : [];

  if (safeSlides.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>���️</div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>准备画布...</h3>
        <p>输入数据后，AI 将自动匹配精美背景图。</p>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#202124', margin: 0 }}>
            PPT 预览
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#1a73e8' }}>
            {isLoading ? "�� 正在绘制插图..." : "✅ 渲染完成"}
          </span>
        </div>
      </div>
      
      {/* 预览列表 */}
      {safeSlides.map((slide, i) => (
        <SlideRenderer key={i} slide={slide} index={i} onUpdate={onUpdateSlide} />
      ))}
    </div>
  );
};
