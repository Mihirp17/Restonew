-- Split Billing Schema Migration
-- This migration adds support for split billing, customer management, and table grouping

BEGIN;

-- First, let's handle table modifications that don't have constraints

-- Add columns to tables table for grouping
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "group_id" integer;
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "capacity" integer DEFAULT 4 NOT NULL;

-- Create table_groups table first (no dependencies)
CREATE TABLE IF NOT EXISTS "table_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "restaurant_id" integer NOT NULL,
  "total_capacity" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create table_sessions table
CREATE TABLE IF NOT EXISTS "table_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "restaurant_id" integer NOT NULL,
  "table_id" integer NOT NULL,
  "group_id" integer,
  "session_name" text,
  "party_size" integer NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "start_time" timestamp DEFAULT now() NOT NULL,
  "end_time" timestamp,
  "total_amount" numeric(10,2) DEFAULT '0.00' NOT NULL,
  "paid_amount" numeric(10,2) DEFAULT '0.00' NOT NULL,
  "bill_requested" boolean DEFAULT false NOT NULL,
  "bill_requested_at" timestamp,
  "split_type" text DEFAULT 'individual' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create customers table
CREATE TABLE IF NOT EXISTS "customers" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "table_session_id" integer NOT NULL,
  "is_main_customer" boolean DEFAULT false NOT NULL,
  "payment_status" text DEFAULT 'pending' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create bills table
CREATE TABLE IF NOT EXISTS "bills" (
  "id" serial PRIMARY KEY NOT NULL,
  "bill_number" text NOT NULL UNIQUE,
  "table_session_id" integer NOT NULL,
  "customer_id" integer,
  "type" text NOT NULL,
  "subtotal" numeric(10,2) NOT NULL,
  "tax" numeric(10,2) DEFAULT '0.00' NOT NULL,
  "tip" numeric(10,2) DEFAULT '0.00' NOT NULL,
  "total" numeric(10,2) NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payment_method" text,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create bill_items table (dropping if exists to avoid conflicts)
DROP TABLE IF EXISTS "bill_items";
CREATE TABLE "bill_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "bill_id" integer NOT NULL,
  "order_item_id" integer NOT NULL,
  "quantity" integer NOT NULL,
  "amount" numeric(10,2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Now modify the orders table structure
-- First, add new columns
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "table_session_id" integer;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "is_group_order" boolean DEFAULT false NOT NULL;

-- Rename customer_name to a temp column and add customer_id reference
-- We'll handle this as a data migration later in the application

-- Add customizations to order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "customizations" text;

-- Add feedback type and customer_id to feedback table
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "customer_id" integer;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "table_session_id" integer;
ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "feedback_type" text DEFAULT 'customer' NOT NULL;

-- Create foreign key constraints (using DO blocks to handle existing constraints)
DO $$ 
BEGIN
    -- Add foreign key for tables.group_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'tables_group_id_table_groups_id_fk'
    ) THEN
        ALTER TABLE "tables" ADD CONSTRAINT "tables_group_id_table_groups_id_fk" 
            FOREIGN KEY ("group_id") REFERENCES "table_groups"("id");
    END IF;

    -- Add foreign key for table_groups.restaurant_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_groups_restaurant_id_restaurants_id_fk'
    ) THEN
        ALTER TABLE "table_groups" ADD CONSTRAINT "table_groups_restaurant_id_restaurants_id_fk" 
            FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");
    END IF;

    -- Add foreign key for table_sessions.restaurant_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_sessions_restaurant_id_restaurants_id_fk'
    ) THEN
        ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_restaurant_id_restaurants_id_fk" 
            FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id");
    END IF;

    -- Add foreign key for table_sessions.table_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_sessions_table_id_tables_id_fk'
    ) THEN
        ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_table_id_tables_id_fk" 
            FOREIGN KEY ("table_id") REFERENCES "tables"("id");
    END IF;

    -- Add foreign key for table_sessions.group_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'table_sessions_group_id_table_groups_id_fk'
    ) THEN
        ALTER TABLE "table_sessions" ADD CONSTRAINT "table_sessions_group_id_table_groups_id_fk" 
            FOREIGN KEY ("group_id") REFERENCES "table_groups"("id");
    END IF;

    -- Add foreign key for customers.table_session_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customers_table_session_id_table_sessions_id_fk'
    ) THEN
        ALTER TABLE "customers" ADD CONSTRAINT "customers_table_session_id_table_sessions_id_fk" 
            FOREIGN KEY ("table_session_id") REFERENCES "table_sessions"("id");
    END IF;

    -- Add foreign key for bills.table_session_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bills_table_session_id_table_sessions_id_fk'
    ) THEN
        ALTER TABLE "bills" ADD CONSTRAINT "bills_table_session_id_table_sessions_id_fk" 
            FOREIGN KEY ("table_session_id") REFERENCES "table_sessions"("id");
    END IF;

    -- Add foreign key for bills.customer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bills_customer_id_customers_id_fk'
    ) THEN
        ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_customers_id_fk" 
            FOREIGN KEY ("customer_id") REFERENCES "customers"("id");
    END IF;

    -- Add foreign key for bill_items.bill_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bill_items_bill_id_bills_id_fk'
    ) THEN
        ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" 
            FOREIGN KEY ("bill_id") REFERENCES "bills"("id");
    END IF;

    -- Add foreign key for bill_items.order_item_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'bill_items_order_item_id_order_items_id_fk'
    ) THEN
        ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_order_item_id_order_items_id_fk" 
            FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id");
    END IF;

    -- Add foreign key for feedback.customer_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'feedback_customer_id_customers_id_fk'
    ) THEN
        ALTER TABLE "feedback" ADD CONSTRAINT "feedback_customer_id_customers_id_fk" 
            FOREIGN KEY ("customer_id") REFERENCES "customers"("id");
    END IF;

    -- Add foreign key for feedback.table_session_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'feedback_table_session_id_table_sessions_id_fk'
    ) THEN
        ALTER TABLE "feedback" ADD CONSTRAINT "feedback_table_session_id_table_sessions_id_fk" 
            FOREIGN KEY ("table_session_id") REFERENCES "table_sessions"("id");
    END IF;

END $$;

-- Note: The orders table customer_id and table_session_id foreign keys will be added 
-- after data migration in the application code

COMMIT; 