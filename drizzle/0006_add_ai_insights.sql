-- Migration: Add ai_insights table
CREATE TABLE ai_insights (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  recommendations TEXT[],
  data_source JSONB,
  confidence NUMERIC(5,2),
  priority VARCHAR(16) NOT NULL DEFAULT 'medium',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  implementation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_insights_restaurant_id ON ai_insights(restaurant_id); 