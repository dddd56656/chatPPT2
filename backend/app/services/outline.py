"""
大纲生成服务 (outline.py) - [V2 专注模式]

CTO 注释:
[V2 重构]：已移除 V1 (Batch) 模式的 `generate_outline` 方法。
此模块现在 *只* 负责 V2 (Conversational) 模式。
"""

import os
import logging
from typing import Dict, Any, List, Optional
from langchain_deepseek import ChatDeepSeek
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_core.exceptions import OutputParserException

# --- 日志配置 ---
logger = logging.getLogger(__name__)

# --- 1. 大纲生成 Pydantic Schema ---
class OutlineModel(BaseModel):
    """Pydantic模型：用于大纲生成"""

    main_topic: str = Field(..., description="演示文稿主主题")
    outline: List[Dict[str, str]] = Field(..., description="大纲结构列表")
    summary_topic: str = Field(..., description="总结幻灯片主题")


# --- 2. 系统指令 ---
# V2 模式的指令 (支持对话)
OUTLINE_CONVERSATIONAL_PROMPT = """[系统指令]
你是一名PPT结构设计专家。
- 如果用户是第一次发言 (历史记录中只有一条 'user' 消息)，请根据用户需求生成合理的PPT大纲结构，并严格按照 Pydantic JSON 格式输出。
- 如果用户的历史记录中包含一个AI生成的JSON大纲和用户的修改意见 (例如：'请修改第二点')，请根据用户的修改意见更新大纲，并再次严格按照 Pydantic JSON 格式输出。
- 你的回复必须是纯粹的Pydantic JSON格式，绝对不能包含任何解释性文字或道歉。"""

# --- 3. 大纲生成器服务 ---

class OutlineGenerator:
    """
    大纲生成服务，仅支持 V2 (Conversational) 模式。
    """

    def __init__(self):
        """初始化大纲生成器"""
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")

        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY 环境变量未设置。API调用将失败。")
            raise ValueError("DEEPSEEK_API_KEY 未设置")

        # 初始化 LangChain
        try:
            self.llm = ChatDeepSeek(
                model="deepseek-chat", temperature=0, api_key=self.api_key
            )
            
            # [V2 链]: 用于 `generate_outline_conversational`
            self.conversational_chain = ChatPromptTemplate.from_messages(
                [
                    ("system", OUTLINE_CONVERSATIONAL_PROMPT),
                    ("placeholder", "{history}"),
                ]
            ) | self.llm.with_structured_output(OutlineModel)
        except Exception as e:
            logger.error(f"初始化 OutlineGenerator (LangChain) 失败: {e}")
            raise

    def generate_outline_conversational(
        self, history: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        [V2 核心] 根据完整的聊天历史生成或修改大纲
        (由 tasks.generate_outline_conversational_task 调用)
        """
        logger.info(f"V2: 开始对话式大纲生成，历史消息数：{len(history)}")
        try:
            # 1. 转换 history 格式
            langchain_history = []
            for msg in history:
                if msg.get("role") != "system":
                    langchain_history.append((msg.get("role"), msg.get("content")))

            # 2. 调用新的V2对话链
            outline_model = self.conversational_chain.invoke(
                {"history": langchain_history}
            )
            logger.info(f"V2: 对话式大纲生成/修改成功：主主题 '{outline_model.main_topic}'")

            # 3. 返回数据结构
            return {
                "main_topic": outline_model.main_topic,
                "outline": outline_model.outline,
                "summary_topic": outline_model.summary_topic,
                "status": "success",
            }
        except Exception as e:
            logger.error(f"V2: 对话式大纲生成/修改失败: {e}")
            return {
                "status": "error",
                "error": str(e),
            }

# --- 4. 服务工厂函数 ---
def create_outline_generator() -> OutlineGenerator:
    """创建大纲生成器实例的工厂函数"""
    return OutlineGenerator()
