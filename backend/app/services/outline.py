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

# [CTO Fix]: 优化 System Prompt，增加对 RAG 场景的豁免逻辑
OUTLINE_SYSTEM_PROMPT = """You are an expert Data-to-PPT Architect.

**TASK**: 
Analyze the user's input AND the provided [Knowledge Base Context] to structure a professional Slide Deck.

**CRITICAL RULES**:
1. **Language**: **Simplified Chinese (简体中文)** ONLY for slide content.
2. **Context Priority**: 
   - IF [Knowledge Base Context] is provided, YOU MUST USE IT to generate the outline. DO NOT REFUSE.
   - Treat the context as the "Raw Data".
3. **Format**: Output a RAW JSON Array.
4. **Visuals**: Generate an English `image_prompt` for every slide.

**JSON STRUCTURE (Array)**:
[
  {{
    "slide_type": "title",
    "title": "主标题",
    "subtitle": "副标题",
    "image_prompt": "abstract tech background, blue, 4k"
  }},
  {{
    "slide_type": "content",
    "title": "页面标题",
    "content": ["关键点 1", "关键点 2"],
    "image_prompt": "office meeting, professional"
  }}
]

**REFUSAL POLICY**:
- If NO context is provided AND input is casual chat (e.g., "Hello"), return: {{ "refusal": "..." }}
- **EXCEPTION**: If [Knowledge Base Context] IS PRESENT, NEVER REFUSE. Generate a summary PPT based on that context.
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
        
        # 1. RAG 检索逻辑
        context_str = ""
        # [CTO Optimization]: 如果用户指令太短（如"生成PPT"），可能会导致检索失效。
        # 策略：如果指令短且有文件，我们追加一个隐式查询 "Summary key points" 以提高检索质量
        search_query = user_input
        if len(user_input) < 10 and rag_file_ids:
            search_query = f"{user_input} summary key points main content"
            logger.info(f"Query Augmented for RAG: {search_query}")

        if rag_file_ids:
            logger.info(f"RAG Activated: Retrieving context for session {session_id}")
            context_str = rag_service.search_context(search_query, session_id)

        # 2. 构造最终输入
        final_input = f"{user_input} (Output JSON Array, Simplified Chinese)"
        
        if context_str:
            # [Critical Injection]: 强力注入上下文
            rag_prefix = f"""
            === [Knowledge Base Context] START ===
            {context_str}
            === [Knowledge Base Context] END ===
            
            Instruction: Based on the [Knowledge Base Context] above, generate a comprehensive PPT outline about the content.
            """
            final_input = rag_prefix + final_input
            logger.info("Context successfully injected into prompt.")
        
        # ... (rest is same)
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