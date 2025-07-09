-- Migration: Add unique constraint for active sessions per table
-- Prevents multiple active sessions for the same table

BEGIN;

-- First, clean up any duplicate active sessions that might exist
WITH duplicate_sessions AS (
  SELECT 
    id,
    table_id,
    ROW_NUMBER() OVER (PARTITION BY table_id, restaurant_id ORDER BY start_time ASC) as rn
  FROM table_sessions 
  WHERE status = 'active'
)
UPDATE table_sessions 
SET status = 'completed', end_time = NOW()
WHERE id IN (
  SELECT id FROM duplicate_sessions WHERE rn > 1
);

-- Add partial unique constraint for active sessions per table
-- This prevents multiple active sessions for the same table
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_active_session_per_table 
ON table_sessions (table_id, restaurant_id) 
WHERE status = 'active';

COMMIT; 