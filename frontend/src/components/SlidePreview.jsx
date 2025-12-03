/**
 * [CTO Refactor] SlidePreview Component
 * 职责: 渲染结构化幻灯片数据，提供实时视觉反馈。
 */
import React from 'react';

const SlideRenderer = ({ slide, index }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm min-h-[220px] flex flex-col transition-all hover:shadow-md">
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">
          Page {index + 1}
        </span>
        <span className="text-xs text-gray-400 uppercase">
          {slide.slide_type}
        </span>
      </div>
      
      <h3 className="text-xl font-bold text-gray-800 mb-4">{slide.title}</h3>
      
      <div className="flex-1 text-sm">
        {slide.slide_type === 'title' && (
           <div className="flex items-center justify-center h-full min-h-[100px]">
             <div className="text-gray-500 text-lg italic text-center">{slide.subtitle}</div>
           </div>
        )}

        {slide.slide_type === 'content' && (
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            {slide.content?.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        )}

        {slide.slide_type === 'two_column' && (
          <div className="grid grid-cols-2 gap-4 h-full">
            <div className="bg-gray-50 p-3 rounded border border-dashed border-gray-200">
                <div className="font-semibold text-blue-800 mb-2">{slide.left_topic || 'Left'}</div>
                <ul className="list-disc pl-4 text-gray-600 space-y-1">
                    {slide.left_content?.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
            </div>
            <div className="bg-gray-50 p-3 rounded border border-dashed border-gray-200">
                <div className="font-semibold text-blue-800 mb-2">{slide.right_topic || 'Right'}</div>
                <ul className="list-disc pl-4 text-gray-600 space-y-1">
                    {slide.right_content?.map((item, i) => <li key={i}>{item}</li>)}
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
      <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200 p-8">
        <p className="text-center">预览区域空闲<br/><span className="text-sm">等待大纲生成...</span></p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
      <div className="p-4 bg-white border-b border-gray-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <h2 className="text-lg font-bold text-gray-700">实时预览</h2>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">{slides.length} 页</span>
      </div>
      <div className="overflow-y-auto p-4 flex-1 scroll-smooth">
        {slides.map((slide, i) => (
          <SlideRenderer key={i} slide={slide} index={i} />
        ))}
      </div>
    </div>
  );
};
