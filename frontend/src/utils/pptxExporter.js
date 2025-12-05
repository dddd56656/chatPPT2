import PptxGenJS from "pptxgenjs";
import { getSmartImageUrl } from "./smartImage"; 

const fetchImageToBase64 = async (url) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error("Network error");
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'string' && reader.result.length > 100) {
              resolve(reader.result);
          } else {
              resolve("");
          }
      };
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Image fetch failed, returning empty string:", url);
    return "";
  }
};

// [CRITICAL CONFIG] 每页最大安全内容行数
// 基于 14pt 字体和 22 行距的保守估算，确保不穿底
const MAX_LINES_PER_CONTENT_SLIDE = 12;

// [NEW FUNCTION] 内容分页预处理
const preprocessSlidesForPaging = (slides) => {
    const paginatedSlides = [];
    
    slides.forEach((slide) => {
        // 只对 'content' 类型进行分页处理 (title/two_column 结构相对固定)
        if (slide.slide_type === 'content' && slide.content && slide.content.length > MAX_LINES_PER_CONTENT_SLIDE) {
            
            const totalLines = slide.content.length;
            const numPages = Math.ceil(totalLines / MAX_LINES_PER_CONTENT_SLIDE);
            
            for (let i = 0; i < numPages; i++) {
                const start = i * MAX_LINES_PER_CONTENT_SLIDE;
                const end = start + MAX_LINES_PER_CONTENT_SLIDE;
                const contentChunk = slide.content.slice(start, end);
                
                // 构造新的分页 Slide 对象
                const newSlide = {
                    ...slide,
                    // 标记当前页码，例如 "技术突破 (续 1/3)"
                    title: `${slide.title} (续 ${i + 1}/${numPages})`,
                    content: contentChunk,
                    // 确保每页都有新的 image_prompt 供加载 (虽然都是一样的)
                    image_prompt: slide.image_prompt 
                };
                paginatedSlides.push(newSlide);
            }
        } else {
            // 不需分页的页面直接添加
            paginatedSlides.push(slide);
        }
    });
    
    return paginatedSlides;
};

export const exportToPPTX = async (slides) => {
  if (!slides || slides.length === 0) throw new Error("没有内容可导出");

  // 1. [CRITICAL STEP] 先进行内容分页预处理
  const paginatedSlides = preprocessSlidesForPaging(slides);

  // 2. 异步获取图片 Base64 数据
  const slidesWithImages = await Promise.all(paginatedSlides.map(async (slide) => {
    const imgUrl = await getSmartImageUrl(slide.title, 1280, 720); 
    let base64Data = "";
    if (imgUrl) {
        base64Data = await fetchImageToBase64(imgUrl);
    }
    return { ...slide, _base64Image: base64Data };
  }));

  // 初始化 PPT
  let PptxGenJS_Lib;
  try {
    const module = await import("pptxgenjs");
    PptxGenJS_Lib = module.default || module;
  } catch (e) {
    throw new Error("导出组件加载失败");
  }
  const pptx = new PptxGenJS_Lib();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = slides[0]?.title || "Presentation";

  const TEXT_COLOR = "FFFFFF"; 
  const BULLET_COLOR = "1A73E8"; 
  const TITLE_SHADOW = { type: 'outer', color: '000000', blur: 5, opacity: 0.8, offset: 0 }; 

  const textBaseOpts = { color: TEXT_COLOR, shadow: TITLE_SHADOW, isTextBox: true, valign: "top" }; 

  slidesWithImages.forEach((slide) => {
    const slidePage = pptx.addSlide();
    const bgData = slide._base64Image;

    // --- 背景层 ---
    if (bgData) {
        slidePage.addImage({ data: bgData, x: 0, y: 0, w: "100%", h: "100%" });
        slidePage.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "000000", transparency: 85 } });
    } else {
        slidePage.background = { color: "202124" }; 
    }

    // --- 浮动文字层 ---

    // 标题
    if (slide.slide_type === "title") {
        slidePage.addText(slide.title || "Presentation", { 
            x: "5%", y: "45%", w: "90%", h: 1, 
            fontSize: 30, 
            color: TEXT_COLOR, bold: true, align: "center", shadow: TITLE_SHADOW, ...textBaseOpts
        });
        if (slide.subtitle) slidePage.addText(slide.subtitle, { 
            x: "10%", y: "60%", w: "80%", h: 0.5, 
            fontSize: 18, 
            color: TEXT_COLOR, align: "center", shadow: TITLE_SHADOW, ...textBaseOpts
        });
    } 
    // 内容/双栏
    else {
        // [Final Layout]: 页面标题 - 移至 Y: 0.2, 字体 18pt
        slidePage.addText(slide.title || "Untitled", { 
            x: 0.5, y: 0.2, w: "90%", h: 0.4, 
            fontSize: 18, 
            color: TEXT_COLOR, bold: true, shadow: TITLE_SHADOW, ...textBaseOpts, valign: "middle"
        });

        // 内容区域
        const contentX = 0.8;
        const contentW = "88%";
        const lines = slide.slide_type === 'two_column' 
            ? [...(slide.left_content||[]), ...(slide.right_content||[])] 
            : (slide.content || []);
            
        if (lines.length > 0) {
            slidePage.addText(lines.map(l => ({ 
                text: l, 
                options: { bullet: { code: '2022', color: BULLET_COLOR }, ...textBaseOpts } 
            })), { 
                // [Final Layout]: 内容主体 - Y: 0.8, H: 6.8
                x: contentX, y: 0.8, w: contentW, h: 6.8, 
                fontSize: 14, 
                lineSpacing: 22 
            }); 
        }
    }
  });

  const fileName = (slides[0]?.title || "presentation").replace(/[\s\/\\:*?"<>|]+/g, "_") + ".pptx";
  return pptx.writeFile({ fileName });
};