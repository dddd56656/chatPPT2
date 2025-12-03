"""
Outline Generation Service (outline.py) - [V3 Streaming + Memory]

CTO Notes:
[V3 Fix]: Replaced `ChatDeepSeek` with `ChatOpenAI` (OpenAI-compatible mode).
[V3 Fix 2]: Escaped curly braces in system prompts to prevent LangChain formatting errors.
[V3 Fix 3]: Corrected base_url string format.
"""

import os
import logging
from typing import AsyncGenerator

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError as e:
    raise ImportError(
        f"Missing dependencies: {e}. Run 'pip install -r backend/requirements.txt'"
    ) from e

from pydantic import BaseModel, Field
from app.core.config import settings

# --- Logging ---
logger = logging.getLogger(__name__)

# --- 1. Pydantic Models ---
class OutlineModel(BaseModel):
    """Pydantic model for outline generation"""
    main_topic: str = Field(..., description="Main topic of the presentation")
    outline: list[dict] = Field(..., description="List of outline structure")
    summary_topic: str = Field(..., description="Topic for the summary slide")


# --- 2. System Prompts (Fixed: Escaped Braces) ---
# CTO Fix: Double curly braces {{ }} are required for literal JSON in LangChain prompts
OUTLINE_SYSTEM_PROMPT = """[System Instruction]
You are a PPT structure design expert.
Generate or modify a reasonable PPT outline structure based on user requirements.
You must strictly output in pure JSON format. Do not include any Markdown formatting (like ```json).
The output must strictly follow this Schema:
{{
  "main_topic": "string",
  "outline": [{{"sub_topic": "string", "topic1": "string", "topic2": "string"}}],
  "summary_topic": "string"
}}
"""

# --- 3. Outline Generator Service ---

class OutlineGenerator:
    """
    Outline Generator Service (V3 Streaming)
    """

    def __init__(self):
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY is not set.")

        # Configure ChatOpenAI for DeepSeek
        self.llm = ChatOpenAI(
            model="deepseek-chat", 
            temperature=0.1,
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
        return RedisChatMessageHistory(
            session_id=session_id,
            url=settings.redis_url,
            ttl=3600
        )

    async def generate_outline_stream(self, session_id: str, user_input: str) -> AsyncGenerator[str, None]:
        """
        [V3 Core] Stream outline generation
        """
        logger.info(f"V3 Stream: Starting outline generation, Session: {session_id}")
        
        try:
            async for chunk in self.chain_with_history.astream(
                {"input": user_input},
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content

        except Exception as e:
            logger.error(f"V3 Stream Error: {e}")
            yield f"\n\n[ERROR] Generation failed: {str(e)}"

def create_outline_generator() -> OutlineGenerator:
    return OutlineGenerator()
