# 环境设置指南

## 环境变量配置

### 必需环境变量

创建 `.env` 文件在 `backend/` 目录下：

```bash
# DeepSeek API配置
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Redis配置
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# 应用配置
APP_ENV=development
LOG_LEVEL=INFO
```

### 获取DeepSeek API密钥

1. 访问 [DeepSeek开放平台](https://platform.deepseek.com/)
2. 注册账号并登录
3. 在控制台中创建API密钥
4. 将密钥复制到 `DEEPSEEK_API_KEY` 环境变量

## 依赖安装

### 使用pip安装

```bash
cd backend
pip install -r requirements.txt
```

### 使用uv安装（推荐）

```bash
cd backend
uv pip install -r requirements.txt
```

## 服务启动

### 开发环境

1. **启动Redis服务**
   ```bash
   redis-server
   ```

2. **启动Celery Worker**
   ```bash
   celery -A app.core.celery_app worker --loglevel=info
   ```

3. **启动FastAPI应用**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### 生产环境

使用Docker Compose一键启动所有服务：

```bash
docker-compose up -d
```

## 验证安装

1. 访问API文档：http://localhost:8000/docs
2. 检查Celery Worker状态：
   ```bash
   celery -A app.core.celery_app inspect active
   ```

## 故障排除

### 常见问题

1. **API密钥错误**
   - 检查 `DEEPSEEK_API_KEY` 是否正确设置
   - 确认API密钥是否有足够的配额

2. **Redis连接失败**
   - 确保Redis服务正在运行
   - 检查 `REDIS_URL` 配置

3. **依赖安装失败**
   - 确保Python版本为3.8+
   - 尝试使用虚拟环境

### 日志查看

```bash
# 查看应用日志
tail -f backend/app.log

# 查看Celery日志
celery -A app.core.celery_app worker --loglevel=debug