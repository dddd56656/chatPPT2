import React from 'react';

/**
 * [Google Standard] Slide Renderer
 * 使用原生 CSS 类名，解耦样式库依赖。
 */
const SlideRenderer = ({ slide, index }) => {
  return (
    <div className="ppt-slide">
      {/* Header */}
      <div className="slide-header">
        <h3>{slide.title || "Untitled Slide"}</h3>
        <span className="slide-badge">
          #{index + 1} {slide.slide_type?.toUpperCase()}
        </span>
      </div>

      {/* Body */}
      <div className="slide-body">
        
        {/* CASE 1: Title Slide */}
        {slide.slide_type === 'title' && (
          <div className="slide-type-title">
            <h1>{slide.title}</h1>
            <div className="separator"></div>
            <p>{slide.subtitle}</p>
          </div>
        )}

        {/* CASE 2: Content (Bulleted) */}
        {slide.slide_type === 'content' && (
          <div className="col-box" style={{ height: '100%', justifyContent: 'center' }}>
            <ul className="col-list" style={{ fontSize: '1.1rem' }}>
              {slide.content?.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {!slide.content?.length && <li>(等待内容生成...)</li>}
            </ul>
          </div>
        )}

        {/* CASE 3: Two Columns */}
        {slide.slide_type === 'two_column' && (
          <div className="two-col-grid">
            {/* Left */}
            <div className="col-box">
              <h4 className="col-title">{slide.left_topic || 'Topic A'}</h4>
              <ul className="col-list">
                {slide.left_content?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            {/* Right */}
            <div className="col-box">
              <h4 className="col-title">{slide.right_topic || 'Topic B'}</h4>
              <ul className="col-list">
                {slide.right_content?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const PreviewPanel = ({ slides }) => {
  if (!slides || slides.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>���</div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>画布准备就绪</h3>
        <p>在左侧聊天框输入主题，AI 将为您生成大纲和幻灯片。</p>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#202124', margin: 0 }}>
            Live Preview
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#1a73e8' }}>
            实时渲染中 • {slides.length} 页
          </span>
        </div>
      </div>
      
      {slides.map((slide, i) => (
        <SlideRenderer key={i} slide={slide} index={i} />
      ))}
    </div>
  );
};
