# Algo Todo

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_Flow-Canvas-1488C6?logo=react&logoColor=white" alt="Canvas" />
  <img src="https://img.shields.io/badge/Vercel-Ready-000000?logo=vercel&logoColor=white" alt="Vercel" />
</p>

**Algo Todo** is a dark, ComfyUI-inspired task workspace for **algorithm engineers**: switch between a crisp **list mode** (newest first, folders, tags) and a **node-graph canvas** where tasks connect like experiment pipelines. Data persists to JSON locally; on serverless hosts it falls back to in-memory storage with JWT auth.

<p align="center">
  <strong>List</strong> · <strong>Canvas</strong> · <strong>Folders & tags</strong> · <strong>Auth</strong>
</p>

---

## Why it feels good

- **Dual mode**: keyboard `L` / `C` to jump between list and `@xyflow/react` canvas.
- **Folders & tags**: left sidebar in list view; canvas lanes group tasks by folder; filter from the canvas toolbar.
- **Completion flow**: mark done → capture **results** and **next steps** (link to existing tasks or spawn new ones); edges stay in sync on the graph.
- **Dark “node editor” aesthetic**: grid, cyan accents, glassy panels—built for long evening sessions.
- **Lightweight persistence**: `PATCH /api/data` writes `data/store.json` when the filesystem allows; otherwise an in-memory snapshot (typical on **Vercel**—see below).

---

## Default login (demo)

| Field    | Value   |
| -------- | ------- |
| Username | `evain` |
| Password | `990423` |

The first login **seeds** this account (password is stored **hashed**). Override with env vars if needed:

```bash
DEFAULT_AUTH_USERNAME=you
DEFAULT_AUTH_PASSWORD=your-secure-password
```

> **Production:** set a strong `AUTH_SECRET` (used to sign session JWTs). The repo ships with a dev fallback—**do not** rely on it in production.

---

## Quick start

```bash
npm ci
cp .env.example .env.local
# edit .env.local — at minimum set AUTH_SECRET for anything public-facing
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to `/login`.

---

## Environment variables

| Variable                 | Required on Vercel | Description                          |
| ------------------------ | ------------------ | ------------------------------------ |
| `AUTH_SECRET`            | **Strongly yes**   | Secret for signing `algo-token` JWT. |
| `DEFAULT_AUTH_USERNAME`  | No                 | Overrides default demo username.     |
| `DEFAULT_AUTH_PASSWORD`  | No                 | Overrides default demo password.     |

---

## Deploy on Vercel

1. Push this repo to GitHub (see below).
2. [Import the project](https://vercel.com/new) in Vercel.
3. Add **Environment Variables** → `AUTH_SECRET` = long random string (e.g. `openssl rand -base64 32`).
4. Deploy.

**Persistence note:** Vercel’s filesystem is ephemeral. Task data is kept **in memory per instance** and resets when the function cold-starts. For durable cloud storage, plug in a database or KV later—the API shape is already JSON-friendly.

---

## Scripts

| Command       | Description        |
| ------------- | ------------------ |
| `npm run dev` | Turbopack dev server |
| `npm run build` | Production build   |
| `npm run start` | Start production server |
| `npm run lint`  | ESLint             |

---

## Project structure (high level)

```
src/
  app/
    (auth)/login, register    # Auth UI
    (dashboard)/              # Main app at /
    api/auth/*                # login, register, logout
    api/data                  # JSON store (+ memory fallback)
  components/                 # List, canvas, sidebar, nodes
  lib/                        # Zustand store, users, session (jose), validation
  middleware.ts               # JWT gate for / and /api/data
data/                         # Local JSON (gitignored when generated)
```

---

## 中文摘要

**Algo Todo** 是面向算法工程师的待办应用：支持**列表 / 画布**双模式、**文件夹与标签**、完成时记录**结果与下一步**并在画布上显示连线。已加入 **登录 / 注册**（默认账号 `evain` / `990423`，密码服务端哈希存储）。本地开发使用 `data/store.json`；部署到 **Vercel** 时请配置 `AUTH_SECRET`，并注意无持久磁盘时数据仅在内存中保留。

---

## License

MIT（如未特别指定，可按你的仓库策略自行添加 `LICENSE` 文件。）

---

<p align="center">
  Built with curiosity for people who think in graphs and ablations.
</p>
