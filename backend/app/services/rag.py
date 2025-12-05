import os
import uuid
import shutil
import json
import logging
from typing import List
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

# 临时文件存储路径
TEMP_UPLOAD_DIR = "./temp_uploads"
METADATA_FILE = "./rag_metadata.json"

os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

class RagService:
    def __init__(self):
        # [CTO Standard]: 构造函数保持极简，绝不执行耗时操作 (如 I/O 或模型加载)
        # 这确保了文件被导入时不会阻塞进程，解决了 Windows/Docker 的启动超时问题
        self.vector_store = None
        self.embeddings = None
        self._is_initialized = False
        logger.info("RAG Service instantiated. Waiting for explicit initialization...")

    def initialize(self):
        """
        [Lifecycle Hook]: 显式初始化方法
        将在 app/main.py 的 lifespan 启动阶段被调用。
        """
        if self._is_initialized:
            logger.info("RAG Service already initialized.")
            return

        logger.info("🚀 [Startup] Initializing AI Models & Vector DB Connection...")
        try:
            # 1. 加载本地 Embedding (耗时操作)
            logger.info(f"   - Loading Model: {settings.embedding_model_name}...")
            self.embeddings = HuggingFaceEmbeddings(
                model_name=settings.embedding_model_name,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )

            # 2. 连接 Milvus
            logger.info(f"   - Connecting to Milvus at {settings.milvus_host}:{settings.milvus_port}...")
            self.vector_store = Milvus(
                embedding_function=self.embeddings,
                connection_args={
                    "host": settings.milvus_host, 
                    "port": settings.milvus_port
                },
                collection_name=settings.milvus_collection,
                auto_id=True
            )
            
            # 3. 初始化元数据文件
            if not os.path.exists(METADATA_FILE):
                with open(METADATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump({}, f)

            self._is_initialized = True
            logger.info("✅ [Startup] RAG Service is READY!")
            
        except Exception as e:
            # 初始化失败直接抛出，阻止应用启动（Fail Fast）
            logger.critical(f"❌ RAG Initialization Failed: {e}")
            raise e

    def _load_metadata(self) -> dict:
        try:
            with open(METADATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}

    def _save_metadata(self, data: dict):
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # 业务方法：必须检查是否已初始化
    async def handle_file_upload(self, file: UploadFile, session_id: str) -> RagFileResponse:
        if not self._is_initialized:
            raise RuntimeError("RAG Service not initialized. Check startup logs.")

        file_id = str(uuid.uuid4())
        file_path = os.path.join(TEMP_UPLOAD_DIR, f"{file_id}_{file.filename}")
        
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            loader = None
            if file.filename.endswith(".pdf"):
                loader = PyPDFLoader(file_path)
            elif file.filename.endswith(".docx"):
                loader = Docx2txtLoader(file_path)
            else:
                loader = TextLoader(file_path, encoding="utf-8")

            text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=100)
            docs = loader.load_and_split(text_splitter)

            for doc in docs:
                doc.metadata["session_id"] = session_id
                doc.metadata["file_id"] = file_id
                doc.metadata["file_name"] = file.filename
                doc.metadata["timestamp"] = datetime.now().isoformat()

            if docs:
                self.vector_store.add_documents(docs)

            metadata = self._load_metadata()
            file_info = {
                "id": file_id,
                "name": file.filename,
                "size": file.size,
                "status": "indexed",
                "upload_time": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "session_id": session_id
            }
            metadata[file_id] = file_info
            self._save_metadata(metadata)

            return RagFileResponse(**file_info)

        except Exception as e:
            logger.error(f"RAG Upload Failed: {e}", exc_info=True)
            return RagFileResponse(
                id=file_id, name=file.filename, size=0, status="error", upload_time=""
            )
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

    def search_context(self, query: str, session_id: str, k: int = 3) -> str:
        if not self._is_initialized:
            logger.error("RAG Service not initialized during search.")
            return ""
            
        try:
            expr = f'session_id == "{session_id}"'
            docs = self.vector_store.similarity_search(query, k=k, expr=expr)
            return "\n\n".join([doc.page_content for doc in docs])
        except Exception as e:
            logger.warning(f"RAG Search failed: {e}")
            return ""

    def list_files(self, session_id: str) -> List[RagFileResponse]:
        # list_files 仅读 JSON，无需 AI 模型，即使未初始化也可运行（增强鲁棒性）
        metadata = self._load_metadata()
        user_files = [
            RagFileResponse(**info) 
            for info in metadata.values() 
            if info.get("session_id") == session_id
        ]
        return sorted(user_files, key=lambda x: x.upload_time, reverse=True)

    def delete_file(self, file_id: str):
        if not self._is_initialized:
             raise RuntimeError("RAG Service not initialized.")

        self.vector_store.delete(expr=f'file_id == "{file_id}"')
        metadata = self._load_metadata()
        if file_id in metadata:
            del metadata[file_id]
            self._save_metadata(metadata)

# 单例导出
rag_service = RagService()