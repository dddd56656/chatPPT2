"""
Content Generation Service (content.py) - [V3 Streaming + Memory]

CTO Notes:
[V3 Fix]: Replaced `ChatDeepSeek` with `ChatOpenAI` (OpenAI-compatible mode).
[V3 Fix 2]: Ensured system prompts are LangChain compatible.
[V3 Fix 3]: Corrected base_url string format.
"""

import os
import logging
import json
from typing import AsyncGenerator, Dict, Any, List

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError as e:
    raise ImportError(
        f"Missing dependencies: {e}. Run 'pip install -r backend/requirements.txt'"
    ) from e

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- System Prompts ---
CONTENT_SYSTEM_PROMPT = """[System Instruction]
You are a PPT content editing expert.
Task: Generate or modify the JSON content for slides based on user requests and the current slide structure.

You will receive:
1. `current_slides_json`: The current data of the slides.
2. The user's specific modification instruction.

Requirements:
1. Return the **complete** modified list of slides in JSON format.
2. Do NOT include Markdown formatting.
3. You must generate real, descriptive text content. Do not leave fields empty.
"""

class ContentGeneratorV1:
    """
    Content Generator Service (V3 Streaming)
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

        # Prompt includes history and current_slides_json context
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", CONTENT_SYSTEM_PROMPT),
            # Inject current slides as system context context
            ("system", "Current Slides JSON Data:\n{current_slides_json}"),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{input}"),
        ])

        self.chain = self.prompt | self.llm

        # Chain with Memory
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

    async def generate_content_stream(
        self, 
        session_id: str, 
        user_input: str, 
        current_slides: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """
        [V3 Core] Stream content generation
        """
        logger.info(f"V3 Stream: Starting content generation, Session: {session_id}")
        
        try:
            # Serialize slides to string for the prompt
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
            logger.error(f"V3 Stream Content Error: {e}")
            yield f"\n\n[ERROR] {str(e)}"
