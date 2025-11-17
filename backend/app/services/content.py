"""
内容生成服务 (content.py) - [V2 专注模式]

CTO 注释:
[V2 重构]：已移除 V1 (Batch) 模式的 `generate_ppt_data_v1` 方法。
[V2 修复]：`__init__` 不再依赖 `template_engine`，解除了循环依赖。
此模块现在 *只* 负责 V2 (Conversational) 模式。
"""

import os
import logging
from typing import Dict, Any, List, Optional
from langchain_deepseek import ChatDeepSeek
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

# --- 日志配置 ---
logger = logging.getLogger(__name__)

# --- 2. V2 Pydantic Schemas (整体) ---
class SlideDataModel(BaseModel):
    """[V2] 定义单个幻灯片的灵活结构"""
    slide_type: str = Field(..., description="幻灯片类型 (title, content, two_column)")
    title: str = Field(..., description="幻灯片标题")
    subtitle: Optional[str] = Field(None, description="副标题 (仅用于 title)")
    content: Optional[List[str]] = Field(None, description="内容 (仅用于 content)")
    left_content: Optional[List[str]] = Field(
        None, description="左栏内容 (仅用于 two_column)"
    )
    right_content: Optional[List[str]] = Field(
        None, description="右栏内容 (仅用于 two_column)"
    )
    # [CTO V3] 在 Pydantic 模型中允许存在 topic 字段 (允许前端传入)
    left_topic: Optional[str] = Field(None, description="用于生成的左栏主题")
    right_topic: Optional[str] = Field(None, description="用于生成的右栏主题")


class SlideDeckModel(BaseModel):
    """[V2] LLM 必须返回一个包含所有幻灯片的列表"""

    slides: List[SlideDataModel] = Field(
        ..., description="演示文稿中所有幻灯片的完整列表"
    )


# --- V2 系统指令 ---
CONVERSATIONAL_CONTENT_SYSTEM_PROMPT = """[系统指令]
你是PPT内容与结构编辑专家。你的任务是根据用户的请求，生成或修改一个PPT幻灯片数据（JSON格式）。

你将收到：
1. `current_slides_json`: 当前所有幻灯片的完整JSON。
2. `history`: 包含用户最新请求的对话历史。

你的目标是执行以下两种操作之一：

[操作 1: 内容生成 (填充)]
- **触发条件**: 当用户的最新请求是通用的生成指令时 (例如："开始生成", "填充内容", "生成", "ok", "go")。
- **你的任务**:
    1.  遍历 `current_slides_json` 中的每一张幻灯片。
    2.  **对于 `title` 幻灯片**: 保持原样。
    3.  **对于 `content` 幻灯片**: 如果 `content` 字段为空 (例如 `[]`) 或是默认的 `["谢谢观看"]`，则根据 `title` 字段为其生成 3-5 个详细的要点 (bullet points)。
    4.  **对于 `two_column` 幻灯片**,自动生成最合适的幻灯片的文本的数量，要求尽可能详细，并起到答疑解惑的作用:
        a.  检查是否存在 `left_topic` 和 `right_topic` 字段。
        b.  如果 `left_content` 字段为空 (`[]`)，你 *必须* 根据 `left_topic` 字段 (例如: "美国汉堡") 生成 3-5 个详细要点，并填充到 `left_content` 数组中。
        c.  如果 `right_content` 字段为空 (`[]`)，你 *必须* 根据 `right_topic` 字段 (例如: "美国热狗") 生成 3-5 个详细要点，并填充到 `right_content` 数组中。
        d.  生成内容后，你 *可以* 在返回的 JSON 中移除 `left_topic` 和 `right_topic` 字段。
    5.  **不要**返回 `null`。必须生成真实的文本内容。
    6.  返回 *填充内容后* 的 *完整* 幻灯片 JSON 列表。

[操作 2: 内容修改 (编辑)]
- **触发条件**: 当用户的最新请求是 *具体* 的修改指令时 (例如："把第二张幻灯片的标题改成...", "为第三张幻灯片增加一个要点...")。
- **你的任务**:
    1.  理解用户的 *具体* 修改请求。
    2.  将该修改应用到 `current_slides_json`。
    3.  返回 *修改后* 的 *完整* 幻灯片 JSON 列表。

你必须严格按照 `SlideDeckModel` Pydantic 格式输出。
"""

# --- 内容生成器服务 (V2 专注) ---


class ContentGeneratorV1:
    """
    内容生成服务 (V2 专注模式)
    """

    def __init__(self):
        """
        初始化内容生成器。
        [V2 修复] 移除了对 TemplateEngine 的依赖。
        """
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")

        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY 环境变量未设置。API调用将失败。")
            raise ValueError("DEEPSEEK_API_KEY 未设置")

        try:
            self.llm = ChatDeepSeek(
                model="deepseek-chat", temperature=0, api_key=self.api_key
            )

            # --- V2 链 (整体) ---
            self.conversational_content_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", CONVERSATIONAL_CONTENT_SYSTEM_PROMPT),
                    (
                        "user",
                        "当前幻灯片JSON如下：\n{current_slides_json}\n\n对话历史如下：\n{history}\n\n请根据最新请求，返回完整的、修改后的幻灯片JSON。",
                    ),
                ]
            ) | self.llm.with_structured_output(SlideDeckModel)

        except Exception as e:
            logger.error(f"初始化 ContentGenerator (LangChain) 失败: {e}")
            raise

    def generate_content_conversational(
        self, history: List[Dict[str, str]], current_slides: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        [V2 核心] 基于对话历史修改或生成内容。
        (由 tasks.generate_content_conversational_task 调用)
        """
        logger.info("V2: 开始对话式内容生成...")
        try:
            langchain_history = []
            for msg in history:
                if msg.get("role") != "system":
                    langchain_history.append((msg.get("role"), msg.get("content")))

            current_slides_json = str(current_slides)

            # 调用 V2 链
            response_model = self.conversational_content_chain.invoke(
                {
                    "history": langchain_history,
                    "current_slides_json": current_slides_json,
                }
            )

            slides_data = [slide.model_dump() for slide in response_model.slides]
            logger.info(f"V2: 对话式内容生成完成，共 {len(slides_data)} 张幻灯片。")
            return slides_data

        except Exception as e:
            logger.error(f"V2: 对话式内容生成失败: {e}")
            # 在失败时返回 *原始* 幻灯片，防止数据丢失
            return current_slides
