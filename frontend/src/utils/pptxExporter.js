import PptxGenJS from "pptxgenjs";

const getImageUrl = (prompt) => {
  if (!prompt) return null;
  const encoded = encodeURIComponent(prompt + " presentation, minimalist, 4k, high quality");
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=768&nologo=true`;
};

const fetchImageToBase64 = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Image fetch failed:", url, e);
    return null;
  }
};

export const exportToPPTX = async (slides) => {
  if (!slides || slides.length === 0) throw new Error("没有内容可导出");

  const slidesWithImages = await Promise.all(slides.map(async (slide) => {
    const imgUrl = getImageUrl(slide.image_prompt);
    let base64Data = null;
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
    throw new Error("导出组件加载失败: " + e.message);
  }

  const pptx = new PptxGenJS_Lib();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = slides[0]?.title || "Presentation";
  pptx.author = "ChatPPT AI";

  for (const slide of slidesWithImages) {
    const slidePage = pptx.addSlide();
    const bgData = slide._base64Image;

    if (bgData) {
        slidePage.addImage({ data: bgData, x: 0, y: 0, w: "100%", h: "100%" });
        if (slide.slide_type !== 'title') {
            slidePage.addShape(pptx.ShapeType.rect, { 
                x: 0, y: 0, w: "100%", h: "100%", 
                fill: { color: "FFFFFF", transparency: 85 }
            });
        }
    } else {
        slidePage.background = { color: "F5F7FA" };
    }

    const glassFill = { color: "FFFFFF", transparency: 15 };
    const shadowOpts = { type: 'outer', blur: 5, offset: 2, angle: 90, opacity: 0.2 };

    if (slide.slide_type === "title") {
      slidePage.addShape(pptx.ShapeType.rect, { x: "10%", y: "30%", w: "80%", h: "40%", fill: glassFill, shadow: shadowOpts, rectRadius: 0.5 });
      slidePage.addText(slide.title || "无标题", { x: "10%", y: "32%", w: "80%", h: 1.5, fontSize: 44, color: "2D3748", bold: true, align: "center" });
      if (slide.subtitle) slidePage.addText(slide.subtitle, { x: "10%", y: "50%", w: "80%", h: 1, fontSize: 24, color: "718096", align: "center" });
    } else if (slide.slide_type === "content") {
      slidePage.addText(slide.title || "Untitled", { x: 0.5, y: 0.3, w: "90%", h: 0.8, fontSize: 28, color: "1A73E8", bold: true, fill: glassFill, shadow: shadowOpts });
      slidePage.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.3, w: "55%", h: 5.2, fill: glassFill, shadow: shadowOpts, rectRadius: 0.2 });
      const contentLines = Array.isArray(slide.content) ? slide.content : [];
      if (contentLines.length > 0) {
        const textObjects = contentLines.map(line => ({ text: line, options: { breakLine: true, bullet: true } }));
        slidePage.addText(textObjects, { x: 0.7, y: 1.5, w: "51%", h: 4.8, fontSize: 18, color: "2D3748", lineSpacing: 32, valign: "top" });
      }
    } else {
      slidePage.addText(slide.title || "Untitled", { x: 0.5, y: 0.3, w: "90%", h: 0.8, fontSize: 28, color: "1A73E8", bold: true, fill: glassFill, shadow: shadowOpts });
      slidePage.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.3, w: "4.5", h: 5.5, fill: glassFill, shadow: shadowOpts, rectRadius: 0.2 });
      slidePage.addShape(pptx.ShapeType.rect, { x: 5.2, y: 1.3, w: "4.5", h: 5.5, fill: glassFill, shadow: shadowOpts, rectRadius: 0.2 });
      slidePage.addText(slide.left_topic || "A", { x: 0.7, y: 1.5, w: "4.1", h: 0.5, fontSize: 18, bold: true, color: "3182CE" });
      const leftLines = Array.isArray(slide.left_content) ? slide.left_content : [];
      if (leftLines.length) slidePage.addText(leftLines.map(l => ({ text: l, options: { bullet: true } })), { x: 0.7, y: 2.1, w: "4.1", h: 4.5, fontSize: 14, color: "2D3748" });
      slidePage.addText(slide.right_topic || "B", { x: 5.4, y: 1.5, w: "4.1", h: 0.5, fontSize: 18, bold: true, color: "3182CE" });
      const rightLines = Array.isArray(slide.right_content) ? slide.right_content : [];
      if (rightLines.length) slidePage.addText(rightLines.map(l => ({ text: l, options: { bullet: true } })), { x: 5.4, y: 2.1, w: "4.1", h: 4.5, fontSize: 14, color: "2D3748" });
    }
  }
  const fileName = (slides[0]?.title || "presentation").replace(/[\s\/\\:*?"<>|]+/g, "_") + ".pptx";
  return pptx.writeFile({ fileName });
};
