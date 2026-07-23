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

| Role   | Email                         | Password      |
|--------|-------------------------------|---------------|
| Admin  | `admin@inventory.com`         | `Admin@12345` |
| Seller | `seller.addis@inventory.com`  | `Seller@12345`|

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
