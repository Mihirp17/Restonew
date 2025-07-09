-- Migration: Add ai_chat_sessions table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER NOT NULL,
    user_id INTEGER,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    last_message_at TIMESTAMP DEFAULT NOW(),
    message_count INTEGER DEFAULT 1,
    CONSTRAINT fk_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);

-- Index for fast lookup by restaurant and time
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_restaurant_time ON ai_chat_sessions (restaurant_id, last_message_at);
