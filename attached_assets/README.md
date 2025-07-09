# Restaurant Management Platform

A multi-tenant web application for restaurants, optimized for mobile use. This platform allows restaurants to manage their menu, tables, and orders, while providing customers with a seamless ordering experience through QR codes.

## Features

### For Customers
- Scan QR code to access restaurant menu
- View menu items with descriptions and prices
- Add items to cart and place orders
- Real-time order status updates

### For Restaurant Managers
- Dashboard with live and past orders
- Revenue analytics
- Menu management
- Table management
- QR code generation for tables

### For Platform Administrators
- Multi-tenant management
- Subscription management via Stripe
- Usage analytics
- Restaurant onboarding

## Tech Stack

- **Frontend & API**: Next.js 14 (App Router)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Authentication**: JWT
- **Payment Processing**: Stripe
- **Deployment**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Stripe account for payments

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd cafe-menu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/cafe_menu"
   JWT_SECRET="your-jwt-secret"
   STRIPE_SECRET_KEY="your-stripe-secret-key"
   STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"
   ```

4. Initialize the database:
   ```bash
   npx prisma migrate dev
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── admin/             # Admin dashboard routes
│   ├── restaurant/        # Restaurant dashboard routes
│   ├── order/            # Customer ordering routes
│   └── api/              # API routes
├── components/            # Reusable components
├── lib/                   # Utility functions and shared code
├── prisma/               # Database schema and migrations
└── styles/               # Global styles
```

## Database Schema

The application uses a multi-tenant database schema with the following main entities:

- Restaurants
- Tables
- Menu Items
- Orders
- Subscriptions
- Platform Admins

## API Routes

- `/api/auth/*` - Authentication endpoints
- `/api/restaurants/*` - Restaurant management
- `/api/orders/*` - Order processing
- `/api/menu/*` - Menu management
- `/api/subscriptions/*` - Subscription handling

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, email support@example.com or open an issue in the repository.
