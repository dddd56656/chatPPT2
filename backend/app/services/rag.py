import os
# c盘容量不足时使用下面代码，打包时请注释掉
# os.environ["HF_HOME"] = os.path.abspath("./model_cache")
import uuid
import shutil
import json
import logging
from typing import List
from datetime import datetime
from fastapi import UploadFile

from langchain_huggingface import HuggingFaceEmbeddings 
from langchain_milvus import Milvus
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from app.core.config import settings
from app.schemas.rag import RagFileResponse

logger = logging.getLogger(__name__)

TEMP_UPLOAD_DIR = "./temp_uploads"
METADATA_FILE = "./rag_metadata.json"

os.makedirs(TEMP_UPLOAD_DIR, exist_ok=True)

class RagService:
    def __init__(self):
        self.vector_store = None
        self.embeddings = None
        self._is_initialized = False
        logger.info("RAG Service instantiated. Waiting for explicit initialization...")

    def initialize(self):
        if self._is_initialized:
            return

        logger.info("[Startup] Initializing RAG Service...")
        try:
            logger.info(f"   - Loading Model: {settings.embedding_model_name}...")
            self.embeddings = HuggingFaceEmbeddings(
                model_name=settings.embedding_model_name,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )

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
            
            if not os.path.exists(METADATA_FILE):
                with open(METADATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump({}, f)

            self._is_initialized = True
            logger.info("[Startup] RAG Service is READY.")
            
        except Exception as e:
            logger.critical(f"[Error] RAG Init Failed: {e}")
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

    async def handle_file_upload(self, file: UploadFile, session_id: str) -> RagFileResponse:
        if not self._is_initialized:
            raise RuntimeError("RAG Service not initialized.")

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
            logger.error(f"[Error] Upload Failed: {e}", exc_info=True)
            return RagFileResponse(
                id=file_id, name=file.filename, size=0, status="error", upload_time=""
            )
        finally:
            if os.path.exists(file_path):
                os.remove(file_path)

    def search_context(self, query: str, session_id: str, k: int = 3) -> str:
        if not self._is_initialized:
            return ""
            
        try:
            expr = f'session_id == "{session_id}"'
            docs = self.vector_store.similarity_search(query, k=k, expr=expr)
            return "\n\n".join([doc.page_content for doc in docs])
        except Exception as e:
            logger.warning(f"[Warn] Search failed: {e}")
            return ""

    def fetch_file_preview(self, file_ids: List[str], limit_per_file: int = 2) -> str:
        if not self._is_initialized or not file_ids: return ""
        try:
            context_pieces = []
            for fid in file_ids:
                docs = self.vector_store.similarity_search(
                    query="", 
                    k=limit_per_file, 
                    expr=f'file_id == "{fid}"'
                )
                for doc in docs:
                    context_pieces.append(f"[File Content]: {doc.page_content}")
            return "\n\n".join(context_pieces)
        except Exception as e:
            logger.error(f"[Error] Preview fetch failed: {e}")
            return ""

    def list_files(self, session_id: str) -> List[RagFileResponse]:
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

rag_service = RagService()
