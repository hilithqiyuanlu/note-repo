# 豆脑 0.4

豆脑是一个本地优先的三栏知识工作台，用来整理网页、YouTube、PDF 等来源，并围绕这些资料做摘要、问答与引用定位。

0.4 版本重点收口了四件事：

- 进入笔记页更快：线程拆成摘要与详情，远端模型目录改成懒加载，来源详情只在真正查看时才拉取。
- 远端请求支持代理：可在设置页填写 Clash Verge 代理信息，远端模型、网页抓取、YouTube、Tavily 都能统一走代理。
- 本地大模型可选：内置 Ollama `qwen3.5:4b` 作为聊天可选项，不会替换当前默认 Gemini。
- 交互动效更稳：收起、展开和宽屏切换统一使用一套 motion token，并支持 `prefers-reduced-motion` 降级。

## 启动

### 开发模式

```bash
cd /Users/luqiyuan/Documents/Codex/cuflow
npm install
npm run dev -- --port 3001
```

开发模式支持热更新，适合调界面和交互。

### 生产模式

```bash
cd /Users/luqiyuan/Documents/Codex/cuflow
npm install
npm run build
npm run start -- --port 3001
```

`start` 只读取最近一次 `build` 的产物。改完代码但没重新 `build` 时，页面会继续显示旧版本。

## 主要设置

设置页现在分为五块：

### 1. 远端聊天模型

- `Chat Provider`
- `默认聊天模型`
- `Chat Base URL`
- `Chat API Key`

当前默认配置保持为 Gemini 远端模型。

### 2. 本地聊天模型

- `启用本地聊天模型`
- `本地服务地址`
- `本地模型名`
- `本地模型显示名`

默认已预置：

- `localChatEnabled = true`
- `localChatBaseUrl = http://127.0.0.1:11434/v1`
- `localChatModel = qwen3.5:4b`
- `localChatLabel = Ollama / qwen3.5:4b`

这表示聊天模型下拉中会新增一个本地 Ollama 选项，但默认聊天仍保留当前 Gemini。

### 3. Embedding

- `Embedding Provider`
- `Embedding Model`
- `Embedding Base URL`
- `Embedding API Key`

默认继续使用本地 Ollama embedding。

### 4. 网络 / 代理

用于让所有远端请求走 Clash Verge 代理。

默认示例：

- `协议: http`
- `Host: 127.0.0.1`
- `Port: 7897`
- `Bypass Hosts: localhost,127.0.0.1,::1`

代理覆盖范围：

- Gemini / 远端 OpenAI 兼容模型
- 远端模型目录
- Tavily 搜索
- 网页抓取
- YouTube 元信息与字幕相关请求

不会走代理的请求：

- `localhost`
- `127.0.0.1`
- `::1`
- 本地 Ollama
- 本地文件服务

### 5. 搜索与导出

- `Tavily API Key`
- `Markdown 导出目录`

## 常见问题

### 为什么进入笔记页以前会卡？

旧版本会在首屏同步做三件重活：

- 拉完整远端模型目录
- 把所有线程的全部消息一次性查出来
- 选中来源时立即拉详情

0.4 已改成：

- 首屏只给最小模型集，完整远端模型目录在页面进入后再懒加载
- 线程列表只返回摘要，具体消息按需拉
- 来源详情只在真正进入查看态时才请求

### 为什么 `npm run start` 看不到最新改动？

因为 `start` 读取的是 `.next` 里的生产构建产物。正确流程是：

```bash
npm run build
npm run start -- --port 3001
```

如果你只是确认最新前端改动，优先用：

```bash
npm run dev -- --port 3001
```

### 本地 Ollama 为什么不走代理？

这是刻意设计。0.4 默认只让远端请求走 Clash Verge，避免本地 `127.0.0.1:11434` 被错误代理而失效。

## 验证命令

```bash
npm run lint
npm run build
```

当前仓库的 `lint` 实际执行的是 TypeScript 静态检查：`tsc --noEmit`。
