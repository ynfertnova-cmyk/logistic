# 智能剪贴板提取工具 · 多人协作版

> 部门成员可通过链接访问，将剪贴板内容（文本/图片/Excel）进行 AI 智能提取，数据实时汇总到一个 Excel 文件。

## 🎯 核心功能

- ✅ **多格式支持** — 文本、图片、Excel 三种来源混合使用
- ✅ **AI 字段识别** — 自动从剪贴板内容识别出你需要的所有字段
- ✅ **多人协作** — 全部门成员共享一个服务，数据实时汇总
- ✅ **一键导出** — 导出包含所有人提交数据的 Excel 文件
- ✅ **支持多个 AI 服务** — OpenAI、DeepSeek、通义千问、智谱 AI 等

---

## 🚀 快速开始（本地测试）

### 前置要求
- Node.js 18+
- 一个 AI API Key（推荐 DeepSeek：https://platform.deepseek.com）

### 安装和启动

```bash
cd clipboard-extractor-server

# 安装依赖
npm install

# 启动服务
npm start

# 浏览器访问
open http://localhost:3000
```

### 首次使用步骤

1. **配置 AI** — 选择 AI 提供商，填入 API Key 和模型名
2. **上传模板** — 上传一个 Excel 文件，第一行是列标题（如：姓名、日期、合同编号、金额等）
3. **粘贴内容** — 按 Ctrl+V / ⌘V 粘贴内容（或拖入文件）
4. **提取并提交** — 点击「✨ AI 提取」，AI 自动填充各字段，点击「⬆ 提交到汇总」
5. **查看汇总** — 切换到「📋 所有记录」标签页查看全部人员数据
6. **导出 Excel** — 点击「⬇ 导出 Excel」下载包含所有人数据的文件

---

## 📦 部署到云端（Railway）

### 方案说明

使用 **Railway** 平台可以免费/廉价地部署这个应用，部署后会得到一个公网 URL（如 `https://xxx.railway.app`），全部门员工可以通过这个链接访问。

### 部署步骤

#### 1️⃣ 准备 Git 仓库

```bash
# 在项目目录初始化 git（如果还没有）
git init
git add .
git commit -m "Initial commit: clipboard extractor server"
```

#### 2️⃣ 创建 Railway 账号和项目

- 访问 https://railway.app
- 用 GitHub / GitLab / Google 账号登录
- 点击「New Project」→ 「Deploy from GitHub」
- 选择或连接你的 GitHub 仓库

#### 3️⃣ 配置部署

如果选择从 GitHub 部署：
- Railway 会自动检测 `Dockerfile`，按 Docker 方式构建
- 等待构建完成（约 1-2 分钟）
- 构建成功后，点击「View」即可看到已部署的应用

或者使用 Railway CLI（更便捷）：

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 部署当前项目
railway up

# 查看日志
railway logs

# 获取部署 URL
railway open
```

#### 4️⃣ 分享链接给部门

部署完成后，你会获得一个 Railway 应用 URL（如 `https://clipboard-extractor.up.railway.app`），分享给全部门成员即可使用。

---

## 🔑 AI 提供商推荐

| 提供商 | 支持模型 | 优势 | 价格 |
|--------|---------|------|------|
| **DeepSeek** | deepseek-chat | 中文友好、便宜 | $0.5-$1/M token |
| **OpenAI** | gpt-4o | 识别准确 | $5-$15/M token |
| **通义千问** | qwen-vl-max | 图片识别好 | 免费额度/月 |
| **智谱 AI** | glm-4v | 图片识别、中文 | 免费额度/月 |

**推荐新手使用 DeepSeek**（注册后有免费额度，便宜且中文效果好）

---

## 📋 API 接口文档（用于自定义集成）

### 1. 上传 Excel 模板
```
POST /api/template
Content-Type: multipart/form-data

参数: file (Excel 文件)

返回:
{
  "success": true,
  "filename": "模板.xlsx",
  "headers": ["姓名", "日期", "金额"]
}
```

### 2. 提交提取结果
```
POST /api/records
Content-Type: application/json

{
  "submitter": "张三",
  "data": {
    "姓名": "李四",
    "日期": "2025-03-27",
    "金额": "1000"
  },
  "sourcePreview": "原始内容摘要"
}

返回:
{ "success": true, "id": 123 }
```

### 3. 获取所有记录
```
GET /api/records

返回:
[
  {
    "id": 1,
    "submitter": "张三",
    "data": { "姓名": "李四", ... },
    "created_at": "2025-03-27T10:30:00Z"
  },
  ...
]
```

### 4. 导出汇总 Excel
```
GET /api/export

返回: 下载 Excel 文件
```

### 5. 获取当前模板信息
```
GET /api/template

返回:
{
  "filename": "模板.xlsx",
  "headers": ["姓名", "日期", "金额"]
}
```

---

## 🛠 本地开发 / 调试

### 项目结构
```
clipboard-extractor-server/
├── server.js              # Express 服务主文件
├── public/
│   └── index.html         # 前端页面（所有逻辑都在这个单文件里）
├── data/                  # SQLite 数据库存储目录
├── package.json
├── Dockerfile             # Docker 构建文件
├── railway.toml           # Railway 部署配置
└── .gitignore
```

### 本地数据库
- 数据库文件存储在 `./data/records.db`
- 可用 SQLite 工具（如 DB Browser）打开查看

### 环境变量
- `PORT`（默认 3000）— 服务端口

---

## ⚠️ 注意事项

1. **API Key 安全** — 请勿在 GitHub 上提交包含真实 API Key 的配置，建议使用环境变量
2. **数据隐私** — 使用云端部署时，服务器会存储提交的数据，请确保符合你的隐私政策
3. **Railway 免费额度** — Railway 提供每月 $5 的免费额度，足以支撑小规模使用
4. **Excel 导出** — 导出时会追加新数据到模板文件，原有数据保留

---

## 🐛 故障排查

### 应用启动失败
```bash
# 检查依赖安装
npm install

# 检查 Node 版本
node --version  # 需要 18+
```

### 无法连接到 AI API
- 检查 API Key 是否正确
- 检查网络连接
- 尝试更换 AI 提供商

### 导出 Excel 出现编码问题
- 确保上传的模板 Excel 格式正确（.xlsx）
- 重新上传模板后再导出

---

## 📞 技术支持

遇到问题？检查以下步骤：
1. 查看本地服务日志：`npm start` 会输出错误信息
2. 打开浏览器开发者工具（F12），查看网络和控制台错误
3. 确保所有依赖都已安装：`npm install`

---

**祝使用愉快！🎉**
