"""
Service - Optimized for DeepSeek (Anti-Repetition)
"""
import logging
import json
from typing import AsyncGenerator, Dict, Any, List

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError as e:
    raise ImportError(f"Missing dependencies: {e}") from e

from app.core.config import settings

logger = logging.getLogger(__name__)

CONTENT_SYSTEM_PROMPT = """[System Instruction]
You are a content editor. Update the slides JSON.

RULES:
1. NO REPETITION. Check for stuttering (e.g. 'titletitle').
2. Output JSON ONLY.
3. Fill all empty content fields with professional text.
"""

class ContentGeneratorV1:
    def __init__(self):
        self.api_key = settings.deepseek_api_key
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY not set in configuration.")

        # Parameters tuned specifically to prevent "stuttering" (e.g., "mainmain")
        self.llm = ChatOpenAI(
            model="deepseek-chat", 
            temperature=0.4,          # Slightly higher temp to avoid loops
            frequency_penalty=0.8,    # High penalty for repetition (Crucial fix)
            presence_penalty=0.1,
            api_key=self.api_key,
            base_url="https://api.deepseek.com",
            max_retries=2
        )

        self.prompt = ChatPromptTemplate.from_messages([
            ("system", CONTENT_SYSTEM_PROMPT),
            ("system", "Context JSON: {current_slides_json}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        self.chain = self.prompt | self.llm

        self.chain_with_history = RunnableWithMessageHistory(
            self.chain,
            self._get_session_history,
            input_messages_key="input",
            history_messages_key="history",
        )

    def _get_session_history(self, session_id: str):
        return RedisChatMessageHistory(session_id=session_id, url=settings.redis_url, ttl=3600)

    async def generate_content_stream(self, session_id: str, user_input: str, current_slides: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
        logger.info(f"Stream started for content. Session: {session_id}, slides count: {len(current_slides)}")
        try:
            slides_str = json.dumps(current_slides, ensure_ascii=False)
            
            async for chunk in self.chain_with_history.astream(
                {
                    "input": user_input,
                    "current_slides_json": slides_str
                },
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Stream Error in content generation: {e}", exc_info=True)
            yield json.dumps({"error": str(e)})

def create_content_generator():
    return ContentGeneratorV1()
