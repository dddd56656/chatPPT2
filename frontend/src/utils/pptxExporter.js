/**
 * [CTO Fix] 导出时确保图片可见性
 */
const getImageUrl = (prompt) => {
  if (!prompt) return null;
  const encoded = encodeURIComponent(prompt + " presentation, minimalist, 4k");
  // 导出时使用更小的尺寸以加快下载，同时保证 PPT 内清晰
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=768&nologo=true`;
};

export const exportToPPTX = async (slides) => {
  if (!slides || slides.length === 0) throw new Error("没有内容可导出");

  let PptxGenJS;
  try {
    const module = await import("pptxgenjs");
    PptxGenJS = module.default || module;
  } catch (e) {
    throw new Error("导出组件加载失败: " + e.message);
  }

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = slides[0]?.title || "Presentation";

  for (const slide of slides) {
    const slidePage = pptx.addSlide();
    const imgUrl = getImageUrl(slide.image_prompt);

    // --- 背景图逻辑 ---
    // 为了防止文字看不清，我们在 PPT 里也加一个半透明白色蒙版
    if (imgUrl) {
        slidePage.addImage({ path: imgUrl, x: 0, y: 0, w: "100%", h: "100%" });
        // 添加一个全屏半透明矩形作为遮罩 (让文字更清晰)
        if (slide.slide_type !== 'title') { // 标题页可以让图片更亮一点
            slidePage.addShape(pptx.ShapeType.rect, { 
                x: 0, y: 0, w: "100%", h: "100%", 
                fill: { color: "FFFFFF", transparency: 20 } // 20% 透明的白色 = 80% 遮盖
            });
        }
    } else {
        slidePage.background = { color: "F5F7FA" };
    }

    // --- 1. Title Slide ---
    if (slide.slide_type === "title") {
      // 标题页文字加阴影/背景框
      slidePage.addText(slide.title || "无标题", {
        x: 0.5, y: 2.5, w: "90%", h: 1.5,
        fontSize: 44, color: "202124", bold: true, align: "center",
        isTextBox: true, // 文本框模式
        fill: { color: "FFFFFF", transparency: 20 } // 文字背景半透明
      });
      if (slide.subtitle) {
        slidePage.addText(slide.subtitle, {
          x: 1.5, y: 4.2, w: "70%", h: 1,
          fontSize: 24, color: "5F6368", align: "center",
          fill: { color: "FFFFFF", transparency: 20 }
        });
      }
    } 
    
    // --- 2. Content Slide ---
    else if (slide.slide_type === "content") {
      slidePage.addText(slide.title || "Untitled", {
        x: 0.5, y: 0.3, w: "90%", h: 0.8,
        fontSize: 24, color: "1A73E8", bold: true, 
        fill: { color: "FFFFFF", transparency: 10 }
      });

      const contentLines = Array.isArray(slide.content) ? slide.content : [];
      if (contentLines.length > 0) {
        const textObjects = contentLines.map(line => ({
          text: line, options: { breakLine: true, bullet: true }
        }));
        slidePage.addText(textObjects, {
          x: 0.5, y: 1.2, w: "50%", h: 5.0, // 左侧文字
          fontSize: 18, color: "000000", lineSpacing: 32, valign: "top",
          fill: { color: "FFFFFF", transparency: 10 } // 白色卡片背景
        });
      }
    }
    
    // --- 3. Two Column ---
    else {
      slidePage.addText(slide.title || "Untitled", {
        x: 0.5, y: 0.3, w: "90%", h: 0.8,
        fontSize: 24, color: "1A73E8", bold: true,
        fill: { color: "FFFFFF", transparency: 10 }
      });
      
      const leftLines = Array.isArray(slide.left_content) ? slide.left_content : [];
      if (leftLines.length) {
          const objs = leftLines.map(l => ({ text: l, options: { bullet: true } }));
          slidePage.addText(objs, { 
              x: 0.5, y: 1.5, w: "45%", h: 4.5, fontSize: 14, color: "000000",
              fill: { color: "FFFFFF", transparency: 10 }
          });
      }

      const rightLines = Array.isArray(slide.right_content) ? slide.right_content : [];
      if (rightLines.length) {
          const objs = rightLines.map(l => ({ text: l, options: { bullet: true } }));
          slidePage.addText(objs, { 
              x: 5.0, y: 1.5, w: "45%", h: 4.5, fontSize: 14, color: "000000",
              fill: { color: "FFFFFF", transparency: 10 }
          });
      }
    }
  }

  const fileName = (slides[0]?.title || "presentation").replace(/\s+/g, "_") + ".pptx";
  return pptx.writeFile({ fileName });
};
