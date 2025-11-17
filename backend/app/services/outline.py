"""
大纲生成服务 (outline.py) - V1 架构

CTO注：此模块是 "V1 架构" 的 *入口点*。
它负责生成大纲 (Node 1)，但错误地也包含了
内容生成和文件保存 (Node 2 & 3) 的逻辑，
这违反了单一职责原则。

`app/worker/tasks.py` 中的 `generate_outline_task` (Node 1)
*应该* 只调用此文件中的 `generate_outline`。
"""

import os
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from langchain_deepseek import ChatDeepSeek
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_core.exceptions import OutputParserException
# [CTO 修复] 导入 settings 以获取 output_dir
from app.core.config import settings

# [CTO注 - 架构缺陷]：Outline (大纲) 服务不应该导入
# Content (内容) 和 Design (设计) 服务。
# 这种交叉导入导致了单体应用 (Monolith)。
from .content import ContentGeneratorV1
from .design import TemplateEngine

# --- 日志配置 ---
logger = logging.getLogger(__name__)

# --- 1. 大纲生成 Pydantic Schema ---

class OutlineModel(BaseModel):
    """Pydantic模型：用于大纲生成"""
    
    main_topic: str = Field(..., description="演示文稿主主题")
    outline: List[Dict[str, str]] = Field(..., description="大纲结构列表")
    summary_topic: str = Field(..., description="总结幻灯片主题")

# --- 2. 系统指令 ---

OUTLINE_SYSTEM_PROMPT = """[系统指令]
你是一名PPT结构设计专家。你的唯一目标是根据用户需求生成合理的PPT大纲结构。

要求：
1. 生成3-5个双栏幻灯片的大纲
2. 每个大纲项包含：sub_topic（子主题）、topic1（左栏主题）、topic2（右栏主题）
3. 确保主题之间有逻辑关联性
4. 提供合适的总结主题

你必须严格按照 Pydantic JSON 格式输出。
"""
# [V2 修复 - 新增] 专用于V2对话式修改的新指令
OUTLINE_CONVERSATIONAL_PROMPT = """[系统指令]
你是一名PPT结构设计专家。
- 如果用户是第一次发言 (历史记录中只有一条 'user' 消息)，请根据用户需求生成合理的PPT大纲结构，并严格按照 Pydantic JSON 格式输出。
- 如果用户的历史记录中包含一个AI生成的JSON大纲和用户的修改意见 (例如：'请修改第二点')，请根据用户的修改意见更新大纲，并再次严格按照 Pydantic JSON 格式输出。
- 你的回复必须是纯粹的Pydantic JSON格式，绝对不能包含任何解释性文字或道歉。"""
# --- 3. 大纲生成器服务 ---

class OutlineGenerator:
    """
    大纲生成服务。
    
    [CTO注]：此类目前职责混乱 (fat service)。
    它同时做了 Node 1, 2, 3 的工作。
    """
    
    def __init__(self):
        """初始化大纲生成器"""
        self.api_key = os.environ.get("DEEPSEEK_API_KEY")
        
        if not self.api_key:
            logger.warning("DEEPSEEK_API_KEY 环境变量未设置。API调用将失败。")
            raise ValueError("DEEPSEEK_API_KEY 未设置")
        
        # 初始化 LangChain
        try:
            self.llm = ChatDeepSeek(
                model="deepseek-chat", temperature=0, api_key=self.api_key
            )
            
            # 大纲生成链 (Node 1)
            self.outline_chain = ChatPromptTemplate.from_messages([
                ("system", OUTLINE_SYSTEM_PROMPT),
                ("user", "根据以下用户需求生成PPT大纲：\n{user_prompt}")
            ]) | self.llm.with_structured_output(OutlineModel)
            # [V2 修复 - 新增] 支持对话式修改的V2链
            self.conversational_chain = ChatPromptTemplate.from_messages([
                ("system", OUTLINE_CONVERSATIONAL_PROMPT),
                # "history" 占位符将接收一个消息列表 (e.g., [ ('user', '...'), ('assistant', '...') ])
                ("placeholder", "{history}") 
            ]) | self.llm.with_structured_output(OutlineModel) # 输出格式保持不变           
        except Exception as e:
            logger.error(f"初始化大纲生成器失败: {e}")
            raise
    
    def generate_outline(self, user_prompt: str) -> Dict[str, Any]:
        """
        [Node 1: 正确] 根据用户提示生成PPT大纲
        
        CTO注：这是此服务应该暴露的 *唯一* 核心方法。
        """
        logger.info(f"开始生成大纲，用户需求：{user_prompt}")
        
        try:
            # 调用LLM生成大纲
            outline_input = {"user_prompt": user_prompt}
            logger.debug(f"大纲生成输入参数: {outline_input}")
            outline_model = self.outline_chain.invoke(outline_input)
            logger.debug(f"大纲生成LLM输出: {outline_model}")
            
            logger.info(f"大纲生成成功：主主题 '{outline_model.main_topic}'，包含 {len(outline_model.outline)} 个双栏页")
            
            # 返回的数据结构 (被 Node 1 Task 使用)
            return {
                "main_topic": outline_model.main_topic,
                "outline": outline_model.outline,
                "summary_topic": outline_model.summary_topic,
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"大纲生成失败: {e}")
            return {
                "status": "error",
                "error": str(e),
                "fallback_data": self.get_fallback_outline(user_prompt)
            }
# [V2 修复 - 新增]
    def generate_outline_conversational(self, history: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        [Node 1: V2 - 新] 根据完整的聊天历史生成或修改大纲
        
        CTO注：这是 V2 聊天界面 (App.jsx) 调用的新核心方法。
        它接收由前端管理的状态（聊天记录）。
        """
        logger.info(f"开始对话式大纲生成 (V2)，历史消息数：{len(history)}")
        
        try:
            # 1. 转换 history 格式
            # 前端 `client.js` 发送 [{'role': 'user', 'content': '...'}]
            # LangChain 的 placeholder 期望 [('user', '...'), ('assistant', '...')]
            
            langchain_history = []
            for msg in history:
                # 过滤掉 'system' 消息, 因为我们的 V2 prompt 已经硬编码了系统指令
                if msg.get("role") != "system":
                    langchain_history.append((msg.get("role"), msg.get("content")))

            # 2. 调用新的V2对话链
            outline_model = self.conversational_chain.invoke({"history": langchain_history})
            logger.debug(f"对话式大纲 (V2) LLM输出: {outline_model}")
            
            # 3. 返回与 V1 'generate_outline' 相同的成功数据结构
            logger.info(f"对话式大纲 (V2) 生成/修改成功：主主题 '{outline_model.main_topic}'")
            
            return {
                "main_topic": outline_model.main_topic,
                "outline": outline_model.outline,
                "summary_topic": outline_model.summary_topic,
                "status": "success"
            }
            
        except Exception as e:
            logger.error(f"对话式大纲 (V2) 生成/修改失败: {e}")
            # 4. 返回与 V1 'generate_outline' 相同的失败数据结构
            return {
                "status": "error",
                "error": str(e),
                # 注意：这里我们无法调用 get_fallback_outline，因为它依赖单个 user_prompt
                # 仅返回错误信息更合适
            }    
    def generate_complete_ppt(self, user_prompt: str, template_engine: TemplateEngine) -> Dict[str, Any]:
        """
        [Node 1+2+3: 错误] 完整的PPT生成流程 (单体方法)
        
        CTO注：这是一个 *已弃用* (deprecated) 的方法。
        它被旧的 `generate_ppt_task` (已修复) 错误地调用。
        新的 `generate_ppt_workflow` (V2) 不再使用此方法。
        """
        logger.warning("正在调用已弃用的 (单体) `generate_complete_ppt` 服务")
        logger.info("开始完整PPT生成流程")
        
        try:
            # 1. 生成大纲 (Node 1)
            outline_result = self.generate_outline(user_prompt)
            if outline_result["status"] == "error":
                return outline_result
            
            outline_data = outline_result["outline"]
            logger.info(f"大纲数据: {outline_data}")
            
            # 3. 初始化内容生成器
            content_generator = ContentGeneratorV1(template_engine)
            
            # 4. 生成PPT内容数据 (Node 2)
            slides_data = content_generator.generate_ppt_data_v1(
                main_topic=outline_result["main_topic"],
                outline=outline_data,
                summary_topic=outline_result["summary_topic"]
            )
            logger.info(slides_data)

            # 4. 创建PPT文件 (Node 3 - Export)
            ppt_result = content_generator.create_ppt_file(
                slides_data=slides_data,
                output_title=outline_result["main_topic"]
            )
            
            # 5. 保存文件到output目录 (Node 3 - Save)
            file_path = self._save_ppt_file(ppt_result, outline_result["main_topic"])
            
            logger.info("完整PPT生成流程完成")
            
            return {
                "status": "success",
                "main_topic": outline_result["main_topic"],
                "outline": outline_result["outline"],
                "slides_count": len(slides_data),
                "ppt_file": file_path, # [CTO注]：返回的是文件路径
                "message": "PPT生成成功"
            }
            
        except Exception as e:
            logger.error(f"完整PPT生成流程失败: {e}")
            return {
                "status": "error",
                "error": str(e),
                "message": "PPT生成失败"
            }
    
    def _save_ppt_file(self, ppt_result: Dict[str, Any], title: str) -> str:
        """
        [Node 3: 错误] 保存PPT文件到output目录
        
        CTO注：此IO逻辑不应属于 Outline 服务。
        它已被移至 `tasks.export_ppt_task`。
        """
        try:
            output_dir = settings.output_dir
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
            
            filename = f"{title.replace(' ', '_')}.pptx"
            file_path = os.path.join(output_dir, filename)
            
            buffer = ppt_result.get("buffer")
            if buffer:
                if hasattr(buffer, "seek"):
                    buffer.seek(0)
                
                with open(file_path, "wb") as f:
                    if hasattr(buffer, "getvalue"):
                        f.write(buffer.getvalue())
                    elif hasattr(buffer, "read"):
                        f.write(buffer.read())
                    else:
                        logger.error("PPT结果中的buffer格式不支持")
                        return ""
                
                logger.info(f"PPT文件已保存: {file_path}")
                # [CTO注]：返回绝对路径以确保API端点能找到它
                return os.path.abspath(file_path)
            else:
                logger.error("PPT结果中没有有效的buffer数据")
                return ""
                
        except Exception as e:
            logger.error(f"保存PPT文件失败: {e}")
            return ""

    def get_fallback_outline(self, user_prompt: str) -> Dict[str, Any]:
        """提供回退大纲数据"""
        return {
            "main_topic": f"{user_prompt[:20]}...",
            "outline": [
                {"sub_topic": "概述", "topic1": "背景介绍", "topic2": "核心价值"},
                {"sub_topic": "技术架构", "topic1": "系统设计", "topic2": "技术栈"},
                {"sub_topic": "实施计划", "topic1": "时间安排", "topic2": "资源需求"}
            ],
            "summary_topic": "总结与展望"
        }

# --- 4. 服务工厂函数 ---

def create_outline_generator() -> OutlineGenerator:
    """创建大纲生成器实例的工厂函数"""
    return OutlineGenerator()
