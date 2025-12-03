"""
内容生成服务 (content.py) - [V3 流式 + 记忆版]

CTO 注释:
[V3 重构]：
1. 使用 RunnableWithMessageHistory。
2. 实现了 `generate_content_stream`。
"""

import os
import logging
from typing import AsyncGenerator, Dict, Any, List
from langchain_deepseek import ChatDeepSeek
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_community.chat_message_histories import RedisChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

from app.core.config import settings

logger = logging.getLogger(__name__)

# --- 系统指令 ---
CONTENT_SYSTEM_PROMPT = """[系统指令]
你是PPT内容编辑专家。
任务：根据用户请求和当前幻灯片结构，生成或修改幻灯片内容的 JSON。

你将收到：
1. `current_slides_json`: 当前幻灯片数据。
2. 用户的具体修改指令。

要求：
1. 返回修改后的**完整**幻灯片列表 JSON。
2. 严禁包含 Markdown 格式标记。
3. 必须生成真实的文本内容，不要留空。
"""

class ContentGeneratorV1:
    """
    内容生成服务 (V3 Streaming)
    """

    def __init__(self):
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY 未设置")

        self.llm = ChatDeepSeek(
            model="deepseek-chat", 
            temperature=0.1, 
            api_key=self.api_key
        )

        # Prompt 包含 history 和 current_slides_json
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", CONTENT_SYSTEM_PROMPT),
            # current_slides 作为上下文传入，不一定要存入 history，作为 system context 即可
            ("system", "当前幻灯片JSON数据:\n{current_slides_json}"),
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

    async def generate_content_stream(
        self, 
        session_id: str, 
        user_input: str, 
        current_slides: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        """
        [V3 核心] 流式生成内容
        """
        logger.info(f"V3 Stream: 开始生成内容, Session: {session_id}")
        
        try:
            # 将 list 转为 json string
            import json
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
