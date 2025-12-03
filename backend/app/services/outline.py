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

# [CTO Fix]: 纯净版 Prompt，无 Emoji，确保 Windows 兼容
OUTLINE_SYSTEM_PROMPT = """You are an expert Data-to-PPT Architect.

**TASK**: 
Analyze the user's input (Text Data, Report Summary, or Topic) and structure it into a professional Slide Deck.

**CRITICAL RULES**:
1. **Language**: **Simplified Chinese (简体中文)** ONLY for slide content.
2. **Action**: 
   - If input is raw data -> Extract key insights and fill `content`.
   - If input is a topic -> Generate a logical outline.
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
  }},
  {{
    "slide_type": "two_column",
    "title": "对比/分析",
    "left_topic": "现状",
    "left_content": ["..."], 
    "right_topic": "未来",
    "right_content": ["..."],
    "image_prompt": "growth chart illustration"
  }}
]

**REFUSAL**:
If input is casual chat or unrelated, return:
{{ "refusal": "[提示] 您好！请直接发送您需要展示的【数据文本】、【报告摘要】或【制作要求】，我来为您生成 PPT。" }}
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

    async def generate_outline_stream(self, session_id: str, user_input: str) -> AsyncGenerator[str, None]:
        logger.info(f"[Gen Start] Session: {session_id}")
        try:
            final_input = f"{user_input} (Output JSON Array, Simplified Chinese)"
            
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
