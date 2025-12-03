"""
Service - Outline Generator (Streaming First)
"""
import logging
import json
from typing import AsyncGenerator
from app.core.config import settings

# 延迟导入以避免某些环境下的依赖报错
try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError:
    pass

logger = logging.getLogger(__name__)

OUTLINE_SYSTEM_PROMPT = """[System Instruction]
You are a senior presentation architect.
Generate a structured PPT outline JSON based on the user's topic.

RULES:
1. Output JSON ONLY. No markdown, no explanations.
2. Structure: { "main_topic": "...", "outline": [ {"sub_topic": "...", "topic1": "...", "topic2": "..."} ], "summary_topic": "..." }
3. Be professional and concise.
"""

class OutlineGenerator:
    def __init__(self):
        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is not set.")

        self.llm = ChatOpenAI(
            model="deepseek-chat",
            temperature=0.5,
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
            streaming=True  # 显式开启流式
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", OUTLINE_SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        self.chain = RunnableWithMessageHistory(
            prompt | self.llm,
            self._get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )

    def _get_session_history(self, session_id: str):
        return RedisChatMessageHistory(
            session_id=session_id, 
            url=settings.redis_url, 
            ttl=3600
        )

    async def generate_outline_stream(self, session_id: str, user_input: str) -> AsyncGenerator[str, None]:
        """生成流式大纲数据"""
        try:
            async for chunk in self.chain.astream(
                {"input": user_input},
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Outline Stream Error: {e}")
            yield json.dumps({"error": str(e)})

def create_outline_generator():
    return OutlineGenerator()
