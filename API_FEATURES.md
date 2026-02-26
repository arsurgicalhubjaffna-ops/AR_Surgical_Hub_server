# AR Surgical Hub — Server API Features

Base URL: `http://localhost:5000`

---

## ✅ Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Server status check |
| `GET` | `/api/health` | API health — returns `{ status: "ok" }` |

---

## 👤 User Routes `/api/users`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/users/register` | Register a new customer account | ❌ |
| `POST` | `/api/users/login` | Login and receive JWT token | ❌ |

**Register body:**
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "password": "securePass",
  "phone": "9876543210"
}
```

**Login body:**
```json
{ "email": "john@example.com", "password": "securePass" }
```
**Login response:** Returns `{ token, user: { id, full_name, email, role } }`

---

## 📂 Category Routes `/api/categories`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/categories` | List all categories (sorted A-Z) | ❌ |

---

## 📦 Product Routes `/api/products`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/products` | List all active products | ❌ |
| `GET` | `/api/products?category=<id>` | Filter products by category | ❌ |
| `GET` | `/api/products/:id` | Get single product by ID | ❌ |

---

## 🛒 Order Routes `/api/orders`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/orders` | Create a new order with items | ❌ |
| `GET` | `/api/orders/user/:userId` | Get all orders for a user | ❌ |

**Create order body:**
```json
{
  "user_id": "uuid",
  "total_amount": 299.99,
  "shipping_address": "123 Main St",
  "payment_method": "credit_card",
  "items": [
    { "product_id": "uuid", "quantity": 2, "price": 149.99 }
  ]
}
```

---

## 💬 Quote Routes `/api/quotes`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/quotes` | Submit a quote request | ❌ |

**Body:** `{ "message": "...", "user_id": "uuid" }`

---

## ⭐ Review Routes `/api/reviews`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/reviews/:productId` | Get reviews for a product | ❌ |
| `POST` | `/api/reviews` | Add a review for a product | ❌ |

**Add review body:**
```json
{
  "product_id": "uuid",
  "user_id": "uuid",
  "rating": 5,
  "comment": "Excellent product!"
}
```

---

## 🏢 Vacancy Routes `/api/vacancies`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/vacancies` | List all active job vacancies | ❌ |

---

## 🔐 Admin Routes `/api/admin`

> All admin routes require an **Admin JWT token** in the `Authorization: Bearer <token>` header.

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Get total products, users, orders, revenue |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/products` | List all products (with category name) |
| `POST` | `/api/admin/products` | Create a new product |
| `PUT` | `/api/admin/products/:id` | Update a product |
| `DELETE` | `/api/admin/products/:id` | Delete a product |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/categories` | List all categories |
| `POST` | `/api/admin/categories` | Create a new category |
| `PUT` | `/api/admin/categories/:id` | Update a category |
| `DELETE` | `/api/admin/categories/:id` | Delete a category |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/orders` | List all orders (with user details) |
| `PUT` | `/api/admin/orders/:id/status` | Update order status |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users with roles |

---

## 🛡️ Authentication

- JWT-based authentication
- **Customer role**: register & login via `/api/users`
- **Admin role**: login using admin credentials, get token
- Tokens expire in **1 day**
- Pass token in header: `Authorization: Bearer <token>`

---

## 🗄️ Database

| Environment | Database |
|-------------|----------|
| Local Dev | **SQLite** (`db.sqlite`) — auto-created on first run |
| Production (Railway) | **PostgreSQL** (via `DATABASE_URL`) |

---

## 🧪 Tests

Run all 36 tests:
```bash
npm test
```

**Coverage:** Health, Auth, Users, Categories, Products, Vacancies, Quotes, Reviews, Orders, Admin CRUD, Error handling.

---

## ⚙️ Default Admin

| Field | Value |
|-------|-------|
| Email | `admin@arsurgical.com` |
| Password | `admin123` (or set via `ADMIN_PASSWORD` env) |
