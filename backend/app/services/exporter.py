"""PPT导出服务模块。

该模块负责将PPT对象转换为可下载的PPTX文件缓冲区。
"""

import io
from typing import Dict, Any, Optional
from pptx import Presentation


class PPTExporter:
    """PPT导出器类，负责将PPT对象转换为PPTX文件缓冲区。"""

    def __init__(self):
        """初始化导出器。"""
        self.supported_formats = ["pptx"]
        self.default_format = "pptx"

    def export_ppt(
        self, presentation: Presentation, title: Optional[str] = None
    ) -> Dict[str, Any]:
        """导出PPT为PPTX格式。

        Args:
            presentation: PPT对象
            title: PPT标题，用于生成文件名

        Returns:
            包含PPTX文件缓冲区和元数据的字典
        """
        buffer = io.BytesIO()
        presentation.save(buffer)
        buffer.seek(0)

        return {
            "buffer": buffer,
            "content_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "filename": self._generate_filename(title),
            "file_size": len(buffer.getvalue()),
        }

    def _generate_filename(self, title: Optional[str] = None) -> str:
        """生成导出文件名。

        Args:
            title: PPT标题

        Returns:
            生成的文件名
        """
        base_name = title.replace(" ", "_") if title else "presentation"
        return f"{base_name}.pptx"


# 导出服务实例
exporter_service = PPTExporter()