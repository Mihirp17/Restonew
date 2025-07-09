-- Add missing columns to users table
ALTER TABLE "users" 
ADD COLUMN IF NOT EXISTS "first_name" text,
ADD COLUMN IF NOT EXISTS "last_name" text,
ADD COLUMN IF NOT EXISTS "profile_image_url" text,
ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS "last_login" timestamp;

-- Add missing columns to menu_items table
ALTER TABLE "menu_items"
ADD COLUMN IF NOT EXISTS "category" text;

-- Add missing columns to orders table
ALTER TABLE "orders"
ALTER COLUMN "status" TYPE text CHECK (status IN ('pending', 'confirmed', 'preparing', 'served', 'completed', 'cancelled'));

-- Add missing columns to subscriptions table
ALTER TABLE "subscriptions"
ALTER COLUMN "status" TYPE text CHECK (status IN ('active', 'canceled', 'past_due')),
ALTER COLUMN "plan" TYPE text CHECK (plan IN ('basic', 'premium'));

-- Add missing columns to platform_admins table
ALTER TABLE "platform_admins"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add missing columns to restaurants table
ALTER TABLE "restaurants"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add missing columns to tables table
ALTER TABLE "tables"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add missing columns to menu_items table
ALTER TABLE "menu_items"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add missing columns to orders table
ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add missing columns to order_items table
ALTER TABLE "order_items"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add missing columns to feedback table
ALTER TABLE "feedback"
ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL; 