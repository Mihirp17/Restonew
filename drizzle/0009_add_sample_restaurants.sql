-- Add sample restaurants for development and testing
INSERT INTO "restaurants" (
    "name",
    "slug",
    "description",
    "email",
    "password",
    "is_active"
) VALUES (
    'Sample Restaurant 1',
    'sample-restaurant-1',
    'A cozy restaurant for testing purposes',
    'sample1@test.com',
    '$2a$10$XqV9NzS9JU8PyV7NZ9xqW.x9G9xK3V9P9QGZXxGT1NDyuHqZ9HmKe', -- password: test123
    true
),
(
    'Sample Restaurant 2',
    'sample-restaurant-2',
    'Another great restaurant for development',
    'sample2@test.com',
    '$2a$10$XqV9NzS9JU8PyV7NZ9xqW.x9G9xK3V9P9QGZXxGT1NDyuHqZ9HmKe', -- password: test123
    true
);

-- Add some sample tables for each restaurant
INSERT INTO "tables" (
    "number",
    "qr_code",
    "restaurant_id",
    "capacity"
) 
SELECT 
    t.table_number,
    CONCAT('qr_', r.id, '_', t.table_number),
    r.id,
    4
FROM "restaurants" r
CROSS JOIN (
    SELECT generate_series(1, 5) as table_number
) t;

-- Add some basic menu items for each restaurant
INSERT INTO "menu_items" (
    "name",
    "description",
    "price",
    "category",
    "is_available",
    "restaurant_id"
)
SELECT
    item.name,
    item.description,
    item.price,
    item.category,
    true,
    r.id
FROM "restaurants" r
CROSS JOIN (
    VALUES 
        ('Margherita Pizza', 'Classic tomato and mozzarella pizza', 12.99, 'Pizza'),
        ('Pepperoni Pizza', 'Spicy pepperoni with cheese', 14.99, 'Pizza'),
        ('Caesar Salad', 'Fresh romaine lettuce with caesar dressing', 8.99, 'Salads'),
        ('Greek Salad', 'Mixed vegetables with feta cheese', 9.99, 'Salads'),
        ('Chocolate Cake', 'Rich chocolate layer cake', 6.99, 'Desserts')
) as item(name, description, price, category);
