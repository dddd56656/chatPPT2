import PptxGenJS from "pptxgenjs";
import { getSmartImageUrl } from "./smartImage"; // 确保使用智能翻译源

// [CRITICAL FIX]: 健壮的 Base64 下载器 (保持不变)
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

  // 1. 异步流水线: 翻译 -> 获取URL -> 下载Base64
  const slidesWithImages = await Promise.all(slides.map(async (slide) => {
    // 请求高清图 (1280x720)
    const imgUrl = await getSmartImageUrl(slide.title, 1280, 720); 
    let base64Data = "";
    if (imgUrl) {
        base64Data = await fetchImageToBase64(imgUrl);
    }
    return { ...slide, _base64Image: base64Data };
  }));

  // 2. 初始化 PPT
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

  // [FIX]: 移除 autofit: true，依赖手动设置的 w/h，增强稳定性
  const textBaseOpts = { color: TEXT_COLOR, shadow: TITLE_SHADOW, isTextBox: true, valign: "top" }; 

  // 3. 构建页面 (Immersive Floating Text Layout)
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

    // 标题 (居中大字)
    if (slide.slide_type === "title") {
        slidePage.addText(slide.title || "Presentation", { 
            x: "5%", y: "45%", w: "90%", h: 1, // H 减小以适应小字
            fontSize: 36, color: TEXT_COLOR, bold: true, align: "center", shadow: TITLE_SHADOW, ...textBaseOpts
        });
        if (slide.subtitle) slidePage.addText(slide.subtitle, { 
            x: "10%", y: "60%", w: "80%", h: 0.5, // H 减小
            fontSize: 20, color: TEXT_COLOR, align: "center", shadow: TITLE_SHADOW, ...textBaseOpts
        });
    } 
    // 内容/双栏 (左上对齐)
    else {
        // 标题
        slidePage.addText(slide.title || "Untitled", { 
            x: 0.5, y: 0.4, w: "90%", h: 0.6, // H 减小
            fontSize: 28, color: TEXT_COLOR, bold: true, shadow: TITLE_SHADOW, ...textBaseOpts, valign: "middle"
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
                x: contentX, y: 1.5, w: contentW, h: 5.5, fontSize: 16, lineSpacing: 28 
            }); // Font Size 16 and H is sufficient
        }
    }
  });

  const fileName = (slides[0]?.title || "presentation").replace(/[\s\/\\:*?"<>|]+/g, "_") + ".pptx";
  return pptx.writeFile({ fileName });
};
