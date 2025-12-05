import os
import uuid
import shutil
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import UploadFile

# LangChain RAG 核心依赖
from langchain_huggingface import HuggingFaceEmbeddings 
from langchain_milvus import Milvus
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.core.config import settings
from app.schemas.rag import RagFileResponse

logger = logging.getLogger(__name__)

# 临时文件存储路径 (用于解析)
TEMP_UPLOAD_DIR = "./temp_uploads"
os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

class RagService:
    def __init__(self):
        # 1. 初始化本地 Embedding (使用免费的 HuggingFace 模型)
        logger.info(f"Loading Local Embedding Model: {settings.embedding_model_name} ...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name=settings.embedding_model_name,
            model_kwargs={'device': 'cpu'}, # 默认使用 CPU
            encode_kwargs={'normalize_embeddings': True}
        )

        # 2. 连接 Milvus
        # LangChain 会自动处理连接和 Collection 创建
        self.vector_store = Milvus(
            embedding_function=self.embeddings,
            connection_args={
                "host": settings.milvus_host, 
                "port": settings.milvus_port
            },
            collection_name=settings.milvus_collection,
            auto_id=True
        )
        logger.info("RAG Service Initialized (Local Embedding).")

    async def handle_file_upload(self, file: UploadFile, session_id: str) -> RagFileResponse:
        """核心流程: 上传 -> 保存 -> 解析 -> 切分 -> 向量化(Local) -> 入库"""
        file_id = str(uuid.uuid4())
        file_path = os.path.join(TEMP_UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        try:
            # 1. 保存临时文件
            with open(file_path, "wb") as buffer:
                # 使用 shutil.copyfileobj 是处理 UploadFile 的标准做法
                shutil.copyfileobj(file.file, buffer)

            # 2. 根据后缀选择加载器
            loader = None
            if file.filename.endswith(".pdf"):
                loader = PyPDFLoader(file_path)
            elif file.filename.endswith(".docx"):
                loader = Docx2txtLoader(file_path)
            else:
                loader = TextLoader(file_path, encoding="utf-8")

            # 3. 加载并切分 (Chunking)
            # [Best Practice]: RecursiveCharacterTextSplitter 适合处理复杂文本
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
            docs = loader.load_and_split(text_splitter)

            # 4. 注入 Metadata (检索过滤的关键)
            # 必须给每个切片打上 session_id 和 file_id 的标签，以便后续精确检索和删除
            for doc in docs:
                doc.metadata["session_id"] = session_id
                doc.metadata["file_id"] = file_id
                doc.metadata["file_name"] = file.filename
                doc.metadata["timestamp"] = datetime.now().isoformat()

            # 5. 写入 Milvus (向量化与入库)
            if docs:
                self.vector_store.add_documents(docs)

            return RagFileResponse(
                id=file_id,
                name=file.filename,
                size=file.size,
                status="indexed",
                upload_time=datetime.now().strftime("%Y-%m-%d %H:%M")
            )

        except Exception as e:
            logger.error(f"RAG Upload Failed: {e}", exc_info=True)
            return RagFileResponse(
                id=file_id, name=file.filename, size=0, status="error", upload_time=""
            )
        finally:
            # 清理临时文件，符合 SRE 规范
            if os.path.exists(file_path):
                os.remove(file_path)

    def search_context(self, query: str, session_id: str, k: int = 3) -> str:
        """语义检索: 根据 Query 和 SessionID 查找相关片段"""
        try:
            # [Milvus Filter]: 只搜索当前会话的文档，隔离数据
            expr = f'session_id == "{session_id}"'
            docs = self.vector_store.similarity_search(query, k=k, expr=expr)
            
            # 将检索到的片段拼接成字符串，用于注入 Prompt
            return "\n\n".join([doc.page_content for doc in docs])
        except Exception as e:
            logger.warning(f"RAG Search failed: {e}")
            return ""

    def list_files(self, session_id: str) -> List[RagFileResponse]:
        """文件列表 (目前为占位函数)"""
        # [CTO Note]: 在生产环境中，你需要一个额外的 SQL/Redis 表来存储文件元数据，才能高效列出文件。
        # 由于我们没有这个表，这里暂时返回空列表。
        return []

    def delete_file(self, file_id: str):
        """物理删除向量"""
        # Milvus 删除操作是基于 Metadata 过滤的
        self.vector_store.delete(expr=f'file_id == "{file_id}"')

# 单例导出
rag_service = RagService()