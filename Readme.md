# ⚡ Vylop

A high-performance, real-time code collaboration platform built for the modern web. Vylop enables developers to conduct remote technical interviews, pair programming sessions, and collaborative debugging in a fully synchronized environment. Powered by CRDTs (Conflict-free Replicated Data Types), code changes, cursor positions, and chat messages are mathematically resolved and broadcast instantly to all participants via persistent WebSocket connections.

---

## ✅ Features

- 🔴 **CRDT-Powered Collaborative Editing** — Multiple users can edit code simultaneously with zero merge conflicts, backed by Yjs and live remote cursor tracking.
- 📁 **Advanced Workspace Management** — Create empty files, mass-upload local files with automatic extension validation, and safely delete files synchronized across all clients.
- ▶️ **Code Execution Engine** — Run code in real-time across multiple languages (Java, Python, C++, JavaScript, TypeScript, Go, Rust).
- 🔒 **Environment Secrets** — Securely inject environment variables (API keys, DB credentials) into your execution environment without saving them to the codebase.
- 📦 **One-Click Export** — Package and download your entire multi-file workspace instantly as a `.zip` archive.
- 📝 **Live Markdown Preview** — Write documentation side-by-side with a real-time rendered Markdown viewer.
- 💬 **Integrated Chat** — Dedicated sidebar for text communication and typing indicators during coding sessions.
- ☁️ **Workspace Persistence** — Save and restore your workspace from the cloud, with smart orphan-cleanup algorithms to prevent database memory leaks.
- 🔐 **Authentication** — Supports both username/password login and Google OAuth2.
- ⌨️ **Vim Mode** — Toggle Vim keybindings inside the Monaco editor.

---

## 🏗 Architecture Overview

Vylop uses an event-driven architecture built around persistent Full-Duplex WebSocket communication, moving beyond traditional HTTP request-response cycles.

### Backend
- **Java & Spring Boot 3** — Core application framework.
- **STOMP over WebSockets** — Manages concurrent user sessions and connection lifecycles. The STOMP controllers are optimized to act as raw, high-throughput binary relays to prevent JSON serialization corruption during CRDT state updates.
- **Spring Security + OAuth2** — Google OAuth2 integration for social login alongside standard username/password authentication.
- **PostgreSQL** — Persistent storage for user profiles, room metadata, and saved workspaces.
- **Docker** — Containerized for consistent local and production environments.

### Frontend
- **React.js + Vite** — Fast, reactive UI with near-instant load times.
- **Monaco Editor** — The same engine powering VS Code, providing professional-grade syntax highlighting and editing.
- **Yjs & y-monaco** — Peer-to-peer shared memory engine handling distributed mathematical conflict resolution.
- **SockJS + STOMP.js** — WebSocket client for real-time synchronization.
- **Tailwind CSS** — Utility-first styling.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Java 17+
- Node.js 18+
- PostgreSQL
- Docker (optional)

### Backend Setup
```bash
cd backend
# Configure your database in src/main/resources/application.properties
# Set: spring.datasource.url, spring.datasource.username, spring.datasource.password
mvn spring-boot:run
```

### Frontend Setup
```Bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:8080`.

---

## 🌐 Deployment & Infrastructure

- **Cloud Hosting** — Deployed on [Render](https://render.com) using a Blueprint (`render.yaml`) to provision the web service and managed PostgreSQL database as a single infrastructure unit
- **Containerization** — Docker ensures 1:1 parity between local and production environments
- **Frontend** — Built with Vite and served as a static site via Render's CDN

---

## 🗺 Roadmap

- [ ] Voice communication during coding sessions
- [ ] AI code suggestions and explanations
- [ ] Room history and playback
- [ ] Custom themes and editor settings persistence

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | Java, Spring Boot, Spring Security, WebSocket/STOMP |
| Frontend | React, Vite, Monaco Editor, Tailwind CSS |
| Database | PostgreSQL |
| Auth | Google OAuth2, Username/Password |
| Deployment | Render, Docker |
