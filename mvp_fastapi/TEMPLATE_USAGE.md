# PPT模板引擎使用说明

## 模板配置

当前系统配置了一个模板：**商务报告模板**

- **模板键名**: `business_report`
- **模板文件**: `business_report.pptx`
- **存储位置**: `mvp_fastapi/templates/business_report.pptx`

## 使用步骤

### 1. 下载Office官方模板

1. 访问 [Office模板网站](https://templates.office.com/)
2. 搜索并下载一个商务报告模板（.pptx格式）
3. 将下载的模板文件重命名为 `business_report.pptx`
4. 将文件保存到 `mvp_fastapi/templates/` 目录

### 2. 使用模板引擎

```python
from services.design import TemplateEngine
from pptx import Presentation

# 创建模板引擎
engine = TemplateEngine()

# 获取可用模板
templates = engine.get_available_templates()
print(templates)

# 创建带样式的PPT
result = engine.create_styled_presentation(
    template_name="business_report",
    slides_data=None  # 可以传入自定义幻灯片数据
)

# 导出带样式的现有PPT
prs = Presentation()  # 您的PPT对象
export_result = engine.export_styled_ppt(
    presentation=prs,
    template_name="business_report",
    title="我的演示文稿"
)
```

### 3. 模板文件结构

```
mvp_fastapi/
├── templates/
│   └── business_report.pptx  # 您下载的Office模板文件
├── services/
│   └── design.py            # 模板引擎实现
└── test_design.py           # 测试脚本
```

## 功能特点

- ✅ 使用真实的Office官方模板
- ✅ 与现有exporter服务无缝集成
- ✅ 自动检测模板文件存在性
- ✅ 提供备选基础样式
- ✅ 支持模板样式复制

## 注意事项

- 如果模板文件不存在，系统会自动创建基础样式作为备选
- 模板文件必须是有效的.pptx格式
- 系统会复制模板的母版样式到目标PPT