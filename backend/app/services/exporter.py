"""
PPT导出服务模块 (exporter.py)

CTO注：此模块职责单一且正确 (Single Responsibility)。
它只负责将一个 `pptx.Presentation` 内存对象
转换为一个内存中的 `io.BytesIO` 缓冲区。
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
        """
        [Node 3 调用] 导出PPT为PPTX格式 (内存中)。

        Args:
            presentation: PPT对象
            title: PPT标题，用于生成文件名

        Returns:
            包含PPTX文件缓冲区和元数据的字典
        """
        # 1. 创建一个内存中的二进制缓冲区
        buffer = io.BytesIO()
        # 2. 将 Presentation 对象保存到缓冲区
        presentation.save(buffer)
        # 3. 将缓冲区的指针移回开头 (以便后续读取)
        buffer.seek(0)

        # 4. 返回包含缓冲区和元数据的数据结构
        return {
            "buffer": buffer,
            "content_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "filename": self._generate_filename(title),
            "file_size": len(buffer.getvalue()),
        }

    def _generate_filename(self, title: Optional[str] = None) -> str:
        """生成导出文件名。"""
        base_name = title.replace(" ", "_") if title else "presentation"
        return f"{base_name}.pptx"


# 导出一个单例 (Singleton) 服务实例
exporter_service = PPTExporter()
