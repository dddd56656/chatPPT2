import React from 'react';

// Color palette for slides to avoid "boring white"
const COLORS = [
  { bg: 'bg-indigo-600', text: 'text-white', sub: 'text-indigo-100', accent: 'bg-indigo-50' },
  { bg: 'bg-emerald-600', text: 'text-white', sub: 'text-emerald-100', accent: 'bg-emerald-50' },
  { bg: 'bg-rose-600', text: 'text-white', sub: 'text-rose-100', accent: 'bg-rose-50' },
  { bg: 'bg-amber-600', text: 'text-white', sub: 'text-amber-100', accent: 'bg-amber-50' },
];

const SlideRenderer = ({ slide, index }) => {
  // Cycle colors based on index
  const theme = COLORS[index % COLORS.length];

  return (
    <div className="group relative w-full aspect-video bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-gray-100 mb-8">
      {/* Slide Header / Top Bar */}
      <div className={`h-16 ${theme.bg} flex items-center px-8 justify-between`}>
        <h3 className={`text-xl font-bold ${theme.text} truncate`}>{slide.title}</h3>
        <span className={`text-xs font-mono ${theme.sub} bg-white/20 px-2 py-1 rounded`}>
          #{index + 1} {slide.slide_type.toUpperCase()}
        </span>
      </div>

      {/* Slide Body */}
      <div className="p-8 h-[calc(100%-4rem)] flex flex-col justify-center">
        
        {/* Type: Title Slide */}
        {slide.slide_type === 'title' && (
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">{slide.title}</h1>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent mx-auto"></div>
            <p className="text-xl text-gray-500 font-light italic">{slide.subtitle}</p>
          </div>
        )}

        {/* Type: Content List */}
        {slide.slide_type === 'content' && (
          <div className="bg-gray-50 p-6 rounded-lg border-l-4 border-gray-300 h-full overflow-y-auto">
            <ul className="space-y-3">
              {slide.content?.map((item, i) => (
                <li key={i} className="flex items-start text-gray-700 text-lg">
                  <span className={`mr-3 mt-1.5 w-2 h-2 rounded-full ${theme.bg} shrink-0`}></span>
                  <span>{item}</span>
                </li>
              ))}
              {(!slide.content || slide.content.length === 0) && <li className="text-gray-300 italic">Waiting for content...</li>}
            </ul>
          </div>
        )}

        {/* Type: Two Columns */}
        {slide.slide_type === 'two_column' && (
          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Left Col */}
            <div className={`${theme.accent} p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col`}>
              <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                {slide.left_topic || 'Topic A'}
              </h4>
              <ul className="space-y-2 overflow-y-auto flex-1">
                {slide.left_content?.map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 leading-relaxed">• {item}</li>
                ))}
              </ul>
            </div>
            {/* Right Col */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col">
              <h4 className="font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">
                {slide.right_topic || 'Topic B'}
              </h4>
              <ul className="space-y-2 overflow-y-auto flex-1">
                {slide.right_content?.map((item, i) => (
                  <li key={i} className="text-sm text-gray-600 leading-relaxed">• {item}</li>
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
      <div className="h-full flex flex-col items-center justify-center bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-300 p-10">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-600">Your Canvas is Empty</h3>
        <p className="text-gray-400 mt-2 text-center max-w-xs">Start chatting on the left to generate your presentation outline.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Live Preview</h2>
        </div>
        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-mono font-medium">
          {slides.length} SLIDES
        </span>
      </div>
      <div className="overflow-y-auto p-8 flex-1 scroll-smooth bg-slate-100">
        <div className="max-w-5xl mx-auto space-y-10">
          {slides.map((slide, i) => (
            <SlideRenderer key={i} slide={slide} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};
