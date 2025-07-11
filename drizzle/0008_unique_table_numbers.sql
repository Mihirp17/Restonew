-- Add unique constraint for table numbers within each restaurant
ALTER TABLE "tables" ADD CONSTRAINT "unique_table_number_per_restaurant" UNIQUE("number", "restaurant_id");
