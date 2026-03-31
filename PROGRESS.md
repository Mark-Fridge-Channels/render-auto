# 商品图生成器 模板化与服务化 — 进度

> 动态跟踪实现进度（`/execute` 约定）。

## 总览

- **总体进度**：🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜ **90%**
- **当前阶段**：手绘产品内光影区域（模板 + 预览 + Headless 缩放一致）

## 任务状态

| 任务 | 状态 |
|------|------|
| Task 1 SQLite 模板存储（name/order/enabled/payload） | ✅ 完成 |
| Task 2 模板 CRUD API（单条更新、排序、启用状态） | ✅ 完成 |
| Task 3 批量 API（只跑 enabled=true，同步等待返回） | ✅ 完成 |
| Task 4 Headless Chromium 渲染（`window.__RENDER_PAYLOAD__`） | ✅ 完成 |
| Task 5 S3 上传（按约定 key 组织） | ✅ 完成 |
| Task 6 前端模板列表与排序/启用 | ✅ 完成 |
| Task 7 前端批量入口（`productImageUrl`） | ✅ 完成 |
| Task 8 页面拆分（模板管理独立页、生成页仅保存/编辑） | ✅ 完成 |
| Task 9 手绘闭合区域 + 内/外阴影（仅产品裁剪内，抬笔自动闭合，定稿不可拖形） | ✅ 完成 |

## 更新日志

- **2026-03-27**：完成模板化服务骨架（SQLite + Express + Chromium + S3）并接入前端模板管理。
- **2026-03-27**：完成页面重构：模板管理迁移到 `/templates`，生成页保留保存模板与编辑回填能力。
- **2026-03-30**：Task 9 — `productBrushShadow` 写入模板 payload；编辑器叠加 `BrushShadowOverlay`；`ProductWarpCanvas` 在圆角 quad clip 内绘制；`server/render.ts` 对笔刷点与 blur/offset 做导出比例缩放。

## 使用说明（简）

- 前端：`npm run dev`
- API：`npm run dev:api`
- 批量接口：`POST /api/render/batch`，字段 `productImageUrl`。
