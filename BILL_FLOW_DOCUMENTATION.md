# Bill Generation and Payment Flow

This document outlines the bill generation and payment flow in the restaurant management system.

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [Bill Generation Process](#bill-generation-process)
4. [Bill Payment Process](#bill-payment-process)
5. [Session Completion](#session-completion)
6. [Edge Cases](#edge-cases)
7. [API Endpoints](#api-endpoints)
8. [Client Hooks](#client-hooks)

## Overview

The bill flow is a critical part of the restaurant management system that handles the generation of bills for customers and tracking payments. The system supports three types of bills:

- **Individual Bills**: Each customer gets their own bill based on their orders.
- **Combined Bills**: A single bill covering all customers at the table.
- **Custom Bills**: Bills for selected customers (partial bills).

The flow starts with table session creation, goes through bill generation, and ends with session completion when all bills are paid.

## Data Model

### Core Entities:

1. **Table Session**: Represents a dining session for a table
   - Contains information about the table, party size, and session status
   - Links to customers and has references to orders

2. **Customer**: Represents a diner at a table
   - Linked to a specific table session
   - Can place orders and receive bills

3. **Order**: An order placed by a customer
   - Contains order items with menu items and quantities
   - Linked to a customer and table session

4. **Bill**: A payment request for orders
   - Can be individual (per customer), combined (for whole table), or custom (selected customers)
   - Has status tracking (pending, paid, cancelled)

### Relationships:

```
TableSession 1 ---> * Customer
TableSession 1 ---> * Order
Customer     1 ---> * Order
Customer     1 ---> 1 Bill (for individual bills)
TableSession 1 ---> * Bill
```

## Bill Generation Process

1. **Session Creation**:
   - Table is marked as occupied
   - Customers are registered with the session
   - Orders are placed and linked to customers and the session

2. **Bill Type Selection**:
   - Staff selects bill type (individual, combined, custom)
   - For custom bills, staff selects which customers to include

3. **Bill Generation**:
   - System calculates totals based on orders
   - Bills are created with 'pending' status
   - For individual bills, each customer gets a bill
   - For combined bills, one bill is created for the table
   - For custom bills, selected customers are grouped in one bill

4. **Validation Rules**:
   - Each customer can have only one active individual bill
   - A table session can have multiple bills
   - Bill totals must match order totals

## Bill Payment Process

1. **Payment Collection**:
   - Staff collects payment from customers
   - Bill is marked as 'paid' with payment method
   - Paid timestamp is recorded

2. **For Individual Bills**:
   - Customer's payment status is updated to 'paid'
   - System checks if all customers have paid

3. **For Combined Bills**:
   - All customers in the session are marked as paid
   - Session completion is triggered immediately

4. **For Custom Bills**:
   - Selected customers are marked as paid
   - System checks if all customers have paid

## Session Completion

1. **Completion Trigger**:
   - Session is marked as completed when all bills are paid
   - Alternatively, staff can force-complete a session (e.g., abandoned sessions)

2. **Table Status Update**:
   - Table is marked as vacant
   - Table becomes available for new sessions

3. **Data Finalization**:
   - Session end time is recorded
   - Final totals are calculated and stored

## Edge Cases

1. **No Orders**:
   - Sessions with no orders can be completed directly
   - No bills need to be generated

2. **Abandoned Sessions**:
   - Staff can force-complete sessions
   - Unpaid bills are marked as cancelled

3. **Bill Cancellation**:
   - Bills can be cancelled if payment won't be collected
   - New bills can be generated after cancellation

4. **Partial Payments**:
   - System supports splitting payment methods
   - Each bill must be fully paid to mark as 'paid'

5. **Session with Orders but No Bills**:
   - System prevents completion until bills are generated
   - Staff is prompted to create bills first

## API Endpoints

### Bill Endpoints:

```
POST   /api/restaurants/:restaurantId/bills
PUT    /api/restaurants/:restaurantId/bills/:billId
GET    /api/restaurants/:restaurantId/bills
GET    /api/restaurants/:restaurantId/table-sessions/:sessionId/bills
POST   /api/restaurants/:restaurantId/bills/:billId/pay
```

### Session Management Endpoints:

```
GET    /api/restaurants/:restaurantId/table-sessions/:sessionId/completion-status
POST   /api/restaurants/:restaurantId/table-sessions/:sessionId/force-complete
```

## Client Hooks

The system provides React hooks for bill management:

1. **useBills**: For general bill management across the restaurant
   - Fetches all bills
   - Creates, updates, and tracks bill status
   - Handles filtering and sorting

2. **useSessionBills**: For bill management within a specific session
   - Fetches bills for a specific table session
   - Provides session completion status
   - Handles bill payment
   
3. **useBillState**: For managing bill generation workflow state
   - Implements a finite state machine pattern
   - Tracks bill type selection, customer selection, and generation status

## Implementation Notes

### State Management

The bill generation process uses a finite state machine pattern with these states:

- **IDLE**: Initial state
- **SELECTING_TYPE**: Choosing bill type
- **SELECTING_CUSTOMERS**: Selecting customers for custom bills
- **REVIEWING**: Reviewing bill before generation
- **GENERATING**: Processing bill creation
- **GENERATED**: Bills successfully created
- **FAILED**: Error during bill creation

### Transaction Safety

All bill operations use database transactions to ensure data consistency:

- Bill creation and customer status updates happen atomically
- Session completion and table status updates happen atomically
- Bill payment processing is protected against race conditions

### Cache Management

The system uses a tag-based cache invalidation strategy:

- Resources are tagged by type (bills, sessions, customers)
- Related queries are invalidated together
- Cache TTL is set based on data volatility 