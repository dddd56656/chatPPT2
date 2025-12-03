import logging
import json
import sys
from typing import AsyncGenerator
from app.core.config import settings

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError:
    pass

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

# [CTO Fix]: 
# 1. 强制要求 "Simplified Chinese" (简体中文)
# 2. 使用 {{ }} 转义 JSON 示例，防止 LangChain 报错
OUTLINE_SYSTEM_PROMPT = """You are a professional presentation architect.
Please generate a structured PPT outline based on the user's request.

RULES:
1. **Language**: Output MUST be in **Simplified Chinese (简体中文)**.
2. **Format**: Output RAW JSON only. No markdown formatting.
3. **Structure**:
{{
  "main_topic": "PPT主标题",
  "outline": [
    {{
      "sub_topic": "页面标题",
      "topic1": "要点1",
      "topic2": "要点2"
    }}
  ],
  "summary_topic": "总结页标题"
}}
"""

class OutlineGenerator:
    def __init__(self):
        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is not set.")

        self.llm = ChatOpenAI(
            model="deepseek-chat",
            temperature=0.3, # 稍微提高温度以获得更好的中文文案
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
            streaming=True,
            model_kwargs={"response_format": {"type": "json_object"}}
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
        logger.info(f"[Outline Start] Session: {session_id} Input: {user_input}")
        try:
            # 再次强调 JSON 和中文
            final_input = f"{user_input} (请输出 JSON，使用简体中文)"
            
            async for chunk in self.chain.astream(
                {"input": final_input},
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"[Outline Error]: {e}", exc_info=True)
            yield json.dumps({"error": str(e)})

def create_outline_generator():
    return OutlineGenerator()
