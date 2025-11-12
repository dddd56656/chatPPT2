# PPT Generator - AI驱动的演示文稿生成器

一个基于FastAPI和python-pptx的智能PPT生成系统，能够根据用户提示自动创建专业的演示文稿。

## 功能特性

- 🚀 **快速生成**: 基于FastAPI的高性能异步架构
- 🤖 **智能编排**: 多Agent协作生成大纲、内容和设计
- 📊 **专业输出**: 使用python-pptx生成标准PPTX格式文件
- 🌐 **Web界面**: 简洁易用的Web用户界面
- 🔧 **模块化设计**: 清晰的代码结构和职责分离

## 项目结构

```
mvp_fastapi/
├── main.py              # FastAPI应用入口
├── orchestrator.py      # 核心编排器
├── services/            # 服务模块
│   ├── outline.py      # 大纲生成服务
│   ├── content.py      # 内容生成服务
│   ├── design.py       # 设计美化服务
│   └── exporter.py     # 导出服务
├── templates/          # 前端模板
│   └── index.html     # 主界面
├── static/            # 静态资源
│   └── app.js        # 前端逻辑
└── requirements.txt   # 依赖管理
```

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 安装依赖

```bash
cd mvp_fastapi
uv pip install -r requirements.txt
```

### 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 访问应用

打开浏览器访问: http://localhost:8000

## API文档

启动服务后，可以访问以下地址查看API文档:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心API

### POST /generate/ppt

生成PPT演示文稿

**请求体:**
```json
{
  "prompt": "AI在客户服务中的应用"
}
```

**响应:**
- 成功: 返回PPTX文件流
- 失败: 返回错误信息

## 开发指南

### 架构说明

项目采用分层架构设计:

1. **API层** (`main.py`): 处理HTTP请求和响应
2. **编排层** (`orchestrator.py`): 协调各个服务模块
3. **服务层** (`services/`): 实现具体的业务逻辑
4. **前端层** (`templates/`, `static/`): 提供用户界面

### 扩展开发

- 添加新的服务模块到 `services/` 目录
- 在 `orchestrator.py` 中集成新服务
- 更新 `requirements.txt` 添加新依赖

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 联系方式

如有问题或建议，请通过GitHub Issues联系我们。