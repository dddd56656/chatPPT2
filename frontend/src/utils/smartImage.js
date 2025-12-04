const translationCache = new Map();

export const getSmartImageUrl = async (text, width = 1024, height = 768) => {
  if (!text) return null;
  
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }

  let keyword = 'business'; 

  try {
    const prompt = `Extract a single concrete English noun for a background photo representing: "${text}". Do not explain.`;
    const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?private=true&model=openai`);
    
    if (response.ok) {
        const rawText = await response.text();
        keyword = rawText.replace(/[^a-zA-Z\s]/g, '').trim().split(' ')[0] || 'work';
    }
  } catch (e) {
    console.warn("Translation fallback:", e);
  }

  // 构造 LoremFlickr 链接 (使用高清图，保证 PPT 质量)
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  const lockId = Math.abs(hash) % 1000;
  
  const finalUrl = `https://loremflickr.com/${width}/${height}/${keyword}?lock=${lockId}`;
  
  translationCache.set(text, finalUrl);
  return finalUrl;
};
