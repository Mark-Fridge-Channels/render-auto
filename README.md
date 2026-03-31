# render-auto API 使用文档

本文档说明如何使用本项目的模板管理与图片生成 API。

## 1. 启动方式

### 启动前端

```bash
npm run dev
```

### 启动 API

```bash
npm run dev:api
```

默认 API 地址：`http://localhost:3001`  
前端通过 Vite 代理访问 `/api`。

## 2. 环境变量

在项目根目录创建 `.env`：

```env
API_PORT=3001
RENDER_APP_URL=http://localhost:5173

AWS_REGION=sa-east-1
AWS_S3_BUCKET=amzn-s3-fc-bucket
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

说明：

- `RENDER_APP_URL`：Headless Chromium 渲染页面地址。
- AWS 凭证用于上传生成图到 S3。

## 3. 通用返回格式

成功：HTTP `2xx` + JSON  
失败：HTTP `4xx/5xx` + JSON：

```json
{ "error": "..." }
```

## 4. 模板接口

模板包含：`name/order/enabled/payload`，其中 `payload` 保存 `config + productQuad`。

### 4.1 获取模板列表

- `GET /api/templates`

响应：

```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "场景图",
      "order": 1,
      "enabled": true,
      "payload": {
        "config": {},
        "productQuad": []
      },
      "createdAt": "2026-03-27T00:00:00.000Z",
      "updatedAt": "2026-03-27T00:00:00.000Z"
    }
  ]
}
```

### 4.2 获取单个模板

- `GET /api/templates/:id`

响应：

```json
{
  "template": {
    "id": "uuid",
    "name": "场景图",
    "order": 1,
    "enabled": true,
    "payload": {
      "config": {},
      "productQuad": []
    },
    "createdAt": "2026-03-27T00:00:00.000Z",
    "updatedAt": "2026-03-27T00:00:00.000Z"
  }
}
```

### 4.3 创建模板

- `POST /api/templates`

请求体：

```json
{
  "name": "场景图",
  "enabled": true,
  "payload": {
    "config": {},
    "productQuad": []
  }
}
```

### 4.4 更新模板（单条更新）

- `PATCH /api/templates/:id`

可选字段：`name/order/enabled/payload`

请求示例：

```json
{
  "order": 2,
  "enabled": false
}
```

### 4.5 删除模板

- `DELETE /api/templates/:id`

响应：

```json
{ "ok": true }
```

## 5. 资源上传接口

### 上传背景图到本地（模板可持久化使用）

- `POST /api/assets/background`
- `Content-Type: multipart/form-data`
- 字段名：`file`

响应：

```json
{ "path": "/uploads/backgrounds/xxx.png" }
```

该路径可直接写入 `config.backgroundImageUrl`。

## 6. 生成接口

## 6.1 批量生成（默认只跑 enabled=true）

- `POST /api/render/batch`

请求体：

```json
{
  "productImageUrl": "https://example.com/product.png"
}
```

响应：

```json
{
  "results": [
    {
      "templateName": "场景图",
      "s3Url": "https://...png",
      "error": null
    },
    {
      "templateName": "尺寸对比图",
      "s3Url": null,
      "error": "..."
    }
  ]
}
```

## 6.2 指定模板走 batch（兼容模式）

- 同一个接口：`POST /api/render/batch`
- 额外传 `templateId`

请求体：

```json
{
  "productImageUrl": "https://example.com/product.png",
  "templateId": "template_uuid"
}
```

## 6.3 指定模板生成单张（推荐）

- `POST /api/render/single`

请求体：

```json
{
  "productImageUrl": "https://example.com/product.png",
  "templateId": "template_uuid"
}
```

响应：

```json
{
  "result": {
    "templateName": "场景图",
    "s3Url": "https://...png",
    "error": null
  }
}
```

## 7. curl 示例

### 创建模板

```bash
curl -X POST "http://localhost:3001/api/templates" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"场景图",
    "enabled":true,
    "payload":{"config":{},"productQuad":[]}
  }'
```

### 批量生成

```bash
curl -X POST "http://localhost:3001/api/render/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "productImageUrl":"https://example.com/product.png"
  }'
```

### 指定模板单张生成

```bash
curl -X POST "http://localhost:3001/api/render/single" \
  -H "Content-Type: application/json" \
  -d '{
    "productImageUrl":"https://example.com/product.png",
    "templateId":"your_template_id"
  }'
```
