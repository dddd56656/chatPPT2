# 极简PPT模板引擎使用说明

## 概述

这是一个极简的PPT模板引擎，使用您下载的Office官方模板文件，进行简单修改后调用现有的exporter服务导出PPTX文件。

## 核心功能

- **模板加载**: 自动加载 `templates/business_report.pptx` 模板文件
- **简单修改**: 更新第一张幻灯片的标题
- **导出集成**: 直接使用现有的 `PPTExporter` 服务导出

## 使用方法

### 1. 基本使用

```python
from services.design import TemplateEngine

# 创建模板引擎
engine = TemplateEngine()

# 方法1: 直接从模板创建PPT
result = engine.create_from_template(title="我的演示文稿")
# 返回: {'buffer': BytesIO, 'content_type': '...', 'filename': '...', 'file_size': ...}

# 方法2: 修改现有PPT并导出
from pptx import Presentation
prs = Presentation()
# ... 添加内容到prs
result = engine.modify_and_export(prs, title="我的PPT")
```

### 2. 文件结构

```
mvp_fastapi/
├── templates/
│   └── business_report.pptx  # 您下载的Office模板
├── services/
│   ├── design.py            # 极简模板引擎
│   └── exporter.py          # 现有导出服务
└── test_simple_design.py    # 测试脚本
```

### 3. 工作流程

1. **加载模板**: [`load_template()`](services/design.py:18) 加载本地模板文件
2. **简单修改**: 更新第一张幻灯片的标题
3. **导出**: 调用 [`PPTExporter.export_ppt()`](services/exporter.py:19) 导出PPTX

## 示例代码

```python
# 创建带模板样式的PPT
from services.design import TemplateEngine

engine = TemplateEngine()

# 创建商务报告
result = engine.create_from_template(title="2024年度报告")
print(f"文件: {result['filename']}, 大小: {result['file_size']} bytes")

# 保存到文件
with open("output.pptx", "wb") as f:
    f.write(result['buffer'].getvalue())
```

## 注意事项

- 确保模板文件 `templates/business_report.pptx` 存在
- 如果模板文件不存在，会创建空白PPT作为备选
- 导出格式固定为PPTX，使用现有exporter服务
- 修改功能简单，只更新第一张幻灯片的标题