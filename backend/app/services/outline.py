"""
大纲生成服务 (outline.py) - [V3 流式 + 记忆版]

CTO 注释:
[V3 重构]：
1. 引入 `RunnableWithMessageHistory` 实现自动记忆。
2. 新增 `generate_outline_stream` 方法，返回异步生成器 (AsyncGenerator)。
"""

import os
import logging
import json
from typing import AsyncGenerator
from langchain_deepseek import ChatDeepSeek
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import PydanticOutputParser
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings

# --- 日志配置 ---
logger = logging.getLogger(__name__)

# --- 1. Pydantic 模型 ---
class OutlineModel(BaseModel):
    """Pydantic模型：用于大纲生成"""
    main_topic: str = Field(..., description="演示文稿主主题")
    outline: list[dict] = Field(..., description="大纲结构列表 [{'topic': '...'}, ...]")
    summary_topic: str = Field(..., description="总结幻灯片主题")


# --- 2. 系统指令 ---
OUTLINE_SYSTEM_PROMPT = """[系统指令]
你是一名PPT结构设计专家。
请根据用户的需求生成或修改合理的PPT大纲结构。
你必须严格按照 JSON 格式输出，不要包含任何 Markdown 格式（如 ```json）。
输出必须符合以下 Schema：
{
  "main_topic": "string",
  "outline": [{"sub_topic": "string", "topic1": "string", "topic2": "string"}],
  "summary_topic": "string"
}
"""

# --- 3. 大纲生成器服务 ---

class OutlineGenerator:
    """
    大纲生成服务 (V3 Streaming)
    """

    def __init__(self):
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY 未设置")

        # 1. 初始化 LLM
        self.llm = ChatDeepSeek(
            model="deepseek-chat", 
            temperature=0.1,  # 降低随机性以保证 JSON 格式
            api_key=self.api_key
        )

        # 2. 定义 Prompt，加入 History 占位符
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", OUTLINE_SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        # 3. 基础链 (Prompt -> LLM)
        # 注意：这里不使用 with_structured_output，因为我们需要流式传输原始 Token
        # JSON 解析将在前端完成，或者在流结束后在后端校验
        self.chain = self.prompt | self.llm

        # 4. 包装链 (增加 Redis 记忆能力)
        self.chain_with_history = RunnableWithMessageHistory(
            self.chain,
            self._get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )

    def _get_session_history(self, session_id: str):
        """获取 Redis 历史记录存储对象"""
        return RedisChatMessageHistory(
            session_id=session_id,
            url=settings.redis_url,
            ttl=3600  # 1小时过期
        )

    async def generate_outline_stream(self, session_id: str, user_input: str) -> AsyncGenerator[str, None]:
        """
        [V3 核心] 流式生成大纲
        Yields:
            str: SSE 数据块
        """
        logger.info(f"V3 Stream: 开始生成大纲, Session: {session_id}")
        
        try:
            # 调用 astream，自动处理历史记录的读取和保存
            async for chunk in self.chain_with_history.astream(
                {"input": user_input},
                config={"configurable": {"session_id": session_id}}
            ):
                # chunk.content 是生成的文本片段
                if chunk.content:
                    yield chunk.content

        except Exception as e:
            logger.error(f"V3 Stream Error: {e}")
            yield f"\n\n[ERROR] 生成失败: {str(e)}"

# --- 工厂函数 ---
def create_outline_generator() -> OutlineGenerator:
    return OutlineGenerator()
