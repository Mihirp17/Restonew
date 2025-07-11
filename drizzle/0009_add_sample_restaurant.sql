-- Add a test restaurant
INSERT INTO "restaurants" (
    "name",
    "slug",
    "description",
    "email",
    "password",
    "is_active"
) VALUES (
    'Test Restaurant',
    'test-restaurant',
    'A restaurant for development and testing',
    'test@restaurant.com',
    'test123', -- Simple password for testing
    true
) RETURNING id;

-- Add some test tables for the restaurant
INSERT INTO "tables" (
    "number",
    "qr_code",
    "restaurant_id",
    "capacity"
) 
SELECT 
    t.number,
    'qr_' || t.number,
    (SELECT id FROM restaurants WHERE slug = 'test-restaurant'),
    4
FROM (VALUES (1), (2), (3), (4), (5)) AS t(number);

-- Add some test menu items
INSERT INTO "menu_items" (
    "name",
    "description",
    "price",
    "category",
    "is_available",
    "restaurant_id"
)
SELECT
    name,
    description,
    price,
    category,
    true,
    (SELECT id FROM restaurants WHERE slug = 'test-restaurant')
FROM (
    VALUES 
    ('Pizza Margherita', 'Classic tomato and mozzarella', 12.99, 'Pizza'),
    ('Pepperoni Pizza', 'Spicy pepperoni with cheese', 14.99, 'Pizza'),
    ('Caesar Salad', 'Fresh romaine lettuce with caesar dressing', 8.99, 'Salads'),
    ('Chocolate Cake', 'Rich chocolate layer cake', 6.99, 'Desserts')
) AS items(name, description, price, category);

-- Add a test user with admin role for the restaurant
INSERT INTO "users" (
    "email",
    "password",
    "name",
    "role",
    "restaurant_id",
    "is_active"
) VALUES (
    'admin@testrestaurant.com',
    'test123', -- Simple password for testing
    'Test Admin',
    'admin',
    (SELECT id FROM restaurants WHERE slug = 'test-restaurant'),
    true
);
