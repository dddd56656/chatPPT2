# 环境变量设置指南

## 必需的环境变量

### 1. DeepSeek API Key
```bash
# 在 .env 文件中设置
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 或者在命令行中设置
export DEEPSEEK_API_KEY="your_deepseek_api_key_here"
```

### 2. 获取 DeepSeek API Key
1. 访问 [DeepSeek 开放平台](https://platform.deepseek.com/)
2. 注册账号并登录
3. 在控制台中创建 API Key
4. 将 API Key 填入 `.env` 文件

## 可选的环境变量

### 模板路径配置
```bash
# 自定义模板文件路径
TEMPLATE_PATH=templates/business_report.pptx
```

## 使用方法

### 方法一：使用 .env 文件（推荐）
1. 复制 `.env` 文件
2. 将 `your_deepseek_api_key_here` 替换为真实的 API Key
3. 运行应用时会自动加载环境变量

### 方法二：命令行设置
```bash
# Windows (PowerShell)
$env:DEEPSEEK_API_KEY="your_api_key_here"

# Windows (CMD)
set DEEPSEEK_API_KEY=your_api_key_here

# Linux/Mac
export DEEPSEEK_API_KEY="your_api_key_here"
```

## 验证设置

运行以下命令验证环境变量是否设置正确：
```bash
cd mvp_fastapi
python -c "import os; print('DEEPSEEK_API_KEY:', os.environ.get('DEEPSEEK_API_KEY', '未设置'))"
```

如果显示 API Key，说明设置成功。