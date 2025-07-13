-- Add displayOrderNumber column to orders table
ALTER TABLE "orders" ADD COLUMN "display_order_number" integer;
 
-- Create index for the new column
CREATE INDEX "orders_display_order_number_idx" ON "orders" ("display_order_number"); 