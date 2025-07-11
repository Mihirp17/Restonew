-- Fix table_sessions status default value to 'waiting' to match schema
ALTER TABLE "table_sessions" ALTER COLUMN "status" SET DEFAULT 'waiting';

-- Update existing sessions that were created with 'active' status but have no orders to 'waiting'
UPDATE "table_sessions" 
SET "status" = 'waiting' 
WHERE "status" = 'active' 
AND NOT EXISTS (
  SELECT 1 FROM "orders" o 
  WHERE o."table_session_id" = "table_sessions"."id"
); 