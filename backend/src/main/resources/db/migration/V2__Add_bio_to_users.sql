-- Flyway will execute this file immediately on startup and record it in the ledger.

ALTER TABLE users 
ADD COLUMN bio VARCHAR(500);