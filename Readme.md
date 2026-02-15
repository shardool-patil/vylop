⚡ Vylop
A full-stack, real-time code collaboration tool built to solve the challenge of remote technical interviewing.

🏗 Architecture Overview
CollabEditor moves beyond standard HTTP Request-Response cycles by implementing persistent Full-Duplex Communication:

Backend: Built on Java 17 & Spring Boot 3, utilizing the STOMP protocol over WebSockets to handle concurrent user sessions. It manages connection lifecycles and broadcasts operational transforms to active subscribers.

Frontend: A reactive React.js interface integrating the Monaco Editor. It listens for WebSocket events to update the DOM in real-time without page reloads.

Data Persistence: Uses MySQL for persistent storage of code snippets and user profiles, with an optimized schema to handle file versioning.
