-- Migration: Add unique constraint for bills per customer per session
-- Ensures only one bill can be created per customer per table session

BEGIN;

-- Add unique constraint to bills table
-- This prevents multiple bills for the same customer in the same session
ALTER TABLE "bills" 
ADD CONSTRAINT "unique_customer_session_bill" 
UNIQUE ("customer_id", "table_session_id");

COMMIT; 