"""
设计美化服务模块 (design.py)

CTO注：此模块负责将 *内容数据* (slides_data) 
应用到 *PPT模板* (business_report.pptx) 上。

[已修复] 我已加固此文件，使其更健壮 (Robust)，
特别是 `_get_layout` 和 `_get_body_placeholders`
方法，以防止因模板名称不匹配而导致的崩溃。
"""

import os
import logging
import io
from typing import Dict, Any, List, Optional, Union

from pptx import Presentation
from pptx.slide import SlideLayout, Slide
from pptx.util import Inches

# 导入真实的PPTExporter
from .exporter import PPTExporter

# 配置日志
logger = logging.getLogger(__name__)


class TemplateEngine:
    """PPT模板引擎类，负责应用模板和样式到PPT内容。"""

    # [CTO 修复]：使用你模板中的真实布局名称。
    # 你的 'business_report.pptx' 模板中：
    # 布局 0 = "Title 1"
    # 布局 4 = "Title and Content"
    # 布局 6 = "Title and two Content 1"
    LAYOUT_NAMES = {
        "title": "Title 1",  # 索引 0
        "content": "Title and Content",  # 索引 4
        "two_column": "Title and two Content 1",  # 索引 6
    }

    # [CTO 修复]：使用正确的索引作为回退
    LAYOUT_INDICES = {"title": 0, "content": 4, "two_column": 6}

    def __init__(
        self,
        exporter: PPTExporter,
        # [CTO 修复]：确保路径指向 'backend/templates/...'
        template_path: str = "templates/business_report.pptx",
    ):
        """
        初始化模板引擎。
        
        Args:
            exporter (PPTExporter): 依赖注入的导出器实例。
            template_path (str): 相对于项目根目录的模板路径。
        """
        self.exporter = exporter
        self.template_path = template_path

    def create_from_template(
        self,
        title: str = "演示文稿",
        slides_data: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        [Node 3 调用] 使用模板创建PPT并进行内容修改。
        
        CTO注：这是 `tasks.export_ppt_task` 调用的核心方法。
        """
        prs = self._load_resource()

        # 核心步骤 1: 清理现有幻灯片 (保留母版样式)
        self._clear_existing_slides(prs)

        # 核心步骤 2: 构建内容
        if not slides_data:
            # 如果没有数据，至少创建一个标题页
            self._create_title_slide(prs, title)
        else:
            for i, slide_info in enumerate(slides_data):
                try:
                    # 容错机制：即使单张失败，也要继续尝试下一张
                    self._create_slide_by_type(prs, slide_info, i)
                except Exception as e:
                    logger.error(f"创建第 {i+1} 张幻灯片失败: {str(e)}", exc_info=True)

        # 核心步骤 3: 调用导出器将 Presentation 对象转为内存中的 buffer
        return self.exporter.export_ppt(prs, title=title)

    def _load_resource(self) -> Presentation:
        """加载模板资源，带有容错处理。"""
        if os.path.exists(self.template_path):
            logger.info(f"加载模板: {self.template_path}")
            return Presentation(self.template_path)
        else:
            logger.warning(f"模板未找到: {self.template_path}，降级为创建空白PPT")
            return Presentation()

    def _clear_existing_slides(self, prs: Presentation) -> None:
        """清空现有幻灯片 (私有 API 操作，高风险)。"""
        try:
            xml_slides = prs.slides._sldIdLst
            slides_count = len(xml_slides)
            # 倒序删除
            for i in range(slides_count - 1, -1, -1):
                rId = xml_slides[i].rId
                prs.part.drop_rel(rId)
                del xml_slides[i]
        except Exception as e:
            logger.error(f"清理幻灯片时发生错误 (非致命): {str(e)}")

    def _get_layout(self, prs: Presentation, layout_key: str) -> SlideLayout:
        """[已加固] 根据名称安全获取布局 (优先名称匹配，其次索引回退)。"""
        target_name = self.LAYOUT_NAMES.get(layout_key)

        # 1. 尝试通过名称查找 (Plan A)
        for layout in prs.slide_layouts:
            if layout.name == target_name:
                return layout

        # 2. 回退到索引查找 (Plan B)
        fallback_index = self.LAYOUT_INDICES.get(layout_key, 1) # 默认回退到索引 1 (如果key错误)
        logger.warning(f"布局 '{target_name}' (Key: '{layout_key}') 未在模板中找到，回退使用索引 {fallback_index}")

        if fallback_index < len(prs.slide_layouts):
            return prs.slide_layouts[fallback_index]

        # 3. 最终回退 (保底)
        logger.error(f"请求的布局索引 {fallback_index} 超出范围，使用默认布局 [0]")
        return prs.slide_layouts[0]

    def _get_body_placeholders(self, slide: Union[Slide, SlideLayout]) -> List[Any]:
        """[已加固] 智能获取正文占位符，过滤掉 Title/Slide Number 等无关框。"""
        body_placeholders = []
        for p in slide.placeholders:
            name = p.name
            # 过滤掉所有标题、图片、页码、表格相关的占位符
            if not any(
                keyword in name
                for keyword in ["Title", "Picture", "Slide Number", "Table", "Header", "Footer"]
            ):
                body_placeholders.append(p)

        # 按位置排序：确保左侧内容填入左边的框 (top, left)
        body_placeholders.sort(key=lambda p: (p.top, p.left))

        # [CTO 修复] 如果没有找到精确的非标题框 (例如模板布局名称不标准)
        # 尝试放宽条件 (只排除 Title 和 Slide Number)
        if not body_placeholders:
            for p in slide.placeholders:
                name = p.name
                if not any(keyword in name for keyword in ["Title", "Slide Number"]):
                    body_placeholders.append(p)
            body_placeholders.sort(key=lambda p: (p.top, p.left))

        return body_placeholders

    def _create_title_slide(self, prs: Presentation, title: str, subtitle: str = ""):
        """创建标题幻灯片。"""
        layout = self._get_layout(prs, "title")
        slide = prs.slides.add_slide(layout)

        if slide.shapes.title:
            slide.shapes.title.text = title

        # 使用动态查找第一个可用内容框作为副标题
        body_placeholders = self._get_body_placeholders(slide)
        if subtitle and body_placeholders:
            self._set_placeholder_content(body_placeholders[0], subtitle)

    def _create_content_slide(self, prs: Presentation, title: str, content: Any):
        """创建内容幻灯片。"""
        layout = self._get_layout(prs, "content")
        slide = prs.slides.add_slide(layout)

        if slide.shapes.title:
            slide.shapes.title.text = title

        # 使用动态查找第一个可用内容框
        body_placeholders = self._get_body_placeholders(slide)
        if body_placeholders:
            self._set_placeholder_content(body_placeholders[0], content)
        else:
            logger.warning(
                f"幻灯片 '{title}' 的布局 ({layout.name}) 缺少可用内容占位符。"
            )

    def _create_two_column_slide(
        self, prs: Presentation, title: str, left_content: Any, right_content: Any
    ):
        """创建两栏幻灯片。"""
        layout = self._get_layout(prs, "two_column")
        slide = prs.slides.add_slide(layout)

        if slide.shapes.title:
            slide.shapes.title.text = title

        # 使用动态查找和排序后的占位符
        body_placeholders = self._get_body_placeholders(slide)

        # 智能分配内容
        if len(body_placeholders) >= 1:
            self._set_placeholder_content(body_placeholders[0], left_content)

        if len(body_placeholders) >= 2:
            self._set_placeholder_content(body_placeholders[1], right_content)
        elif len(body_placeholders) == 1:
            logger.warning(f"两栏幻灯片 '{title}' 只有一个内容框，右侧内容将被忽略。")
        else:
            logger.warning(f"两栏幻灯片 '{title}' 没有任何可用内容框。")

    def _set_placeholder_content(self, placeholder: Any, content: Any):
        """设置占位符内容，支持文本和列表。"""
        if not hasattr(placeholder, "text_frame"):
            return

        text_frame = placeholder.text_frame
        text_frame.clear()  # 清空默认文本

        if isinstance(content, list):
            # 将列表项转为带项目符号的段落
            for i, item in enumerate(content):
                if i == 0:
                    p = text_frame.paragraphs[0]
                else:
                    p = text_frame.add_paragraph()
                p.text = str(item)
        else:
            text_frame.text = str(content)

    def _create_slide_by_type(
        self, prs: Presentation, slide_info: Dict[str, Any], index: int
    ):
        """工厂分发方法。"""
        slide_type = slide_info.get("slide_type", "content")
        title = slide_info.get("title", f"幻灯片 {index+1}")

        if slide_type == "title":
            self._create_title_slide(prs, title, slide_info.get("subtitle", ""))
        elif slide_type == "two_column":
            self._create_two_column_slide(
                prs,
                title,
                slide_info.get("left_content", ""),
                slide_info.get("right_content", ""),
            )
        else:
            # 默认回退到标准内容页
            self._create_content_slide(prs, title, slide_info.get("content", ""))
