<h1 align="center">Algo Todo</h1>

<p align="center"><strong>List meets graph—tasks as an experiment pipeline, not a flat checklist.</strong></p>

<p align="center">
  Algo Todo is a dark, <strong>ComfyUI</strong>-inspired workspace for <strong>algorithm engineers</strong>: switch between a crisp <strong>list</strong> and a <strong>node-graph canvas</strong> (<code>@xyflow/react</code>), with folders, tags, and auth. Data is designed around <strong>Postgres on Supabase</strong> and a <strong>serverless</strong> host (e.g. Vercel)—so your graph survives redeploys instead of living only in ephemeral memory.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#documentation-and-links">Docs &amp; links</a> ·
  <a href="#environment-variables">Environment</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="#中文摘要">中文</a> ·
  <a href="https://github.com/evian999/algo-todo-list/issues">Issues</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_Flow-Canvas-1488C6?logo=react&logoColor=white" alt="Canvas" />
  <img src="https://img.shields.io/badge/Vercel-Ready-000000?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white" alt="Supabase" />
</p>

<p align="center">
  <strong>List</strong> · <strong>Canvas</strong> · <strong>Folders &amp; tags</strong> · <strong>Auth</strong>
</p>

---

## Table of contents

- [Features](#features)
- [Built with](#built-with)
- [Why Algo Todo?](#why-algo-todo)
- [Documentation and links](#documentation-and-links)
- [Security](#security)
- [Environment variables](#environment-variables)
- [Repository layout](#repository-layout)
- [Contributing](#contributing)
- [Inspiration](#inspiration)
- [中文摘要](#中文摘要)
- [License](#license)

---

## Features

- **Dual mode** — `L` / `C` to jump between list view and the canvas.
- **Folders & tags** — sidebar in list; folder lanes on the graph; toolbar filters.
- **Completion flow** — mark done, capture **results** and **next steps**, link or spawn tasks; edges stay consistent on the canvas.
- **Dark “node editor” look** — grid, cyan accents, glass panels for long sessions.

---

## Built with

- [Next.js](https://nextjs.org/)
- [React Flow](https://reactflow.dev/) (`@xyflow/react`)
- [Supabase](https://supabase.com/) (Postgres + server-side client)
- [jose](https://github.com/panva/jose) (JWT sessions)
- [Zustand](https://github.com/pmndrs/zustand) (client state)
- [Vercel](https://vercel.com/) (typical host)

---

## Why Algo Todo?

Many teams outgrow a flat todo list when work looks like a **graph**: dependencies, ablations, “what we ran” and “what’s next.” Pure canvas tools are expressive; on **serverless** hosts, anything that only lives in memory or on disk disappears after a cold start.

Algo Todo sits in the middle:

1. **Relational Postgres (Supabase)** — tasks, folders, tags, groups, edges, and layout are **normalized rows** per user. A single RPC (`replace_user_app_data`) applies a full snapshot in **one transaction**, so list and graph do not drift apart.
2. **Serverless-friendly** — no VM to patch; connect env vars and ship.
3. **Optional Redis (e.g. Upstash)** — login records are **not** in Supabase; on hosts without a persistent disk, Redis keeps **accounts** durable while **todo data** stays in Postgres.

We optimize for **honest constraints**, **small surface area**, and a codebase you can **fork** without a platform lecture.

---

## Documentation and links

| Resource | Description |
| -------- | ----------- |
| [`.env.example`](.env.example) | Environment variable names and short comments (no secrets in git). |
| [`supabase/migrations/`](supabase/migrations/) | SQL migrations—run **in filename order** in the Supabase SQL editor (`001` → `002_task_priority` → `002_user_preferences_task_api`). Skipping files often leads to **503** after login. |
| [Next.js docs](https://nextjs.org/docs) | App Router, API routes, deployment. |
| [Supabase docs](https://supabase.com/docs) | Postgres, API keys, SQL. |
| [React Flow](https://reactflow.dev/) | Canvas / node graph primitives. |

---

## Security

- Use a **strong `AUTH_SECRET`** in production; weak defaults are unsafe on the public internet.
- **`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS** — Vercel (or any server) env only; never in the browser or client bundles. Use the **`service_role`** JWT (`eyJ…`) or a Supabase **secret** key—not the **publishable / anon** key.
- Optional `DEFAULT_AUTH_USERNAME` / `DEFAULT_AUTH_PASSWORD` seed the first user when the store is empty; passwords are **hashed** before save—never commit real secrets.

---

## Environment variables

| Variable | Production | Description |
| -------- | ---------- | ----------- |
| `AUTH_SECRET` | Required | Session JWT signing secret. |
| `SUPABASE_URL` | Required* | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required* | Server admin key (`service_role` or secret). |
| `UPSTASH_REDIS_REST_URL` | Strongly recommended on Vercel | Persistent auth user store. |
| `UPSTASH_REDIS_REST_TOKEN` | Strongly recommended on Vercel | Paired with Redis URL. |
| `DEFAULT_AUTH_USERNAME` | Optional | Bootstrap username. |
| `DEFAULT_AUTH_PASSWORD` | Optional | Bootstrap password (hashed). |

\*Required for the recommended Supabase-backed setup.

---

## Repository layout

```
src/app/           # Routes, API: auth, data
src/components/    # List, canvas, sidebar, nodes
src/lib/           # Store, session, users, validation
src/lib/supabase/  # Admin client, load/save relational data
middleware.ts      # JWT gate for / and /api/data
supabase/migrations/
```

---

## Contributing

Contributions are welcome—bugfixes, docs, and small UX improvements especially.

- **Bugs:** [open an issue](https://github.com/evian999/algo-todo-list/issues/new) with steps to reproduce if you can.
- **Features:** describe your workflow (list vs canvas, teams, sync); larger ideas are easier to align on before a big PR.

If the project grows, we can add a `CONTRIBUTING.md` with build and PR conventions (similar to [Logseq](https://github.com/logseq/logseq/blob/master/CONTRIBUTING.md) / [MarkText](https://github.com/marktext/marktext/blob/develop/CONTRIBUTING.md) style guides).

---

## Inspiration

UX and metaphors owe a debt to **node-based** tools (e.g. **ComfyUI**-style layouts) and to **outliner / graph** note workflows (think **Logseq**-style linking, even though Algo Todo is not a notes app). The README structure borrows ideas from projects like **AppFlowy**, **MarkText**, and **Joplin**: clear **TOC**, **features** up front, **documentation tables**, and an explicit **why** section.

---

## 中文摘要

**Algo Todo**：面向算法与实验场景的待办应用——**列表 / 画布**双模式、**文件夹与标签**、完成时可记录**结果与下一步**并保持连线同步。数据侧推荐 **Supabase Postgres**（按用户关系存储）；在 **Vercel** 等无持久磁盘环境建议同时配置 **Upstash Redis**（`UPSTASH_REDIS_REST_*`）以持久化**登录账号**。SQL 请在 Supabase 中**按顺序**执行 `supabase/migrations/` 下三个文件；环境变量见上文及 [`.env.example`](.env.example)（**`SUPABASE_SERVICE_ROLE_KEY` 须为 service_role，勿用 publishable/anon**）。

---

## License

[**MIT**](LICENSE) — add a `LICENSE` file if you want the text tracked in the repo.

---

<p align="center">
  Built with curiosity for people who think in graphs and ablations.
</p>
