# ⚡ Vylop

A high-performance, real-time code collaboration platform built for the modern web. Vylop enables developers to conduct remote technical interviews and pair programming sessions in a fully synchronized environment — code changes, cursor positions, and chat messages are broadcast instantly to all participants via persistent WebSocket connections.

---

## ✅ Features

- 🔴 **Real-time Collaborative Editing** — Multiple users can edit code simultaneously with live cursor tracking and colored presence indicators
- 💬 **Integrated Chat** — Dedicated sidebar for text communication during coding sessions
- ▶️ **Code Execution Engine** — Run code in real-time across multiple languages (Java, Python, C++, JavaScript, TypeScript, Go, Rust)
- ☁️ **Workspace Persistence** — Save and restore your workspace from the cloud at any time
- 🔐 **Authentication** — Supports both username/password login and Google OAuth2
- 🗂️ **Multi-file Support** — Create, rename, and delete files within a room
- ⌨️ **Vim Mode** — Toggle Vim keybindings inside the Monaco editor
- 📥 **File Download** — Download any file directly from the editor

---

## 🏗 Architecture Overview

Vylop uses an event-driven architecture built around persistent Full-Duplex WebSocket communication, moving beyond traditional HTTP request-response cycles.

### Backend
- **Java & Spring Boot 3** — Core application framework
- **STOMP over WebSockets** — Manages concurrent user sessions, connection lifecycles, and real-time code broadcasting to all room subscribers
- **Spring Security + OAuth2** — Google OAuth2 integration for social login alongside standard username/password authentication
- **PostgreSQL** — Persistent storage for user profiles, room metadata, and saved workspaces
- **Docker** — Containerized for consistent local and production environments

### Frontend
- **React.js + Vite** — Fast, reactive UI with near-instant load times
- **Monaco Editor** — The same engine powering VS Code, providing professional-grade syntax highlighting and editing
- **SockJS + STOMP.js** — WebSocket client for real-time synchronization
- **Tailwind CSS** — Utility-first styling

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
```bash
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
- [ ] Flyway migrations for version-controlled database schema changes
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