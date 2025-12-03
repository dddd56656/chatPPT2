import logging
import json
import sys
from typing import AsyncGenerator, List, Dict, Any
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

CONTENT_SYSTEM_PROMPT = """You are a PPT Editor. 
Your job is to **MODIFY** or **REFINE** the current slides based on user instructions.

**RULES**:
1. **Language**: **Simplified Chinese (简体中文)**.
2. **Action**: Return the **FULL updated JSON** array.
3. **Images**: Maintain or update `image_prompt` (English) if content changes significantly.
4. Keep the structure valid.
"""

class ContentGeneratorV1:
    def __init__(self):
        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is not set.")

        self.llm = ChatOpenAI(
            model="deepseek-chat",
            temperature=0.2,
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
            streaming=True,
            model_kwargs={"response_format": {"type": "json_object"}}
        )

        prompt = ChatPromptTemplate.from_messages([
            ("system", CONTENT_SYSTEM_PROMPT),
            ("system", "Current Slides JSON: {current_slides_json}"),
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
        logger.info(f"[Refine Start] Session: {session_id}")
        try:
            slides_str = json.dumps(current_slides, ensure_ascii=False)
            final_input = f"{user_input} (Return FULL JSON, Chinese)"
            
            async for chunk in self.chain.astream(
                {
                    "input": final_input,
                    "current_slides_json": slides_str
                },
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"[Refine Error]: {e}", exc_info=True)
            yield json.dumps({"error": str(e)})

def create_content_generator():
    return ContentGeneratorV1()
