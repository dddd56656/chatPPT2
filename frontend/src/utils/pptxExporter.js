import PptxGenJS from "pptxgenjs";
import { getSmartImageUrl } from "./smartImage"; 

// [CONFIG] 宽屏布局参数 (13.33 x 7.5 inch)
const LAYOUT = {
    MARGIN_X: 0.7,      
    CONTENT_W: "90%",   
    TITLE_Y: 0.4,       
    BODY_Y: 1.2,        
    BODY_H: 5.8,        
    FONT_TITLE: 28,     
    FONT_BODY: 16,      
    LINE_SPACING: 24    
};

// [CTO Fix]: 文本清洗工具 - 移除不可见的 XML 非法字符
// 这是解决 "PPT无法读取" 问题的核心
const sanitizeText = (str) => {
    if (!str) return "";
    // 移除 ASCII 控制字符 (0-8, 11-12, 14-31)，保留换行符(\n)和制表符(\t)
    // 这种字符通常是 LLM 生成时的幻觉噪音
    return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
};

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

export const exportToPPTX = async (slides) => {
  if (!slides || slides.length === 0) throw new Error("没有内容可导出");

  const slidesWithImages = await Promise.all(slides.map(async (slide) => {
    const imgUrl = await getSmartImageUrl(slide.title, 1280, 720); 
    let base64Data = "";
    if (imgUrl) {
        base64Data = await fetchImageToBase64(imgUrl);
    }
    return { ...slide, _base64Image: base64Data };
  }));

  let PptxGenJS_Lib;
  try {
    const module = await import("pptxgenjs");
    PptxGenJS_Lib = module.default || module;
  } catch (e) {
    throw new Error("导出组件加载失败");
  }
  const pptx = new PptxGenJS_Lib();
  
  pptx.layout = "LAYOUT_WIDE"; 
  // [CTO Fix] 清洗标题
  pptx.title = sanitizeText(slides[0]?.title || "Presentation");

  const TEXT_COLOR = "FFFFFF"; 
  const BULLET_COLOR = "1A73E8"; 
  const TEXT_SHADOW = { type: 'outer', color: '000000', blur: 3, opacity: 0.8, offset: 1, angle: 45 }; 

  const textBaseOpts = { color: TEXT_COLOR, shadow: TEXT_SHADOW, isTextBox: true, valign: "top" }; 

  slidesWithImages.forEach((slide) => {
    const slidePage = pptx.addSlide();
    const bgData = slide._base64Image;

    if (bgData) {
        slidePage.addImage({ data: bgData, x: 0, y: 0, w: "100%", h: "100%" });
        slidePage.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "000000", transparency: 40 } });
    } else {
        slidePage.background = { color: "202124" }; 
    }

    // [CTO Fix] 全面应用 sanitizeText
    if (slide.slide_type === "title") {
        slidePage.addText(sanitizeText(slide.title || "Presentation"), { 
            x: 0.5, y: "40%", w: "90%", h: 1.5, 
            fontSize: 44, 
            color: TEXT_COLOR, bold: true, align: "center", shadow: TEXT_SHADOW, ...textBaseOpts
        });
        if (slide.subtitle) slidePage.addText(sanitizeText(slide.subtitle), { 
            x: 0.5, y: "60%", w: "90%", h: 1, 
            fontSize: 24, 
            color: TEXT_COLOR, align: "center", shadow: TEXT_SHADOW, ...textBaseOpts
        });
    } 
    else {
        slidePage.addText(sanitizeText(slide.title || "Untitled"), { 
            x: LAYOUT.MARGIN_X, y: LAYOUT.TITLE_Y, w: LAYOUT.CONTENT_W, h: 0.8, 
            fontSize: LAYOUT.FONT_TITLE, 
            color: TEXT_COLOR, bold: true, shadow: TEXT_SHADOW, ...textBaseOpts, valign: "middle"
        });

        const lines = slide.slide_type === 'two_column' 
            ? [...(slide.left_content||[]), ...(slide.right_content||[])] 
            : (slide.content || []);
            
        if (lines.length > 0) {
            slidePage.addText(lines.map(l => ({ 
                text: sanitizeText(l), // [CTO Fix] 每一行内容都要清洗
                options: { bullet: { code: '2022', color: BULLET_COLOR }, ...textBaseOpts } 
            })), { 
                x: LAYOUT.MARGIN_X, y: LAYOUT.BODY_Y, w: LAYOUT.CONTENT_W, h: LAYOUT.BODY_H,
                fontSize: LAYOUT.FONT_BODY,   
                lineSpacing: LAYOUT.LINE_SPACING 
            }); 
        }
    }
  });

  const safeFileName = sanitizeText(slides[0]?.title || "presentation").replace(/[\s\/\\:*?"<>|]+/g, "_");
  return pptx.writeFile({ fileName: safeFileName + ".pptx" });
};
