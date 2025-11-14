# API 规范文档

ChatPPT项目的API接口规范，基于OpenAPI 3.0标准。

## 概述

ChatPPT API提供PPT生成任务的创建、状态查询和文件下载功能，采用RESTful设计原则。

## 基础信息

- **Base URL**: `http://localhost:8000/api`
- **Content-Type**: `application/json`
- **认证**: 目前无需认证（开发阶段）

## 接口定义

### 创建PPT生成任务

**Endpoint**: `POST /tasks`

**描述**: 创建一个新的PPT生成任务

**请求体**:
```json
{
  "prompt": "AI在客户服务中的应用",
  "template": "business_report",
  "options": {
    "slide_count": 10,
    "language": "zh-CN"
  }
}
```

**响应**:
```json
{
  "task_id": "uuid-string",
  "status": "pending",
  "message": "任务已创建"
}
```

### 获取任务状态

**Endpoint**: `GET /tasks/{task_id}`

**描述**: 查询指定任务的当前状态

**响应**:
```json
{
  "task_id": "uuid-string",
  "status": "processing|completed|failed",
  "progress": 75,
  "message": "正在生成内容...",
  "result_url": "/api/tasks/{task_id}/download"
}
```

### 下载生成的PPT

**Endpoint**: `GET /tasks/{task_id}/download`

**描述**: 下载已完成的PPT文件

**响应**: PPTX文件流

## 状态码说明

- `200`: 请求成功
- `201`: 任务创建成功
- `400`: 请求参数错误
- `404`: 任务不存在
- `500`: 服务器内部错误

## 错误响应格式

```json
{
  "error": "错误类型",
  "message": "详细错误信息",
  "detail": "可选的技术细节"
}
```

## 数据模型

### TaskRequest
- `prompt` (string, required): 生成提示词
- `template` (string, optional): 模板名称
- `options` (object, optional): 生成选项

### TaskResponse
- `task_id` (string): 任务ID
- `status` (string): 任务状态
- `progress` (integer): 进度百分比
- `message` (string): 状态消息
- `result_url` (string): 结果下载URL

## 使用示例

### 创建任务
```bash
curl -X POST "http://localhost:8000/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "数字化转型战略"}'
```

### 查询状态
```bash
curl "http://localhost:8000/api/tasks/{task_id}"
```

### 下载文件
```bash
curl "http://localhost:8000/api/tasks/{task_id}/download" --output presentation.pptx
```

## 注意事项

1. 任务状态轮询建议间隔为2-5秒
2. 生成时间取决于内容复杂度和服务器负载
3. 下载链接在任务完成后24小时内有效