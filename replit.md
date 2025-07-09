# Restomate - Restaurant Management Platform

## Overview

Restomate is a multi-tenant restaurant management platform that enables restaurants to manage menus, tables, and orders with QR code ordering for customers. The application follows a full-stack architecture with a clear separation between client and server. The system allows platform administrators to manage restaurants and subscriptions, while restaurant owners can manage their menus, tables, orders, and view analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

FoodieManager uses a modern full-stack JavaScript architecture with the following key components:

1. **Frontend**: React application with Vite for bundling
   - Uses a component library based on Radix UI and Tailwind CSS (shadcn/ui)
   - Implements React Query for data fetching and state management
   - Follows a hooks-based architecture for shared functionality

2. **Backend**: Express.js server
   - RESTful API endpoints for all application functionality
   - Authentication using session-based auth with cookies
   - WebSocket implementation for real-time updates

3. **Database**: SQL database using Drizzle ORM
   - Schema defined in shared directory for type safety across frontend and backend
   - PostgreSQL compatible (using Neon database in serverless mode)

4. **Payment Processing**: Stripe integration
   - Subscription management for restaurants
   - Secure payment processing

The application is structured as a monorepo with clear separation between:
- `/client` - Frontend React application
- `/server` - Express.js backend
- `/shared` - Shared types and database schema

## Key Components

### Database Schema

The database schema includes the following main entities:
- Platform Administrators - Manage the entire platform
- Restaurants - The tenants of the system
- Subscriptions - Payment plans for restaurants
- Tables - Restaurant tables with QR codes
- Menu Items - Food and beverages offered by restaurants
- Orders - Customer orders with associated items
- Users - Customer accounts

### Authentication

The application implements a session-based authentication system:
- Uses express-session for managing sessions
- Includes different authentication routes for different user types (admin, restaurant, user)
- Role-based access control for API endpoints

### Realtime Communication

The platform includes WebSocket-based real-time updates:
- Notifications for new orders
- Live status updates for order processing
- Table occupation status

### Restaurant Management

Restaurant owners can:
- Manage their menu (add, edit, delete items)
- Set up tables with QR codes
- Process orders in real-time
- View analytics and performance metrics

### Platform Administration

Platform administrators can:
- Manage restaurant accounts
- Monitor subscription status
- View platform-wide analytics

### Customer Experience

Customers can:
- Scan QR codes to access restaurant menus
- Place orders directly from their devices
- Track order status in real-time

## Data Flow

1. **Authentication Flow**:
   - Users (admins, restaurants, customers) authenticate through login API
   - Server creates a session and returns user data
   - Frontend stores user context and includes session cookies in subsequent requests

2. **Restaurant Management Flow**:
   - Restaurant owners create and manage menu items
   - System generates QR codes for tables
   - QR codes are linked to specific tables in the restaurant

3. **Ordering Flow**:
   - Customers scan QR codes to access the menu
   - Orders are created and sent to the restaurant in real-time via WebSockets
   - Restaurant staff receive and process orders
   - Status updates are communicated back to customers

4. **Subscription Flow**:
   - Restaurants select subscription plans
   - Stripe processes payments and creates subscriptions
   - System tracks subscription status and enforces plan limits

## External Dependencies

The application relies on several external services:

1. **Stripe** - For payment processing and subscription management
2. **Neon Database** - Serverless PostgreSQL database 
3. **WebSockets** - For real-time communication

Key npm packages include:
- React and React DOM for UI
- Express for the backend server
- Drizzle ORM for database access
- React Query for data fetching
- Radix UI components for accessible UI elements
- Tailwind CSS for styling
- Recharts for analytics visualizations

## Deployment Strategy

The application is configured for deployment on Replit:

1. **Development Mode**:
   - Uses Vite's development server for hot module replacement
   - Express backend proxies API requests

2. **Production Build**:
   - Frontend: Vite builds static assets
   - Backend: esbuild bundles the server code
   - Combined deployment with server serving static assets

3. **Environment Configuration**:
   - Environment variables for database connection, Stripe keys, etc.
   - Different configurations for development and production

The deployment process includes:
- Building the frontend with Vite
- Bundling the server with esbuild
- Starting the server which serves both the API and static assets