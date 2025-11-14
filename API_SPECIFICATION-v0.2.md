作为 Google CTO，收到您的指令。我们不能简单地抛弃 v0.1，而是要基于现有的资产进行**平滑迁移 (Migration)**。

我为您制定了一份**v0.1 到 v0.2 的资产整合与迁移指南**。这将保留您宝贵的业务逻辑代码（`services/`），同时将其重组为符合 Google 标准的 Monorepo 架构。

-----

# 📁 ChatPPT v0.2 最终整合工程目录 (Migration & Integration)

## 1\. 迁移策略概览 (Migration Strategy)

  * **根目录 (`chatPPT/`)**: 保持不变，保留文档和 Git 配置。
  * **后端 (`backend/`)**: 将原 `mvp_fastapi/` 重命名并重构为 `backend/`。保留 `services/` 核心逻辑，废弃旧的同步 `orchestrator.py` 和 `main.py`。
  * **前端 (`frontend/`)**: 全新创建。原 `mvp_fastapi/static` 和 `templates/index.html` 被废弃，由 React 替代。
  * **基础设施**: 新增 `docker-compose.yml` 来编排 Redis 和前后端。

-----

## 2\. 详细文件结构清单 (The Final Tree)

\<span style="color: green;"\>🟢 新增 (New)\</span\> | \<span style="color: orange;"\>🟡 移动/重构 (Moved/Refactored)\</span\> | \<span style="color: grey;"\>⚪ 保持不变 (Kept)\</span\>

### 📦 根目录: `chatPPT/`

```text
chatPPT/
├── .gitignore                  # ⚪ [Kept] 增加 frontend/node_modules 等规则
├── README.md                   # 🟡 [Refactor] 更新为 v0.2 架构说明
├── API_SPECIFICATION.md        # ⚪ [Kept] API 规范
├── CONTRIBUTING.md             # ⚪ [Kept] 贡献指南
├── LICENSE                     # ⚪ [Kept] 许可证
├── docker-compose.yml          # 🟢 [New] 一键启动 (Redis + Backend + Frontend)
│
├── backend/                    # 🟡 [Moved] 原 mvp_fastapi/ 迁移并重组
│   └── ... (见下文)
│
└── frontend/                   # 🟢 [New] 全新 React 项目
    └── ... (见下文)
```

-----

### 🐍 后端整合: `chatPPT/backend/`

*(原 `mvp_fastapi/` 文件夹)*

```text
backend/
├── Dockerfile                  # 🟢 [New]
├── requirements.txt            # 🟡 [Refactor] 原 mvp_fastapi/requirements.txt (增加 celery, redis)
├── .env                        # 🟡 [Moved] 原 mvp_fastapi/.env
│
├── app/                        # 🟢 [New] Python 包根目录
│   ├── __init__.py
│   ├── main.py                 # 🟡 [Refactor] 原 mvp_fastapi/main.py (瘦身：只留 CORS 和 include_router)
│   │
│   ├── api/                    # 🟢 [New] 接口层
│   │   ├── __init__.py
│   │   └── routers.py          # 🟢 [New] 定义 /tasks 路由
│   │
│   ├── core/                   # 🟢 [New] 核心配置
│   │   ├── __init__.py
│   │   ├── config.py           # 🟢 [New] 加载 .env
│   │   └── celery_app.py       # 🟢 [New] Celery 实例
│   │
│   ├── schemas/                # 🟢 [New] Pydantic 模型
│   │   ├── __init__.py
│   │   └── task.py             # 🟢 [New] 定义 Request/Response 模型
│   │
│   ├── services/               # ⚪ [Kept] 核心业务逻辑 (原样保留，微调引用)
│   │   ├── __init__.py         # 🟡 [Refactor] 导出 OutlineService, ContentService
│   │   ├── outline.py          # ⚪ [Kept] 生成大纲逻辑 (需移除直接的 API Key 读取，改为参数传入)
│   │   ├── content.py          # ⚪ [Kept] 生成内容逻辑
│   │   ├── design.py           # ⚪ [Kept] PPT 操作逻辑
│   │   └── exporter.py         # ⚪ [Kept] 导出逻辑
│   │
│   └── worker/                 # 🟢 [New] 异步任务层
│       ├── __init__.py
│       └── tasks.py            # 🟡 [Refactor] 原 mvp_fastapi/orchestrator.py 的逻辑移到这里
│
├── templates/                  # 🟡 [Moved] 原 mvp_fastapi/templates/
│   └── business_report.pptx    # ⚪ [Kept] 必须保留的模板文件
│   # index.html 已被删除，由前端接管
│
└── output/                     # ⚪ [Kept] 生成文件存放目录
```

#### ⚠️ 关键迁移说明 (Backend Migration Note)

1.  **`mvp_fastapi/orchestrator.py`** ➡️ **`backend/app/worker/tasks.py`**:
    原有的同步编排逻辑，必须改写为 `@celery_app.task` 函数。
2.  **`mvp_fastapi/services/`**:
    代码基本保留，但需修改 `import` 路径。例如 `from services.design` 变为 `from app.services.design`。
3.  **`mvp_fastapi/main.py`**:
    原有的大量路由逻辑被拆分到 `app/api/routers.py`，`main.py` 只负责启动 FastAPI App。

-----

### ⚛️ 前端整合: `chatPPT/frontend/`

*(全新目录，替代原有的 static/js)*

```text
frontend/
├── package.json                # 🟢 [New] 依赖管理
├── vite.config.js              # 🟢 [New] 构建配置
├── .env                        # 🟢 [New] VITE_API_BASE_URL=http://localhost:8000
│
└── src/
    ├── main.jsx                # 🟢 [New] 入口
    ├── App.jsx                 # 🟢 [New] 路由与布局
    ├── index.css               # 🟢 [New] 样式
    │
    ├── api/
    │   └── client.js           # 🟢 [New] Axios 封装 (替代原 app.js 的 fetch)
    │
    ├── hooks/
    │   └── useTask.js          # 🟢 [New] 状态轮询逻辑 (替代原 app.js 的 setInterval)
    │
    └── components/
        ├── Monitor.jsx         # 🟢 [New] 进度条组件
        └── Editor.jsx          # 🟢 [New] 大纲编辑器 (HITL 核心)
```

#### ⚠️ 关键迁移说明 (Frontend Migration Note)

  * **原 `mvp_fastapi/static/app.js`**：**彻底废弃**。原有逻辑（表单提交、轮询）被重写为 React Hooks (`useTask.js`)。
  * **原 `mvp_fastapi/templates/index.html`**：**彻底废弃**。被 React 的组件化 UI 替代。

-----

### 3\. 实施步骤 (Execution Plan)

1.  **创建目录骨架**:
    在 `chatPPT` 根目录下新建 `backend` 和 `frontend` 文件夹。
2.  **移动旧文件**:
    将 `mvp_fastapi` 下除 `static/` 和 `index.html` 外的所有文件移动到 `backend/` 对应位置。
3.  **清理旧代码**:
    删除 `backend` 中残留的 `static` 文件夹和 `orchestrator.py` (内容已迁移至 `tasks.py`)。
4.  **初始化前端**:
    在 `frontend` 目录运行 `npm create vite@latest .`。
5.  **编写 Docker Compose**:
    在根目录创建 `docker-compose.yml` 连接两者。

这个整合方案既尊重了您已有的代码资产（特别是复杂的 PPT 生成逻辑），又成功将其升级到了谷歌级的现代化架构。