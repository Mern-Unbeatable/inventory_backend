# Inventory Management API

Multi-country / multi-branch inventory backend for a skincare export business.

**Stack:** Node.js · Express · PostgreSQL · Prisma · JWT · Zod  
**Architecture:** Feature modules with Route → Controller → Service → Repository

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
# Edit DATABASE_URL and JWT secrets

# 3. Migrate + seed
npm run db:setup

# 4. Run
npm run dev
```

API base: `http://localhost:5000/api`  
Health: `http://localhost:5000/health`

### Seed credentials

| Role   | Email                         | Password      |
|--------|-------------------------------|---------------|
| Admin  | `admin@inventory.com`         | `Admin@12345` |
| Seller | `seller.addis@inventory.com`  | `Seller@12345`|

---

## Architecture

```
Request → Route (middleware) → Controller → Service → Repository → Prisma
```

| Layer        | Responsibility                                      |
|--------------|-----------------------------------------------------|
| Route        | Mount path, auth/role/validate middleware           |
| Controller   | HTTP in/out via `catchAsync` + `ApiResponse`        |
| Service      | Business rules; throws `ApiError`                   |
| Repository   | Prisma queries only                                 |
| Validation   | Zod schemas via `validate.middleware`               |

**RBAC**

- **ADMIN** — countries, branches, products, users, inventory assign/quantity
- **SELLER** — read own profile + assigned inventory only (no stock edits)

---

## API map

### Auth
| Method | Path | Access |
|--------|------|--------|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/refresh` | Public |
| POST | `/api/auth/logout` | Public |
| GET | `/api/auth/me` | Auth |

### Users
| Method | Path | Access |
|--------|------|--------|
| POST | `/api/users` | Admin |
| GET | `/api/users` | Admin |
| GET | `/api/users/:id` | Admin / own (Seller) |
| PATCH | `/api/users/:id` | Admin |
| DELETE | `/api/users/:id` | Admin |

### Countries & Branches
| Method | Path | Access |
|--------|------|--------|
| CRUD | `/api/countries` | Admin |
| CRUD | `/api/branches` | Admin |

### Products (master catalog)
| Method | Path | Access |
|--------|------|--------|
| POST/PATCH/DELETE | `/api/products` | Admin |
| GET | `/api/products` | Admin + Seller |

### Inventory
| Method | Path | Access |
|--------|------|--------|
| GET | `/api/inventory/me` | Auth |
| GET | `/api/inventory` | Admin (filter: countryId, branchId, userId) |
| POST | `/api/inventory/assign` | Admin |
| GET | `/api/inventory/user/:userId` | Admin / own |
| PATCH | `/api/inventory/:id/quantity` | Admin |
| PATCH | `/api/inventory/:id/adjust` | Admin |
| DELETE | `/api/inventory/:id` | Admin |

### Dashboard
| Method | Path | Access |
|--------|------|--------|
| GET | `/api/dashboard/overview` | Auth (role-aware) |

---

## Auth flow

1. `POST /api/auth/login` → `accessToken` + `refreshToken`
2. Send `Authorization: Bearer <accessToken>` on protected routes
3. When access expires → `POST /api/auth/refresh` with body `{ "refreshToken" }`
4. Logout → `POST /api/auth/logout` (revokes stored refresh token)

Refresh tokens are stored **hashed** in `refresh_tokens` and rotated on each refresh.

---

## Postman

Import [`postman/Inventory_API.postman_collection.json`](./postman/Inventory_API.postman_collection.json).

Collection variables:

- `baseUrl` — default `http://localhost:5000/api`
- `accessToken` / `refreshToken` — auto-set by Login test script

---

## Future modules

The same module pattern scales for: Customer, Sales, Supplier, Category, Purchase, Reports.
# inventory_backend
