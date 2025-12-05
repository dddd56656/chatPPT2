# Stage 1: Builder (uv 高速构建)
FROM python:3.11-slim AS builder

# 获取 uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# 安装编译依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 1. 准备依赖
COPY requirements.txt .

# 2. 创建虚拟环境并安装
ENV VIRTUAL_ENV=/app/.venv
RUN uv venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
RUN uv pip install -r requirements.txt

# 3. [关键] 模型预拉取 (Model Prefetch)
# 这一步会在构建时下载模型，存入 /root/.cache
# 确保容器启动时无需联网下载 500MB+ 模型
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('moka-ai/m3e-base')"

# Stage 2: Runtime (生产环境)
FROM python:3.11-slim

WORKDIR /app

# 1. 拷贝虚拟环境
COPY --from=builder /app/.venv /app/.venv
# 2. 拷贝模型缓存 (实现离线启动)
COPY --from=builder /root/.cache /root/.cache

# 激活环境
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
