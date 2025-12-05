/**
 * 幻灯片智能分页工具
 * 解决内容溢出问题，将长内容自动拆分为多页
 */

// [Configuration] 单页最大安全行数 (UI 预览 & 导出基准)
const MAX_LINES = 9; 

export const splitSlides = (slides) => {
    if (!Array.isArray(slides)) return [];

    const processedSlides = [];

    slides.forEach((slide) => {
        // 1. 如果不是内容页，或者是短内容，直接保留
        if (slide.slide_type !== 'content' || !Array.isArray(slide.content) || slide.content.length <= MAX_LINES) {
            processedSlides.push(slide);
            return;
        }

        // 2. 长内容拆分逻辑
        const totalLines = slide.content.length;
        const totalPages = Math.ceil(totalLines / MAX_LINES);

        for (let i = 0; i < totalPages; i++) {
            const start = i * MAX_LINES;
            const end = start + MAX_LINES;
            const contentChunk = slide.content.slice(start, end);

            // 构造新的分页对象
            const newSlide = {
                ...slide,
                // 第一页保持原标题，后续页面加后缀
                title: i === 0 ? slide.title : `${slide.title} (续 ${i + 1})`,
                content: contentChunk,
                // 确保每一页都有唯一的 key 标识 (用于 React 渲染优化)
                _splitId: `${i}` 
            };
            processedSlides.push(newSlide);
        }
    });

    return processedSlides;
};
