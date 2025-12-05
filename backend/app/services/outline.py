import logging
import json
import sys
from typing import AsyncGenerator
from app.core.config import settings
from app.services.rag import rag_service

try:
    from langchain_openai import ChatOpenAI
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_community.chat_message_histories import RedisChatMessageHistory
    from langchain_core.runnables.history import RunnableWithMessageHistory
except ImportError:
    pass

logging.basicConfig(stream=sys.stdout, level=logging.INFO)
logger = logging.getLogger(__name__)

# [CTO Standard] Prompt: Explicit, Clean, Robust
OUTLINE_SYSTEM_PROMPT = """You are an expert Data-to-PPT Architect.

**TASK**: 
Analyze the user's input. 
- If [Knowledge Base Context] is provided, YOU MUST use it as the primary source.
- If NO context is provided, generate content based on your own knowledge.

**CRITICAL RULES**:
1. **Language**: **Simplified Chinese** ONLY for slide content.
2. **Format**: Output a RAW JSON Array.
3. **Visuals**: Generate an English `image_prompt` for every slide.

**JSON STRUCTURE (Array)**:
[
  {
    "slide_type": "title",
    "title": "Main Title",
    "subtitle": "Subtitle",
    "image_prompt": "abstract tech background"
  },
  {
    "slide_type": "content",
    "title": "Slide Title",
    "content": ["Point 1", "Point 2"],
    "image_prompt": "office meeting"
  }
]

**REFUSAL POLICY**:
- If input is empty or just "Hello", return: { "refusal": "Please provide a topic." }
- Otherwise, ALWAYS generate the JSON structure.
"""

class OutlineGenerator:
    def __init__(self):
        if not settings.deepseek_api_key:
            raise ValueError("DEEPSEEK_API_KEY is not set.")

        self.llm = ChatOpenAI(
            model="deepseek-chat",
            temperature=0.1, 
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

    async def generate_outline_stream(self, session_id: str, user_input: str, rag_file_ids: list = None) -> AsyncGenerator[str, None]:
        logger.info(f"[Gen Start] Session: {session_id}")
        
        context_str = ""
        
        # --- Logic Branch 1: RAG Mode ---
        if rag_file_ids:
            logger.info(f"RAG Active: {len(rag_file_ids)} files selected.")
            
            # Smart Query: If input is too short, augment it to ensure retrieval
            search_query = user_input
            if len(user_input) < 10: 
                search_query = "Summary key points main content"
            
            # 1. Try Semantic Search
            context_str = rag_service.search_context(search_query, session_id)
            
            # 2. Fallback: Direct File Fetch if search fails
            if not context_str:
                logger.warning("Semantic search empty. Fallback to file preview.")
                context_str = rag_service.fetch_file_preview(rag_file_ids)

        # --- Logic Branch 2: Construct Final Prompt ---
        if context_str:
            # Case A: With Context (RAG)
            final_input = f"""
            === [Knowledge Base Context] START ===
            {context_str}
            === [Knowledge Base Context] END ===
            
            User Request: {user_input}
            Instruction: Generate a PPT outline based on the [Knowledge Base Context] above. Use Simplified Chinese.
            """
            logger.info("Mode: RAG Generation")
        else:
            # Case B: Direct Generation (LLM Native Knowledge)
            final_input = f"""
            User Request: {user_input}
            Instruction: Generate a professional PPT outline based on this topic. Use Simplified Chinese. Output JSON Array.
            """
            logger.info("Mode: Direct Generation")
        
        try:
            async for chunk in self.chain.astream(
                {"input": final_input},
                config={"configurable": {"session_id": session_id}}
            ):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"[Gen Error]: {e}", exc_info=True)
            yield json.dumps({"error": str(e)})

def create_outline_generator():
    return OutlineGenerator()
