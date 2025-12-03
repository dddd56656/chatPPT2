"""
Service - Content Generator (Streaming First)
"""
import logging
import json
from typing import AsyncGenerator, List, Dict, Any
from app.core.config import settings

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError:
    pass

logger = logging.getLogger(__name__)

CONTENT_SYSTEM_PROMPT = """[System Instruction]
You are a content editor. Update the slides JSON based on user instructions.

RULES:
1. Output JSON ONLY. The output must be a valid JSON array of slides.
2. NO REPETITION. Do not stutter.
3. Keep existing structure, only update content fields if requested or empty.
"""

class ContentGeneratorV1:
    def __init__(self):
        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is not set.")

        self.llm = ChatOpenAI(
            model="deepseek-chat",
            temperature=0.3, # Lower temp for stability in JSON generation
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
            streaming=True
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", CONTENT_SYSTEM_PROMPT),
            ("system", "Current JSON Context: {current_slides_json}"),
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

    async def generate_content_stream(self, session_id: str, user_input: str, current_slides: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        """生成流式内容数据"""
        try:
            # 将当前幻灯片状态序列化为字符串，作为上下文
            slides_str = json.dumps(current_slides, ensure_ascii=False)
            
            async for chunk in self.chain.astream(
                {
                    "input": user_input,
                    "current_slides_json": slides_str
                },
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Content Stream Error: {e}")
            yield json.dumps({"error": str(e)})

def create_content_generator():
    return ContentGeneratorV1()
