CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host_id UUID NOT NULL REFERENCES users(id),
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_files (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL REFERENCES rooms(id),
    file_name VARCHAR(255) NOT NULL,
    content TEXT,
    language VARCHAR(50) NOT NULL,
    updated_at TIMESTAMP
);