-- Add first_order_time column to track when session becomes active
ALTER TABLE "table_sessions" ADD COLUMN "first_order_time" timestamp;

-- Update existing sessions that have orders to set their first_order_time
UPDATE "table_sessions" 
SET "first_order_time" = (
  SELECT MIN(o."created_at") 
  FROM "orders" o 
  WHERE o."table_session_id" = "table_sessions"."id"
)
WHERE "status" = 'active' 
AND EXISTS (
  SELECT 1 FROM "orders" o 
  WHERE o."table_session_id" = "table_sessions"."id"
);

-- Update session status values to include new lifecycle states
-- Note: 'waiting' and 'abandoned' are new states we're introducing
-- Existing 'active' sessions remain as 'active'
-- Sessions without orders become 'waiting'
UPDATE "table_sessions" 
SET "status" = 'waiting' 
WHERE "status" = 'active' 
AND NOT EXISTS (
  SELECT 1 FROM "orders" o 
  WHERE o."table_session_id" = "table_sessions"."id"
);

-- Update split_type to use new values (individual, split_evenly, combined)
-- Map old 'combined' to 'combined', 'custom' to 'individual'
UPDATE "table_sessions" 
SET "split_type" = 'individual' 
WHERE "split_type" = 'custom';
