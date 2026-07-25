# Inventory Management API

Multi-country / multi-branch inventory backend for a skincare export business.

**Stack:** Node.js · Express · MongoDB · Mongoose · JWT · Zod  
**Architecture:** Feature modules with Route → Controller → Service → Repository

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env
# Edit MONGODB_URI and JWT secrets

# 3. Seed
npm run seed

# 4. Run
npm run dev
```

API base: `http://localhost:5000/api`  
Health: `http://localhost:5000/health`

### Seed credentials

`npm run seed` upserts (safe to re-run, never deletes). `npm run seed:reset` (or `npm run db:reset`) **drops the entire database first**, then seeds — use only when you want a clean slate.

| Role   | Email                              | Password       | Branch                 |
|--------|-------------------------------------|----------------|-------------------------|
| Admin  | `admin@inventory.com`               | `Admin@12345`  | —                       |
| Seller | `seller.addis@inventory.com`        | `Seller@12345` | Addis Ababa HQ (ET)     |
| Seller | `seller.hawassa@inventory.com`      | `Seller@12345` | Hawassa Branch (ET)     |
| Seller | `seller.dhaka@inventory.com`        | `Seller@12345` | Dhaka Export Hub (BD)   |
| Seller | `seller.chittagong@inventory.com`   | `Seller@12345` | Chittagong Port Branch (BD) |

Also seeds 8 products distributed across the 4 sellers (with a few low-stock rows) and a handful of historical sales for dashboard data.

---

## Architecture

```
Request → Route (middleware) → Controller → Service → Repository → Mongoose
```

| Layer        | Responsibility                                  |
|--------------|--------------------------------------------------|
| Route        | Auth, role, validation, upload wiring            |
| Controller   | HTTP in/out via ApiResponse                      |
| Service      | Business rules                                   |
| Repository   | Mongoose queries + populate                      |
| Models       | `src/models/*` (UUID string `_id`, `id` in JSON) |

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | Access token secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret |
| `PORT` | No | Default `5000` |
| `UPLOAD_*` | No | Local product image uploads |

---

## Notes

- Document IDs remain **UUID strings** (not ObjectIds) so the existing frontend validators keep working.
- Cascading deletes (country → branches, user/product → inventory/sales) are handled in repositories.
- Stock sales use atomic `findOneAndUpdate` with a quantity guard (no replica-set transaction required).

---

## User workflows

Admin and Seller day-to-day flows are documented in **[../WORKFLOWS.md](../WORKFLOWS.md)**.
