import PptxGenJS from "pptxgenjs";
import { getSmartImageUrl } from "./smartImage"; 

// [CONFIG] 视觉对齐参数 (Compact Wide Mode)
// 目标：让 PPT 的密度与网页预览 (0.9rem font) 保持一致
const LAYOUT = {
    MARGIN_X: 0.5,      // 0.5英寸 (约1.27cm) - 窄边距
    CONTENT_W: "92%",   // 利用更多宽度
    TITLE_Y: 0.4,       // 标题位置
    BODY_Y: 1.0,        // 正文起始位置
    BODY_H: 6.0,        // 内容高度安全区
    FONT_TITLE: 24,     // 标题 24pt
    FONT_BODY: 12,      // [关键] 正文 12pt (解决穿底，对齐网页)
    LINE_SPACING: 20    // [关键] 行距 20 (紧凑舒适)
};

// [CTO Fix] 数据清洗：移除导致 PPT 损坏的非法控制字符
const sanitizeText = (str) => {
    if (!str) return "";
    return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
};

const fetchImageToBase64 = async (url) => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error("err");
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result?.length > 100 ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch { return ""; }
};

export const exportToPPTX = async (slides) => {
  if (!slides?.length) throw new Error("No content");

  const slidesWithImages = await Promise.all(slides.map(async (slide) => {
    const imgUrl = await getSmartImageUrl(slide.title, 1280, 720); 
    const base64 = imgUrl ? await fetchImageToBase64(imgUrl) : "";
    return { ...slide, _base64Image: base64 };
  }));

  let PptxGenJS_Lib;
  try {
    const module = await import("pptxgenjs");
    PptxGenJS_Lib = module.default || module;
  } catch (e) {
    throw new Error("导出组件加载失败");
  }
  const pptx = new PptxGenJS_Lib();
  
  // 使用宽屏布局
  pptx.layout = "LAYOUT_WIDE"; 
  pptx.title = sanitizeText(slides[0]?.title || "Presentation");

  const colors = { text: "FFFFFF", bullet: "1A73E8", shadow: { type: 'outer', color: '000000', blur: 3, opacity: 0.8 } };
  const baseOpts = { color: colors.text, shadow: colors.shadow, isTextBox: true, valign: "top" };

  slidesWithImages.forEach((slide) => {
    const p = pptx.addSlide();
    const bgData = slide._base64Image;

    // 背景图 (无黑色遮罩，保持通透)
    if (bgData) {
        p.addImage({ data: bgData, x: 0, y: 0, w: "100%", h: "100%" });
        // 仅添加极淡的渐变或不添加，依靠文字阴影
    } else {
        p.background = { color: "202124" };
    }

    // 标题页
    if (slide.slide_type === "title") {
        p.addText(sanitizeText(slide.title), { 
            x: 0.5, y: "40%", w: "90%", h: 1.5, 
            fontSize: 40, bold: true, align: "center", ...baseOpts 
        });
        if (slide.subtitle) p.addText(sanitizeText(slide.subtitle), { 
            x: 0.5, y: "60%", w: "90%", h: 1, 
            fontSize: 20, align: "center", ...baseOpts 
        });
    } 
    // 内容页
    else {
        // 页面标题
        p.addText(sanitizeText(slide.title), { 
            x: LAYOUT.MARGIN_X, y: LAYOUT.TITLE_Y, w: LAYOUT.CONTENT_W, h: 0.8, 
            fontSize: LAYOUT.FONT_TITLE, bold: true, valign: "middle", ...baseOpts 
        });

        // 内容列表
        const lines = slide.slide_type === 'two_column' 
            ? [...(slide.left_content||[]), ...(slide.right_content||[])] 
            : (slide.content || []);
            
        if (lines.length > 0) {
            p.addText(lines.map(l => ({ 
                text: sanitizeText(l), // [Fix] 清洗每一行
                options: { bullet: { code: '2022', color: colors.bullet }, ...baseOpts } 
            })), { 
                x: LAYOUT.MARGIN_X, y: LAYOUT.BODY_Y, w: LAYOUT.CONTENT_W, h: LAYOUT.BODY_H,
                fontSize: LAYOUT.FONT_BODY,   // 12pt
                lineSpacing: LAYOUT.LINE_SPACING // 20
            }); 
        }
    }
  });

  const safeName = sanitizeText(slides[0]?.title || "presentation").replace(/[\s\/\\:*?"<>|]+/g, "_");
  return pptx.writeFile({ fileName: safeName + ".pptx" });
};
