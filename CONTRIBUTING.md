# 贡献指南

感谢您有兴趣为PPT Generator项目做出贡献！我们欢迎各种形式的贡献，包括但不限于代码、文档、测试用例和功能建议。

## 开发环境设置

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/ppt-generator.git
cd ppt-generator
```

### 2. 创建虚拟环境

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows
```

### 3. 安装开发依赖

```bash
pip install -r requirements.txt
```

## 代码规范

### Python代码风格

我们遵循[PEP 8](https://pep8.org/)代码风格指南：

- 使用4个空格缩进
- 行长度限制在88个字符（使用Black格式化）
- 导入语句按标准库、第三方库、本地模块分组
- 使用有意义的变量和函数名

### 提交信息规范

使用[约定式提交](https://www.conventionalcommits.org/)格式：

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

## 开发流程

### 1. 创建功能分支

```bash
git checkout -b feat/your-feature-name
```

### 2. 实现功能

- 编写清晰的代码和注释
- 添加必要的测试用例
- 更新相关文档

### 3. 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_orchestrator.py
```

### 4. 提交代码

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

### 5. 推送分支

```bash
git push origin feat/your-feature-name
```

### 6. 创建Pull Request

在GitHub上创建Pull Request，并确保：

- 描述清楚功能或修复的内容
- 关联相关Issue（如果有）
- 通过所有CI检查

## 项目架构

### 核心模块

- `main.py`: FastAPI应用入口
- `orchestrator.py`: 核心编排逻辑
- `services/`: 业务服务模块
- `templates/`: 前端模板
- `static/`: 静态资源

### 扩展新功能

1. **添加新服务**:
   - 在`services/`目录创建新模块
   - 实现相应的功能接口
   - 在`orchestrator.py`中集成

2. **修改API**:
   - 更新`main.py`中的路由
   - 添加相应的Pydantic模型
   - 更新API文档

## 测试指南

### 单元测试

- 为每个服务模块编写测试
- 测试覆盖率目标：80%+
- 使用pytest框架

### 集成测试

- 测试完整的PPT生成流程
- 验证API端点功能
- 检查文件输出格式

## 文档更新

- 更新README.md中的功能说明
- 维护API文档
- 添加代码注释

## 问题报告

如果您发现bug或有功能建议，请：

1. 在GitHub Issues中搜索是否已有相关报告
2. 如果没有，创建新的Issue
3. 提供清晰的问题描述和复现步骤

## 行为准则

请遵守我们的[行为准则](CODE_OF_CONDUCT.md)，保持友好和尊重的交流环境。

感谢您的贡献！🎉