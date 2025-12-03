import React from 'react';

const getImageUrl = (prompt) => {
  if (!prompt) return null;
  const encoded = encodeURIComponent(prompt + " presentation, minimalist, 4k, high quality");
  return `https://image.pollinations.ai/prompt/${encoded}?width=800&height=600&nologo=true`;
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

  const slideStyle = {
    backgroundImage: bgImage ? `linear-gradient(rgba(255,255,255,0.92), rgba(255,255,255,0.92)), url(${bgImage})` : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div className="ppt-slide group" style={slideStyle}>
      <div className="slide-header" style={{background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(5px)'}}>
        <h3>
            <EditableText 
                value={slide.title || "无标题"} 
                onChange={(val) => handleChange('title', val)}
            />
        </h3>
        <span className="slide-badge">P{index + 1}</span>
      </div>

      <div className="slide-body">
        
        {/* Title Slide */}
        {slide.slide_type === 'title' && (
          <div className="slide-type-title">
            <EditableText 
                tagName="h1" 
                value={slide.title} 
                onChange={(val) => handleChange('title', val)}
                style={{textShadow: '0 2px 4px rgba(0,0,0,0.1)'}} 
            />
            <div className="separator" style={{background: '#1a73e8'}}></div>
            <EditableText 
                tagName="p" 
                value={slide.subtitle || "点击输入副标题"} 
                onChange={(val) => handleChange('subtitle', val)} 
            />
          </div>
        )}

        {/* Content Slide */}
        {slide.slide_type === 'content' && (
          <div className="two-col-grid">
             <div className="col-box" style={{background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.05)'}}>
                <ul className="col-list">
                  {(Array.isArray(slide.content) ? slide.content : []).map((item, i) => (
                    <li key={i}>
                        <EditableText 
                            value={item} 
                            onChange={(val) => handleChange('content', val, i)} 
                        />
                    </li>
                  ))}
                </ul>
             </div>
             <div className="col-box" style={{
                 backgroundImage: bgImage ? `url(${bgImage})` : 'none',
                 backgroundSize: 'cover', backgroundPosition: 'center',
                 borderRadius: '12px', minHeight: '200px',
                 boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
             }}>
                {!bgImage && <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#888'}}>暂无配图</div>}
             </div>
          </div>
        )}

        {/* Two Column */}
        {slide.slide_type === 'two_column' && (
          <div className="two-col-grid">
            <div className="col-box" style={{background: 'rgba(255,255,255,0.5)'}}>
              <h4 className="col-title" style={{color: '#1967d2'}}>
                  <EditableText 
                    value={slide.left_topic || '观点 A'} 
                    onChange={(val) => handleChange('left_topic', val)} 
                  />
              </h4>
              <ul className="col-list">
                {(Array.isArray(slide.left_content) ? slide.left_content : []).map((item, i) => (
                  <li key={i}>
                    <EditableText 
                        value={item} 
                        onChange={(val) => handleChange('left_content', val, i)} 
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-box" style={{background: 'rgba(255,255,255,0.5)'}}>
              <h4 className="col-title" style={{color: '#1967d2'}}>
                  <EditableText 
                    value={slide.right_topic || '观点 B'} 
                    onChange={(val) => handleChange('right_topic', val)} 
                  />
              </h4>
              <ul className="col-list">
                {(Array.isArray(slide.right_content) ? slide.right_content : []).map((item, i) => (
                  <li key={i}>
                    <EditableText 
                        value={item} 
                        onChange={(val) => handleChange('right_content', val, i)} 
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const PreviewPanel = ({ slides, onUpdateSlide, isLoading }) => {
  const safeSlides = Array.isArray(slides) ? slides : [];

  return (
    <div className="preview-container" style={{position: 'relative'}}>
      {/* [New] 顶部进度条 */}
      {isLoading && (
          <div className="progress-container">
            <div className="progress-bar-value"></div>
          </div>
      )}

      <div className="preview-header">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#202124', margin: 0 }}>
            实时预览 (Live Preview)
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#1a73e8' }}>
            共 {safeSlides.length} 页 • {isLoading ? "✨ 正在生成..." : "✅ 准备就绪"}
          </span>
        </div>
      </div>
      
      {safeSlides.length === 0 && (
        <div className="empty-state">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>���</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>准备数据中...</h3>
            <p>请粘贴您的文本数据、报告或需求，AI 将自动整理为 PPT。</p>
        </div>
      )}
      
      <div style={{ position: 'relative', opacity: isLoading ? 0.8 : 1, transition: 'opacity 0.3s' }}>
        {safeSlides.map((slide, i) => (
            <SlideRenderer key={i} slide={slide} index={i} onUpdate={onUpdateSlide} />
        ))}
      </div>
    </div>
  );
};
