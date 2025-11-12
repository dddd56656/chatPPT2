### V1 最终代码实现文档 (扩展版)

**目标：** 按照“选项1：FastAPI 异步编排 + 后端模板”实现V1 MVP。

**核心API：** `POST /generate/ppt` (参考 `api-minimal.md`)

**V1 核心原则：**

1. **速度高于一切：** 验证从“提示”到“下载”的完整流程。
2. **存根优先 (Stub-First)：** V1 不调用任何真实的LLM API。我们只验证*流程*，不验证*质量*。
3. **零额外依赖：** V1 不引入除 `requirements.txt` 之外的任何中间件 (如 Redis, Celery) 或前端框架 (如 React)。

### 1. 最终目录结构

```
mvp_fastapi/
├── main.py         # (API入口 + HTML 路由)
├── orchestrator.py # (核心编排器)
├── services/       # (V1 存根服务)
│ ├── __init__.py
│ ├── outline.py    # (Agent A: 大纲服务)
│ ├── content.py    # (Agent B: 内容服务)
│ ├── design.py     # (Agent C: 美化服务)
│ └── exporter.py   # (导出器)
├── templates/
│ └── index.html    # (前端UI)
├── static/
│ └── app.js        # (前端逻辑)
└── requirements.txt
```

**目录解说：**

- 这种结构清晰地分离了“职责”。
- `main.py` 只关心“网络请求和响应”。
- `orchestrator.py` 只关心“业务流程”。
- `services/` 只关心“单一任务的执行”。
- `templates/` 和 `static/` 严格分离了前端的结构 (HTML) 和行为 (JS)。
- V2 中，当我们用LLM替换 `services/` 里的存根时，`main.py` 和 `orchestrator.py` 的结构*几乎不需要改变*。

### 2. 核心文件解说 (Implementation Spec)

#### `main.py` (API 与 Web 入口)

- **技术:** FastAPI, Jinja2Templates, Pydantic, Uvicorn
- **职责:**
  1. **`POST /generate/ppt` (API):**
     - **Pydantic 模型:** 定义 `GenerateRequest(BaseModel)`。这确保了我们的API是自文档化的 (用于 `/docs`) 并且是类型安全的。任何不含 `prompt` 字符串的请求都会被FastAPI自动拒绝 (返回 `422`)，无需我们编写任何验证代码。
     - **调用编排器:** `file_buffer = orchestrator.run(request.prompt, request.template_id)`。注意：V1 `main.py` *同步* (sync) 等待 `orchestrator.run` 完成。
     - **响应：**
       - **必须**使用 `StreamingResponse`。`orchestrator` 返回的是内存中的 `io.BytesIO` 缓冲区。`StreamingResponse` 可以直接将这个缓冲区作为HTTP响应体发送，效率极高。
       - **禁止**使用 `FileResponse`。`FileResponse` 用于从*磁盘*读取文件，我们V1绝不能有磁盘I/O操作。
       - **Content-Type:** 必须设置为 `application/vnd.openxmlformats-officedocument.presentationml.presentation`，这是`.pptx`文件的标准MIME类型，它会告诉浏览器这是一个演示文稿。
       - **Headers:** 建议添加 `Content-Disposition: attachment; filename=presentation.pptx`，这会强制浏览器触发“下载”对话框，而不是试图“打开”它。
     - **错误处理:** 必须使用 `try...except` 块包裹 `orchestrator.run`。如果 `orchestrator` 失败，`main.py` 必须捕获异常，并返回一个 JSON 格式的 `500 Internal Server Error` 响应，例如 `{"detail": "Generation failed"}`。这对于 `app.js` 向用户显示错误至关重要。
  2. **`GET /` (Web):**
     - 定义一个 `Jinja2Templates` 实例 (指向 `templates` 目录)。
     - `GET /` 路由将使用 `templates.TemplateResponse("index.html", {"request": request})` 来渲染并返回HTML页面。这是V1的唯一用户界面。
  3. **`static/` 挂载:**
     - 使用 `app.mount("/static", StaticFiles(directory="static"), name="static")`。
     - 这使得 `index.html` 中 `src="/static/app.js"` 这样的路径可以被正确解析，让FastAPI能够提供 `app.js` 文件。

#### `orchestrator.py` (核心编排器)

- **技术:** Python (V1 同步调用)
- **职责:**
  1. **定义 `run` 函数:** `def run(prompt: str, template_id: str | None)`。
  2. **严格的线性调用链 (V1):**
     - `outline_data = services.outline.generate(prompt)`
     - `content_data = services.content.generate(outline_data)`
     - `presentation_obj = services.design.apply(content_data, template_id)`
     - `file_buffer = services.exporter.export_to_buffer(presentation_obj)`
  3. **返回 `file_buffer`:** 将 `io.BytesIO` 实例返回给 `main.py`。
- **V1 MVP 关键:**
  - **保持同步：** V1中，`orchestrator.py` 必须是**同步** (sync) 的。我们V1不引入 `async/await`，因为我们的 `services/` 存根是瞬间完成的。
  - **数据契约 (Data Contracts):** 编排器定义了服务之间的数据格式：
    - `outline` (list[str]) -> `content`
    - `content` (dict) -> `design`
    - `presentation` (Presentation) -> `exporter`
  - **V2 展望:** 当V2引入真实LLM时，这个文件将是*唯一*需要修改为 `async def run(...)` 并使用 `await asyncio.gather(...)` 的地方。`main.py` 和 `services/` 将保持不变。

#### `services/` (Agent 逻辑 - V1 存根)

- **V1 核心原则:** **禁止**调用任何外部API (如 OpenAI, Google AI)。所有服务必须是返回硬编码数据的本地函数。我们是在测试“管道” (Pipeline)，不是“内容” (Content)。

- **`outline.py`:**

  - `generate(prompt: str) -> list[str]`:
    - V1实现：`return ["标题页", "什么是AI", "AI的应用", "总结与展望"]`。
    - V1中，`prompt` 参数**必须被忽略**。
    - 返回一个字符串列表，每个字符串代表一页幻灯片的*主题*。

- **`content.py`:**

  - `generate(outline: list[str]) -> dict`:

    - V1实现：遍历 `outline` 列表，返回一个结构化的字典。

    - **数据结构 (关键):** `dict` 的键是 `outline` 中的主题 (或唯一的slide_id)，值是包含该页内容的 `dict`。

    - 示例返回:

      ```
      {
        "标题页": {"title": "AI在客户服务中的应用", "subtitle": "由V1生成"},
        "什么是AI": {"title": "什么是AI", "bullets": ["要点1：机器学习", "要点2：深度学习"]},
        "AI的应用": {"title": "AI的应用", "bullets": ["应用1：聊天机器人", "应用2：智能推荐"]},
        "总结与展望": {"title": "总结", "bullets": ["AI是未来", "谢谢"]}
      }
      ```

    - 这种 `dict` 结构比 `list` 更有弹性，允许 `design.py` 根据内容类型（如 "标题页" vs "内容页"）选择不同的布局。

- **`design.py`:**

  - **技术:** `python-pptx`
  - `apply(content: dict, template_id: str | None) -> Presentation`:
    1. `prs = Presentation()`: 创建一个*空白*的演示文稿对象。
    2. **V1 忽略 `template_id`**。V2 中，`template_id` 可能会映射到一个 `.pptx` 模板文件路径 (e.g., `Presentation("template.pptx")`)，但V1不做。
    3. 遍历 `content` 字典的 `items()`。
    4. **布局选择:** `python-pptx` 有不同的幻灯片布局 (e.g., `prs.slide_layouts[0]` 是标题页，`prs.slide_layouts[1]` 是标题和内容)。
    5. `design.py` 必须根据 `content` 字典中的结构（例如，是否有 `subtitle` 或 `bullets`）来*智能地*选择一个布局。
    6. `slide = prs.slides.add_slide(layout)`
    7. 填充占位符: `slide.shapes.title.text = content_item["title"]`，并遍历 `bullets` 填充内容框。
    8. 返回 `prs` (一个 `pptx.Presentation` 对象)。

- **`services/exporter.py`:**

  - **技术:** `python-pptx`, `io.BytesIO`
  - `export_to_buffer(presentation_obj: Presentation) -> io.BytesIO`:
    1. `buffer = io.BytesIO()`: 在内存中创建一个*二进制文件缓冲区*。
    2. `presentation_obj.save(buffer)`: `python-pptx` 将演示文稿*保存*到这个内存缓冲区中，而不是保存到磁盘文件。
    3. **关键:** `buffer.seek(0)`。**这步操作绝不能省略！** 当 `.save()` 完成时，缓冲区的指针在*末尾*。如果不重置，`StreamingResponse` 会从末尾开始读取，发送一个0字节的空文件。`seek(0)` 将指针移回文件开头。
    4. 返回 `buffer`。

#### `templates/index.html` (前端 UI)

- **技术:** HTML5
- **内容:** (严格遵守 `frontend-prototype.md` 选项1)
  1. **`<!DOCTYPE html>` 和 `<meta viewport>`**：确保是现代HTML，并对移动设备友好（虽然V1不主要关注）。
  2. **`<form id="gen-form">`**: 包裹输入和按钮。我们将使用JS拦截表单提交，而不是传统的 `action` 提交。
  3. **`<textarea id="prompt-input" ...>`**: 使用 `textarea` 而不是 `input`，允许用户输入多行提示。`placeholder` 必须清晰。
  4. **`<button id="generate-btn" type="submit">...`**: `type="submit"` 允许用户按 Enter 键提交（在 `textarea` 中通常是 Ctrl+Enter，但这没关系）。按钮文本应清晰。
  5. **状态元素 (默认隐藏):**
     - <div id="loader" style="display:none;">生成中，请稍候...</div> (加载指示器)
     - <div id="error-msg" style="display:none; color:red;"></div> (错误提示区)
  6. **Script 引入:** `<script src="/static/app.js" defer></script>`。**必须**使用 `defer`，确保在HTML解析完毕后再执行JS，这样JS才能找到 `generate-btn` 等元素。

#### `static/app.js` (前端逻辑)

- **技术:** Vanilla JavaScript (Fetch API)，**禁止使用 jQuery 或任何框架**。
- **职责:**
  1. **DOM 引用:** 使用 `document.getElementById` 在脚本顶部获取所有UI元素 (`prompt-input`, `generate-btn`, `loader`, `error-msg`) 的引用。
  2. **事件监听:**
     - 获取 `<form id="gen-form">` 的引用。
     - 监听 `form.addEventListener('submit', handleGenerate)`。我们监听表单的 `submit` 事件，而不是按钮的 `click` 事件，这更健壮。
  3. **`handleGenerate` 函数 (async):**
     - `event.preventDefault()`: **必须**调用。阻止表单的默认提交（即页面刷新）。
     - **UI 状态 (加载中):**
       - `errorMsg.style.display = 'none'` (清除旧错误)
       - `loader.style.display = 'block'` (显示加载)
       - `generateBtn.disabled = true` (防止重复提交)
     - **Fetch API:**
       - `const prompt = promptInput.value;`
       - `const response = await fetch('/generate/ppt', {`
       - `method: 'POST',`
       - `headers: {'Content-Type': 'application/json'},`
       - `body: JSON.stringify({ prompt: prompt })`
       - `});`
     - **响应处理:**
       - **`if (response.ok)` (HTTP 200):**
         - `const blob = await response.blob();`: 获取响应体，`blob` 是原始的、未解析的二进制数据（即 `.pptx` 文件）。
         - `const url = URL.createObjectURL(blob);`: 在浏览器内存中为这个 `blob` 创建一个临时的、唯一的URL (e.g., `blob:http://...`)。
         - **下载技巧 (不可见链接):**
           - `const a = document.createElement('a');`
           - `a.style.display = 'none';`
           - `a.href = url;`
           - `a.download = 'presentation.pptx';` (指定下载的文件名)
           - `document.body.appendChild(a);`
           - `a.click();` (模拟用户点击这个不可见链接)
           - `document.body.removeChild(a);` (清理)
           - `URL.revokeObjectURL(url);` (释放浏览器内存)。
       - **`else` (HTTP 422 / 500):**
         - `const errorData = await response.json();` (假设服务器返回JSON)
         - `errorMsg.textContent = errorData.detail || '生成失败，请重试。';`
         - `errorMsg.style.display = 'block';`
     - **`finally` 块:** **必须**使用 `finally` 块来确保UI状态被重置，*无论*生成是成功还是失败。
       - `loader.style.display = 'none';`
       - `generateBtn.disabled = false;`

#### `requirements.txt`

- **V1 最小依赖:**

  ```
  fastapi           # 核心Web框架
  uvicorn[standard] # ASGI 服务器 (带标准依赖，性能更佳)
  python-pptx       # 读/写 PowerPoint 文件
  jinja2            # 用于渲染 templates/index.html
  ```