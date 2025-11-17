"""
内容生成服务 (content.py) - V1 架构

CTO注：此文件代表 "V1 架构" (Python 编排，LLM 逐页生成)。
这是正确的 *粒度*，它只负责生成 *内容数据*，
而不负责大纲或导出。

`app/worker/tasks.py` 中的 `generate_content_task` (Node 2)
*应该* 调用此文件中的 `generate_ppt_data_v1`。
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
# (这些是此服务内部使用的模型)

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
SYSTEM_PROMPT_BASE = """[系统指令]
你是一名PPT内容专家。你的唯一目标是生成客观、数据驱动的文本内容。所有信息必须严格基于你能够查阅到的最新、可验证的资料。
绝对禁止加入任何主观意见、情感表达或推测性内容。
注意：你只需要生成文本内容。
你必须严格按照 Pydantic JSON 格式输出。
"""

# --- 3. 内容生成器服务 (V1 架构) ---

class ContentGeneratorV1:
    # [V2 新增] 对话式内容修改的系统指令
    CONVERSATIONAL_CONTENT_SYSTEM_PROMPT = """[系统指令]
你是PPT内容编辑专家。你的任务是根据用户的修改请求，更新一个已存在的PPT幻灯片数据（JSON格式）。
你将收到：
1. `current_slides_json`: 当前所有幻灯片的完整JSON。
2. `history`: 包含用户最新修改请求的对话历史。

你的唯一目标是：
1. 理解用户的修改请求（例如 "把第二张幻灯片的标题改成..." 或 "为第三张幻灯片增加一个要点..."）。
2. 将修改应用到 `current_slides_json`。
3. 严格按照 `SlideDeckModel` Pydantic 格式，返回 *修改后* 的 *完整* 幻灯片 JSON 列表。
"""
    """
    内容生成服务 (V1 架构)。
    Python 负责编排大纲 (Oulline)，LLM 负责逐页填充内容。
    """

    # [V2 新增] 对话式内容生成链
    self.conversational_content_chain = None
    def __init__(self, template_engine: TemplateEngine):
        """
        初始化内容生成器。
        
        [CTO注 - 架构缺陷]: Content (内容) 服务
        不应该依赖 TemplateEngine (设计) 服务。
        这是一个循环依赖/关注点分离问题。
        在 V2 中，`template_engine` 参数应被移除。
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
            # 1. 标题页生成链
            self.title_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", SYSTEM_PROMPT_BASE),
                    ("user", "为主题 '{topic}' 生成封面页的标题和副标题文本内容。"),
                ]
            ) | self.llm.with_structured_output(TitleSlideModel)
            # 2. 双栏页生成链
            self.two_column_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", SYSTEM_PROMPT_BASE),
                    (
                        "user",
                        "为演示文稿 '{main_topic}'，生成关于子主题 '{sub_topic}' 的双栏详细文本内容。将 '{topic1}' 相关答案内容放在左栏，'{topic2}' 相关答案内容放在右栏。要求不能左栏和右栏不应当是标题类的内容，应该是大纲的简单答案",
                    ),
                ]
            ) | self.llm.with_structured_output(TwoColumnSlideModel)
            # 3. 总结页生成链
            self.content_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", SYSTEM_PROMPT_BASE),
                    ("user", "为演示文稿 '{main_topic}' 生成总结和展望的文本内容。"),
                ]
            ) | self.llm.with_structured_output(ContentSlideModel)
            # [V2 新增] 4. 对话式内容生成链
            self.conversational_content_chain = ChatPromptTemplate.from_messages([
                ("system", self.CONVERSATIONAL_CONTENT_SYSTEM_PROMPT),
                ("user", "当前幻灯片JSON如下：
{current_slides_json}

对话历史如下：
{history}

请根据最新请求，返回完整的、修改后的幻灯片JSON。")
            ]) | self.llm.with_structured_output(SlideDeckModel)
        except Exception as e:
            logger.error(f"初始化LangChain失败: {e}")
            raise

    def generate_ppt_data_v1(
        self, main_topic: str, outline: List[Dict[str, str]], summary_topic: str
    ) -> List[Dict[str, Any]]:
        """
        [V1 架构核心] 步骤 1: 根据大纲，循环调用 LLM 生成幻灯片数据。
        
        CTO注：这是工作流 Node 2 调用的 *正确* 函数。
        它只返回数据，不执行IO。
        """
        slides_data = []
        logger.info(
            f"V1 架构：开始为 '{main_topic}' 生成 {len(outline) + 2} 张幻灯片..."
        )
        logger.debug(f"大纲内容: {outline}")
        logger.debug(f"总结主题: {summary_topic}")

        try:
            # 1. 生成标题页
            logger.info("  正在生成 [Title Slide]...")
            title_input = {"topic": main_topic}
            title_model = self.title_chain.invoke(title_input)
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
                try:
                    two_col_input = {
                        "main_topic": main_topic,
                        "sub_topic": item["sub_topic"],
                        "topic1": item["topic1"],
                        "topic2": item["topic2"],
                    }
                    two_col_model = self.two_column_chain.invoke(two_col_input)
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
            content_input = {"main_topic": main_topic, "summary_topic": summary_topic}
            content_model = self.content_chain.invoke(content_input)
            slides_data.append(
                {
                    "slide_type": "content",
                    "title": content_model.title,
                    "content": content_model.content,
                }
            )

            logger.info(f"V1 架构：内容生成完毕，共 {len(slides_data)} 张幻灯片。")
            logger.debug(f"最终幻灯片数据: {slides_data}")
            return slides_data

            # [V2 新增] 4. 对话式内容生成链
            self.conversational_content_chain = ChatPromptTemplate.from_messages([
                ("system", self.CONVERSATIONAL_CONTENT_SYSTEM_PROMPT),
                ("user", "当前幻灯片JSON如下：
{current_slides_json}

对话历史如下：
{history}

请根据最新请求，返回完整的、修改后的幻灯片JSON。")
            ]) | self.llm.with_structured_output(SlideDeckModel)
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
        
        [CTO注 - 架构缺陷]: 此方法不应存在于 ContentGenerator 中。
        它属于设计层 (Design/Export) 的职责。
        `outline.py` 中的 `generate_complete_ppt` 错误地调用了它。
        在V2工作流中，此方法被 `tasks.export_ppt_task` 取代。
        """
        logger.warning("正在调用已弃用的 (单体) `create_ppt_file` 服务")
        return self.template_engine.create_from_template(
            title=output_title, slides_data=slides_data
        )

    def generate_content_conversational(self, history: List[Dict[str, str]], current_slides: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        [V2 新增] 基于对话历史修改或生成内容。
        """
        logger.info("V2: 开始对话式内容生成...")
        
        try:
            # 1. 转换历史格式
            langchain_history = []
            for msg in history:
                if msg.get("role") != "system":
                    langchain_history.append((msg.get("role"), msg.get("content")))
            
            # 2. 将当前幻灯片列表转为JSON字符串
            current_slides_json = str(current_slides) # 简单转为字符串
            
            # 3. 调用新的V2内容链
            response_model = self.conversational_content_chain.invoke({
                "history": langchain_history,
                "current_slides_json": current_slides_json
            })
            
            # 4. 返回 Pydantic 模型中的幻灯片列表 (转换为 dict)
            slides_data = [slide.model_dump() for slide in response_model.slides]
            logger.info(f"V2: 对话式内容生成完成，共 {len(slides_data)} 张幻灯片。")
            return slides_data
            
        except Exception as e:
            logger.error(f"V2: 对话式内容生成失败: {e}")
            # 在失败时返回 *原始* 幻灯片，防止数据丢失
            return current_slides

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

from pydantic import conlist

# [V2 新增] 用于包装幻灯片列表的 Pydantic 模型，确保 LLM 输出格式
class SlideDataModel(BaseModel):
    """定义单个幻灯片的灵活结构"""
    slide_type: str = Field(..., description="幻灯片类型 (title, content, two_column)")
    title: str = Field(..., description="幻灯片标题")
    subtitle: Optional[str] = Field(None, description="副标题 (仅用于 title)")
    content: Optional[List[str]] = Field(None, description="内容 (仅用于 content)")
    left_content: Optional[List[str]] = Field(None, description="左栏内容 (仅用于 two_column)")
    right_content: Optional[List[str]] = Field(None, description="右栏内容 (仅用于 two_column)")

class SlideDeckModel(BaseModel):
    """[V2 新增] LLM 必须返回一个包含所有幻灯片的列表"""
    slides: List[SlideDataModel] = Field(..., description="演示文稿中所有幻灯片的完整列表")

