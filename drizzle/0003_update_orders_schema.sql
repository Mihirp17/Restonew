BEGIN;

-- Make customerId and tableSessionId optional for backward compatibility
-- Add customerName field for legacy orders
DO $$
BEGIN
    -- Add customerName column if it doesn't exist (do this first)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE orders ADD COLUMN customer_name TEXT;
    END IF;

    -- Drop foreign key constraints first
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_customer_id_customers_id_fk' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT orders_customer_id_customers_id_fk;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_table_session_id_table_sessions_id_fk' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT orders_table_session_id_table_sessions_id_fk;
    END IF;

    -- Ensure customerId and tableSessionId are NOT NULL to align with shared/schema.ts
    ALTER TABLE orders
        ALTER COLUMN customer_id SET NOT NULL,
        ALTER COLUMN table_session_id SET NOT NULL;

    -- Re-add foreign key constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_customer_id_customers_id_fk' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_customer_id_customers_id_fk 
        FOREIGN KEY (customer_id) REFERENCES customers(id) NOT DEFERRABLE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'orders_table_session_id_table_sessions_id_fk' 
        AND table_name = 'orders'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_table_session_id_table_sessions_id_fk 
        FOREIGN KEY (table_session_id) REFERENCES table_sessions(id) NOT DEFERRABLE;
    END IF;

END $$;

COMMIT;
