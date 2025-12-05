import PptxGenJS from "pptxgenjs";
import { getSmartImageUrl } from "./smartImage"; 

// [CONFIG] 宽屏布局参数 (13.33 x 7.5 inch)
const LAYOUT = {
    MARGIN_X: 0.7,      // 左边距 (英寸)
    CONTENT_W: "90%",   // 内容宽
    TITLE_Y: 0.4,       // 标题纵坐标
    BODY_Y: 1.2,        // 正文纵坐标 (留出更多顶部呼吸空间)
    BODY_H: 5.8,        // 内容高度 (7.5 - 1.2 - 0.5 = ~5.8 安全区域)
    FONT_TITLE: 28,     // 标题字号 (大屏可以稍微大一点)
    FONT_BODY: 16,      // 正文字号 (16pt 在宽屏上清晰且能容纳)
    LINE_SPACING: 24    // 行间距 (舒适阅读)
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
  
  // [CRITICAL CHANGE] 使用宽屏模式 (13.33 x 7.5 inches)
  pptx.layout = "LAYOUT_WIDE"; 
  
  pptx.title = slides[0]?.title || "Presentation";

  const TEXT_COLOR = "FFFFFF"; 
  const BULLET_COLOR = "1A73E8"; 
  const TEXT_SHADOW = { type: 'outer', color: '000000', blur: 3, opacity: 0.8, offset: 1, angle: 45 }; 

  const textBaseOpts = { color: TEXT_COLOR, shadow: TEXT_SHADOW, isTextBox: true, valign: "top" }; 

  slidesWithImages.forEach((slide) => {
    const slidePage = pptx.addSlide();
    const bgData = slide._base64Image;

    // 背景
    if (bgData) {
        slidePage.addImage({ data: bgData, x: 0, y: 0, w: "100%", h: "100%" });
        slidePage.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "000000", transparency: 40 } });
    } else {
        slidePage.background = { color: "202124" }; 
    }

    // 标题页
    if (slide.slide_type === "title") {
        slidePage.addText(slide.title || "Presentation", { 
            x: 0.5, y: "40%", w: "90%", h: 1.5, 
            fontSize: 44, // 宽屏大标题
            color: TEXT_COLOR, bold: true, align: "center", shadow: TEXT_SHADOW, ...textBaseOpts
        });
        if (slide.subtitle) slidePage.addText(slide.subtitle, { 
            x: 0.5, y: "60%", w: "90%", h: 1, 
            fontSize: 24, 
            color: TEXT_COLOR, align: "center", shadow: TEXT_SHADOW, ...textBaseOpts
        });
    } 
    // 内容页
    else {
        // 页面标题
        slidePage.addText(slide.title || "Untitled", { 
            x: LAYOUT.MARGIN_X, y: LAYOUT.TITLE_Y, w: LAYOUT.CONTENT_W, h: 0.8, 
            fontSize: LAYOUT.FONT_TITLE, 
            color: TEXT_COLOR, bold: true, shadow: TEXT_SHADOW, ...textBaseOpts, valign: "middle"
        });

        // 内容区域
        const lines = slide.slide_type === 'two_column' 
            ? [...(slide.left_content||[]), ...(slide.right_content||[])] 
            : (slide.content || []);
            
        if (lines.length > 0) {
            slidePage.addText(lines.map(l => ({ 
                text: l, 
                options: { bullet: { code: '2022', color: BULLET_COLOR }, ...textBaseOpts } 
            })), { 
                x: LAYOUT.MARGIN_X, y: LAYOUT.BODY_Y, w: LAYOUT.CONTENT_W, h: LAYOUT.BODY_H,
                fontSize: LAYOUT.FONT_BODY,   
                lineSpacing: LAYOUT.LINE_SPACING 
            }); 
        }
    }
  });

  const fileName = (slides[0]?.title || "presentation").replace(/[\s\/\\:*?"<>|]+/g, "_") + ".pptx";
  return pptx.writeFile({ fileName });
};
