-- This is your baseline schema. 
-- Flyway will skip this on your existing database, but run it on fresh databases.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Paste the rest of your current CREATE TABLE scripts (workspaces, etc.) here!