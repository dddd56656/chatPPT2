# PPT操作指南

## PPT结构概述

### 1. Presentation（演示文稿）
- 顶层对象，包含所有幻灯片和母版
- 通过 `Presentation()` 创建新PPT
- 通过 `Presentation(template_path)` 加载模板

### 2. Slide（幻灯片）
- 演示文稿中的单页
- 通过 `slides.add_slide(layout)` 添加
- 通过 `slides[index]` 访问特定幻灯片

### 3. Slide Layout（幻灯片布局）
- 预定义的幻灯片模板
- 通过 `slide_layouts[index]` 访问
- 常见布局：
  - 0: 标题幻灯片
  - 1: 标题和内容
  - 2: 节标题
  - 3: 两栏内容
  - 4: 比较
  - 5: 仅标题
  - 6: 空白

### 4. Shape（形状）
- 幻灯片上的元素（文本框、图片、图表等）
- 通过 `shapes` 集合访问
- `shapes.title`: 标题形状
- `placeholders`: 占位符形状

## 基本操作

### 1. 创建PPT
```python
from pptx import Presentation

# 创建空白PPT
prs = Presentation()

# 从模板创建
prs = Presentation("template.pptx")
```

### 2. 添加幻灯片
```python
# 添加标题幻灯片
title_slide = prs.slides.add_slide(prs.slide_layouts[0])

# 添加内容幻灯片
content_slide = prs.slides.add_slide(prs.slide_layouts[1])
```

### 3. 修改内容
```python
# 修改标题
slide.shapes.title.text = "新标题"

# 修改内容占位符
content = slide.placeholders[1]
content.text = "内容文本"

# 添加列表
text_frame = content.text_frame
text_frame.clear()
p1 = text_frame.paragraphs[0]
p1.text = "• 项目1"
p2 = text_frame.add_paragraph()
p2.text = "• 项目2"
```

### 4. 删除幻灯片
```python
# 删除特定幻灯片
slide = prs.slides[0]
prs.slides._sldIdLst.remove(slide._element)

# 清空所有幻灯片
for i in range(len(prs.slides)-1, -1, -1):
    rId = prs.slides._sldIdLst[i].rId
    prs.part.drop_rel(rId)
```

### 5. 复制幻灯片
```python
# 复制幻灯片（复杂操作，需要复制XML）
def duplicate_slide(prs, index):
    source = prs.slides[index]
    slide_layout = source.slide_layout
    
    # 创建新幻灯片
    dest = prs.slides.add_slide(slide_layout)
    
    # 复制所有形状
    for shape in source.shapes:
        # 这里需要复杂的XML复制逻辑
        pass
    
    return dest
```

## 模板引擎使用方法

### 1. 简单使用
```python
from services.design import TemplateEngine

engine = TemplateEngine()
result = engine.create_from_template(title="我的演示文稿")
```

### 2. 自定义幻灯片
```python
slides_data = [
    {
        'slide_type': 'title',
        'title': '项目汇报'
    },
    {
        'slide_type': 'content',
        'title': '项目概述',
        'content': ['项目背景', '项目目标', '项目范围']
    },
    {
        'slide_type': 'two_column',
        'title': '进度对比',
        'left_content': ['已完成工作1', '已完成工作2'],
        'right_content': ['待完成工作1', '待完成工作2']
    }
]

result = engine.create_from_template(title="项目汇报", slides_data=slides_data)
```

### 3. 保存文件
```python
# 保存到文件
with open("output.pptx", "wb") as f:
    f.write(result['buffer'].getvalue())
```

## 常用操作示例

### 添加图片
```python
from pptx.util import Inches

slide = prs.slides.add_slide(prs.slide_layouts[5])  # 仅标题布局
left = top = Inches(1)
pic = slide.shapes.add_picture("image.jpg", left, top, width=Inches(5))
```

### 添加表格
```python
from pptx.util import Inches

rows = cols = 2
left = top = Inches(2.0)
width = Inches(6.0)
height = Inches(0.8)

table = slide.shapes.add_table(rows, cols, left, top, width, height).table

# 设置表头
table.cell(0, 0).text = '姓名'
table.cell(0, 1).text = '分数'

# 设置数据
table.cell(1, 0).text = '张三'
table.cell(1, 1).text = '95'
```

### 添加图表
```python
from pptx.chart.data import CategoryChartData

chart_data = CategoryChartData()
chart_data.categories = ['Q1', 'Q2', 'Q3', 'Q4']
chart_data.add_series('销售额', (19.2, 21.4, 16.7, 19.2))

x, y, cx, cy = Inches(2), Inches(2), Inches(6), Inches(4.5)
slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED, x, y, cx, cy, chart_data
)
```

## 注意事项

1. **布局索引**: 不同模板的布局索引可能不同
2. **占位符**: 检查占位符是否存在再操作
3. **文本格式**: 使用 `text_frame` 进行复杂文本操作
4. **保存**: 使用 `prs.save("filename.pptx")` 保存文件