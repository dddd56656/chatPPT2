"""
内容生成服务 (content.py) - V1 架构修复版

此模块采用 V1 架构（Python 编排，LLM 逐页生成），以解决 V2 架构的 Token 限制
和内容不可控风险。
"""

import os
import logging
import io
from typing import Dict, Any, List, Optional, Union
from dotenv import load_dotenv
from langchain_deepseek import ChatDeepSeek
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field, ValidationError
from langchain_core.exceptions import OutputParserException
from .design import TemplateEngine, PPTExporter

# --- 日志配置 ---
logger = logging.getLogger(__name__)

# --- 1. LangChain Pydantic Schemas (V1 架构) ---
# V1 架构下，我们为每种幻灯片类型定义专门的 Pydantic 输出模型


class TitleSlideModel(BaseModel):
    """Pydantic模型：用于 'title' 幻灯片"""

    title: str = Field(..., description="幻灯片主标题")
    subtitle: str = Field(..., description="幻灯片副标题")


class ContentSlideModel(BaseModel):
    """Pydantic模型：用于 'content' 幻灯片"""

    title: str = Field(..., description="幻灯片标题")
    content: List[str] = Field(..., description="内容要点列表")


class TwoColumnSlideModel(BaseModel):
    """Pydantic模型：用于 'two_column' 幻灯片"""

    title: str = Field(..., description="幻灯片标题")
    left_content: List[str] = Field(..., description="左栏内容要点列表")
    right_content: List[str] = Field(..., description="右栏内容要点列表")


# --- 2. 系统指令 (V1 架构) ---
# V1 架构的 Prompt 更简单，只关注当前任务，而不是整个演示文稿
SYSTEM_PROMPT_BASE = """[系统指令]
你是一名PPT内容专家。你的唯一目标是生成客观、数据驱动的文本。所有信息必须严格基于你能够查阅到的最新、可验证的资料。
绝对禁止加入任何主观意见、情感表达或推测性内容。
你必须严格按照 Pydantic JSON 格式输出。
"""

# --- 3. 内容生成器服务 (V1 架构) ---


class ContentGeneratorV1:
    """
    内容生成服务 (V1 架构)。

    Python 负责编排大纲 (Oulline)，LLM 负责逐页填充内容。
    """

    def __init__(self, template_engine: TemplateEngine):
        """
        初始化内容生成器。

        Args:
            template_engine (TemplateEngine): 已初始化的 TemplateEngine 实例 (依赖注入)。
        """
        self.template_engine = template_engine
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")

        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY 环境变量未设置。API调用将失败。")
            raise ValueError("DEEPSEEK_API_KEY 未设置")

        # 初始化 LangChain
        try:
            self.llm = ChatDeepSeek(
                model="deepseek-chat", temperature=0, api_key=self.api_key
            )

            # V1 架构：为每种幻灯片类型创建独立的 LLM 链

            # 1. 标题页生成链
            self.title_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", SYSTEM_PROMPT_BASE),
                    ("user", "为主题 '{topic}' 生成一张封面幻灯片（标题和副标题）。"),
                ]
            ) | self.llm.with_structured_output(TitleSlideModel)

            # 2. 双栏页生成链
            self.two_column_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", SYSTEM_PROMPT_BASE),
                    (
                        "user",
                        "为演示文稿 '{main_topic}'，生成一张关于子主题 '{sub_topic}' 的双栏幻灯片。将 '{topic1}' 放在左栏，'{topic2}' 放在右栏。",
                    ),
                ]
            ) | self.llm.with_structured_output(TwoColumnSlideModel)

            # 3. 总结页生成链
            self.content_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", SYSTEM_PROMPT_BASE),
                    ("user", "为演示文稿 '{main_topic}' 生成一张总结和展望幻灯片。"),
                ]
            ) | self.llm.with_structured_output(ContentSlideModel)

        except Exception as e:
            logger.error(f"初始化LangChain失败: {e}")
            raise

    def generate_ppt_data_v1(
        self, main_topic: str, outline: List[Dict[str, str]], summary_topic: str
    ) -> List[Dict[str, Any]]:
        """
        [V1 架构核心] 步骤 1: 根据大纲，循环调用 LLM 生成幻灯片数据。

        Args:
            main_topic (str): 演示文稿的主题。
            outline (List[Dict]): Python 定义的 PPT 大纲。
            summary_topic (str): 总结幻灯片的主题。

        Returns:
            List[Dict[str, Any]]: 格式化的数据。
        """
        slides_data = []
        logger.info(
            f"V1 架构：开始为 '{main_topic}' 生成 {len(outline) + 2} 张幻灯片..."
        )

        try:
            # 1. 生成标题页
            logger.info("  正在生成 [Title Slide]...")
            title_model = self.title_chain.invoke({"topic": main_topic})
            slides_data.append(
                {
                    "slide_type": "title",
                    "title": title_model.title,
                    "subtitle": title_model.subtitle,
                }
            )

            # 2. 循环生成双栏页
            for i, item in enumerate(outline):
                logger.info(
                    f"  正在生成 [Two Column Slide {i+1}/{len(outline)}]：{item['sub_topic']}..."
                )
                # [CTO Note - P2 修复]: 异常捕获粒度更细
                try:
                    two_col_model = self.two_column_chain.invoke(
                        {
                            "main_topic": main_topic,
                            "sub_topic": item["sub_topic"],
                            "topic1": item["topic1"],
                            "topic2": item["topic2"],
                        }
                    )
                    slides_data.append(
                        {
                            "slide_type": "two_column",
                            "title": two_col_model.title,
                            "left_content": two_col_model.left_content,
                            "right_content": two_col_model.right_content,
                        }
                    )
                except (ValidationError, OutputParserException) as e:
                    logger.error(f"  解析 {item['sub_topic']} 失败，跳过此幻灯片: {e}")
                except Exception as e:
                    logger.error(
                        f"  API 调用 {item['sub_topic']} 失败，跳过此幻灯片: {e}"
                    )

            # 3. 生成总结页
            logger.info("  正在生成 [Content Slide] (总结)...")
            content_model = self.content_chain.invoke(
                {"main_topic": main_topic, "summary_topic": summary_topic}
            )
            slides_data.append(
                {
                    "slide_type": "content",
                    "title": content_model.title,
                    "content": content_model.content,
                }
            )

            logger.info(f"V1 架构：内容生成完毕，共 {len(slides_data)} 张幻灯片。")
            return slides_data

        except Exception as e:
            # [CTO Note - P3 修复]: 仅在启动阶段失败时使用回退
            logger.error(f"V1 架构启动失败 (例如标题页生成失败): {e}")
            logger.warning("返回硬编码的回退数据。")
            return self.get_fallback_data(main_topic)

    def create_ppt_file(
        self, slides_data: List[Dict[str, Any]], output_title: str
    ) -> Dict[str, Any]:
        """
        步骤 2: 调用 TemplateEngine 生成 PPTX 文件。
        """
        logger.info(f"正在调用 TemplateEngine 生成 '{output_title}.pptx'...")
        return self.template_engine.create_from_template(
            title=output_title, slides_data=slides_data
        )

    def get_fallback_data(self, topic: str) -> List[Dict[str, Any]]:
        """[P3 修复] 提供动态标题的回退数据。"""
        return [
            {
                "slide_type": "title",
                "title": f"{topic} 分析报告 (回退数据)",
                "subtitle": "LLM API 调用失败",
            },
            {
                "slide_type": "content",
                "title": "错误",
                "content": [
                    "内容生成失败，请检查 API 密钥或网络连接。",
                    "这是一个回退数据示例。",
                ],
            },
        ]

