"""
Service - Optimized for DeepSeek (Anti-Repetition)
"""
import logging
import json
from typing import AsyncGenerator

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError as e:
    raise ImportError(f"Missing dependencies: {e}") from e

from app.core.config import settings

logger = logging.getLogger(__name__)

OUTLINE_SYSTEM_PROMPT = """[System Instruction]
You are a senior presentation architect.
Generate a structured PPT outline JSON.

RULES:
1. NO REPETITION. Do not repeat words like 'mainmain'.
2. Output JSON ONLY. No markdown blocks.
3. Be concise.

Schema:
{{
  "main_topic": "string",
  "outline": [{{"sub_topic": "string", "topic1": "string", "topic2": "string"}}],
  "summary_topic": "string"
}}"""

class OutlineGenerator:
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
            ("system", OUTLINE_SYSTEM_PROMPT),
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

    async def generate_outline_stream(self, session_id: str, user_input: str) -> AsyncGenerator[str, None]:
        logger.info(f"Stream started for outline. Session: {session_id}, input length: {len(user_input)}")
        try:
            async for chunk in self.chain_with_history.astream(
                {"input": user_input},
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"Stream Error in outline generation: {e}", exc_info=True)
            yield json.dumps({"error": str(e)})

def create_outline_generator():
    return OutlineGenerator()
