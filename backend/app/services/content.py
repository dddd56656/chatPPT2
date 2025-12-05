import logging
import json
import sys
from typing import AsyncGenerator, List, Dict, Any
from app.core.config import settings
from app.services.rag import rag_service # [New] 导入 RAG 核心服务

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

    # [Modified] 接收 rag_file_ids
    async def generate_content_stream(self, session_id: str, user_input: str, current_slides: List[Dict[str, Any]], rag_file_ids: list = None) -> AsyncGenerator[str, None]:
        logger.info(f"[Refine Start] Session: {session_id}")
        
        # 1. RAG 检索逻辑
        context_str = ""
        if rag_file_ids and user_input:
            logger.info("RAG Activated: Retrieving context for content refinement.")
            # 调用 RAG Service 进行语义检索
            context_str = rag_service.search_context(user_input, session_id)

        # 2. 构造最终输入，注入上下文
        slides_str = json.dumps(current_slides, ensure_ascii=False)
        final_input = f"{user_input} (Return FULL JSON, Chinese)"
        
        if context_str:
            # [Critical Injection]: 将检索到的上下文置于用户输入之前
            rag_prefix = f"""
            --- 知识库参考内容 START ---
            请严格参考以下知识库内容来精修幻灯片内容，如果上下文内容与用户指令相关，则将其作为精修的基础:
            {context_str}
            --- 知识库参考内容 END ---
            """
            final_input = rag_prefix + final_input
            logger.info("Context successfully injected into refinement prompt.")

        try:
            # 3. 调用链
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