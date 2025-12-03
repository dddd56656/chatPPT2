import React from 'react';

const SlideRenderer = ({ slide, index }) => {
  // 安全保护：如果 slide 是空的，不渲染
  if (!slide) return null;

  return (
    <div className="ppt-slide">
      <div className="slide-header">
        <h3>{slide.title || "无标题"}</h3>
        <span className="slide-badge">
          P{index + 1} • {slide.slide_type?.toUpperCase() || "CONTENT"}
        </span>
      </div>

      <div className="slide-body">
        {slide.slide_type === 'title' && (
          <div className="slide-type-title">
            <h1>{slide.title}</h1>
            <div className="separator"></div>
            <p>{slide.subtitle}</p>
          </div>
        )}

        {slide.slide_type === 'content' && (
          <div className="col-box" style={{ height: '100%', justifyContent: 'center' }}>
            <ul className="col-list" style={{ fontSize: '1.1rem' }}>
              {/* 安全映射: 确保 content 是数组 */}
              {(Array.isArray(slide.content) ? slide.content : []).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {(!slide.content || slide.content.length === 0) && <li>(等待内容...)</li>}
            </ul>
          </div>
        )}

        {slide.slide_type === 'two_column' && (
          <div className="two-col-grid">
            <div className="col-box">
              <h4 className="col-title">{slide.left_topic || 'A'}</h4>
              <ul className="col-list">
                {(Array.isArray(slide.left_content) ? slide.left_content : []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="col-box">
              <h4 className="col-title">{slide.right_topic || 'B'}</h4>
              <ul className="col-list">
                {(Array.isArray(slide.right_content) ? slide.right_content : []).map((item, i) => (
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
  // 安全保护：确保 slides 是数组
  const safeSlides = Array.isArray(slides) ? slides : [];

  if (safeSlides.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>���</div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>画布准备就绪</h3>
        <p>请在左侧输入主题，AI 将为您生成中文 PPT。</p>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#202124', margin: 0 }}>
            实时预览
          </h2>
          <span style={{ fontSize: '0.85rem', color: '#1a73e8' }}>
            共 {safeSlides.length} 页
          </span>
        </div>
      </div>
      
      {safeSlides.map((slide, i) => (
        <SlideRenderer key={i} slide={slide} index={i} />
      ))}
    </div>
  );
};
