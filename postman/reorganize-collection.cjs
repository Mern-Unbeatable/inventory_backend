/**
 * Reorganizes the Postman collection by ROLE (primary), then functionality.
 *
 * Top-level folders:
 *   Authentication · Public · Admin · Seller · Customer
 *
 * Run: node postman/reorganize-collection.cjs
 * (Also invoked automatically at the end of build-collection.cjs)
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'Inventory_API.postman_collection.json');
const original = JSON.parse(fs.readFileSync(src, 'utf8'));

const flatten = (items, acc = []) => {
  for (const it of items) {
    if (it.item) flatten(it.item, acc);
    else acc.push(it);
  }
  return acc;
};

/** Deep-clone a request so the same endpoint can live under multiple role folders. */
const clone = (item) => JSON.parse(JSON.stringify(item));

const indexByName = (requests) => {
  const map = new Map();
  for (const r of requests) {
    if (!map.has(r.name)) map.set(r.name, r);
  }
  return map;
};

const pick = (map, names) =>
  names.map((n) => {
    const item = map.get(n);
    if (!item) throw new Error(`Missing request: ${n}`);
    return clone(item);
  });

const folder = (name, description, items) => ({ name, description, item: items });

const all = flatten(original.item);
const map = indexByName(all);

const collection = {
  ...original,
  info: {
    ...original.info,
    name: 'Inventory Management API',
    description: [
      'Inventory Management API — Postman collection **organized by role**.',
      '',
      '## Folder layout',
      '',
      '```',
      '📁 Authentication     Login / session / tokens (all roles)',
      '📁 Public             Unauthenticated endpoints',
      '📁 Admin              Full system control',
      '📁 Seller             Own inventory, customers, invoices, payments',
      '📁 Customer           Read-only portal (catalog + dashboard)',
      '```',
      '',
      '## Quick start',
      '',
      '1. **Authentication → Login → Login (Admin)** — saves `accessToken` / `refreshToken`',
      '2. Walk **Admin** folders to seed countries → branches → sellers → products → inventory',
      '3. **Admin → Customers** then **Admin → Invoices** → Confirm → **Payments**',
      '4. Switch role: **Authentication → Login → Login (Seller)** or **Login (Customer)**',
      '',
      '## Seeded credentials',
      '',
      '| Role | Email | Password |',
      '|---|---|---|',
      '| ADMIN | `admin@inventory.com` | `Admin@12345` |',
      '| SELLER | `seller.addis@inventory.com` | `Seller@12345` |',
      '| CUSTOMER | `customer.portal@inventory.com` | `Customer@12345` |',
      '',
      'Every request description states the **Required role**. Each request has ≥1 example response.',
      'Collection auth uses Bearer `{{accessToken}}` (set by Login test scripts).',
    ].join('\n'),
  },
  item: [
    // ── Authentication ──────────────────────────────────────────────
    folder(
      'Authentication',
      'Shared auth for every role. Run a Login request first — test scripts store tokens as collection variables.',
      [
        folder(
          'Login',
          'Required role: none (public). One request per seeded role.',
          pick(map, ['Login (Admin)', 'Login (Seller)', 'Login (Customer)'])
        ),
        folder(
          'Session',
          'Required role: any authenticated user.',
          pick(map, ['Me', 'Update Profile', 'Change Password'])
        ),
        folder(
          'Tokens',
          'Required role: none (public). Refresh rotates tokens; Logout deletes the stored refresh token.',
          pick(map, ['Refresh Token', 'Logout'])
        ),
      ]
    ),

    // ── Public ──────────────────────────────────────────────────────
    folder(
      'Public',
      'Unauthenticated endpoints. No Bearer token required.',
      [
        folder(
          'Health',
          'Liveness probe mounted outside /api.',
          pick(map, ['Health Check'])
        ),
      ]
    ),

    // ── Admin ───────────────────────────────────────────────────────
    folder(
      'Admin',
      'Required role: **ADMIN**. Full control of users, locations, catalog, inventory assignment, customers, invoices, and payments.',
      [
        folder(
          'Users',
          'Create sellers / CUSTOMER portal users; list, update, delete accounts.',
          pick(map, [
            'Create Seller',
            'Create Customer Portal User',
            'List Users',
            'Get User',
            'Update User',
            'Delete User',
          ])
        ),
        folder(
          'Countries',
          'Location hierarchy — top level.',
          pick(map, [
            'Create Country',
            'List Countries',
            'Get Country',
            'Update Country',
            'Delete Country',
          ])
        ),
        folder(
          'Branches',
          'Branches belong to a country; sellers are assigned to a branch.',
          pick(map, [
            'Create Branch',
            'List Branches',
            'Get Branch',
            'Update Branch',
            'Delete Branch',
          ])
        ),
        folder(
          'Products',
          'Master catalog CRUD + image upload.',
          [
            ...pick(map, [
              'Create Product (JSON)',
              'Create Product (with Image)',
              'List Products',
              'Get Product',
              'Update Product (JSON)',
              'Update Product (replace Image)',
              'Update Product (remove Image)',
              'Delete Product',
            ]),
          ]
        ),
        folder(
          'Inventory',
          'Assign stock to sellers, adjust quantities, receive/sell, global transaction ledger.',
          pick(map, [
            'Assign Product to User',
            'List Inventory (Admin filters)',
            'Get User Inventory',
            'Get Inventory Record',
            'Set Quantity (absolute)',
            'Adjust Quantity (delta)',
            'Receive Stock',
            'Record Sale',
            'Transaction History (for one record)',
            'Global Transaction Ledger (Admin)',
            'Unassign Product',
          ])
        ),
        folder(
          'Customers',
          'CRM records for invoicing + portal-account linking.',
          pick(map, [
            'Create Customer',
            'List Customers',
            'Get Customer',
            'Update Customer',
            'Delete Customer',
            'Get Customer Invoices',
            'Get Customer Purchase History',
            'Create Portal Account',
          ])
        ),
        folder(
          'Invoices',
          'DRAFT → CONFIRMED workflow. Confirm transactionally deducts seller stock.',
          pick(map, [
            'Create Invoice (Draft)',
            'List Invoices',
            'Get Invoice',
            'Update Invoice (Draft only)',
            'Confirm Invoice',
            'Cancel Invoice (Draft only)',
            'Delete Invoice (Draft only)',
          ])
        ),
        folder(
          'Payments',
          'Full / partial / installment payments. Delete reverses and recomputes balances.',
          pick(map, [
            'Record Payment',
            'List Payments',
            'Get Payment',
            'Delete Payment (reverse)',
          ])
        ),
        folder(
          'Dashboard',
          'Role-aware overview — use the ADMIN example response.',
          pick(map, ['Overview'])
        ),
      ]
    ),

    // ── Seller ──────────────────────────────────────────────────────
    folder(
      'Seller',
      'Required role: **SELLER** (ADMIN may call the same routes). Scoped to the seller\'s own inventory, invoices, and payments. Log in with Login (Seller) first.',
      [
        folder(
          'Products',
          'View products assigned to this seller (quantity + assignment fields).',
          pick(map, ['List Products', 'Get Product'])
        ),
        folder(
          'Inventory',
          'Own stock: view, receive deliveries, record sales, transaction history.',
          pick(map, [
            'My Inventory',
            'Get Inventory Record',
            'Receive Stock',
            'Record Sale',
            'My Transaction History',
            'Transaction History (for one record)',
          ])
        ),
        folder(
          'Customers',
          'Create and manage CRM customer records for invoicing (cannot delete).',
          pick(map, [
            'Create Customer',
            'List Customers',
            'Get Customer',
            'Update Customer',
            'Get Customer Invoices',
            'Get Customer Purchase History',
          ])
        ),
        folder(
          'Invoices',
          'Create / confirm / cancel own invoices. Confirm deducts own stock.',
          pick(map, [
            'Create Invoice (Draft)',
            'List Invoices',
            'Get Invoice',
            'Update Invoice (Draft only)',
            'Confirm Invoice',
            'Cancel Invoice (Draft only)',
          ])
        ),
        folder(
          'Payments',
          'Record and view payments on own invoices (cannot reverse/delete).',
          pick(map, ['Record Payment', 'List Payments', 'Get Payment'])
        ),
        folder(
          'Dashboard',
          'Seller overview — assigned products, sales, pending invoice dues. Use the SELLER example.',
          pick(map, ['Overview'])
        ),
      ]
    ),

    // ── Customer ────────────────────────────────────────────────────
    folder(
      'Customer',
      'Required role: **CUSTOMER**. Read-only portal — browse catalog availability and dashboard. Log in with Login (Customer) first. No create / edit / delete of anything.',
      [
        folder(
          'Profile',
          'Own session profile (same /auth/me endpoints as other roles).',
          pick(map, ['Me', 'Update Profile', 'Change Password'])
        ),
        folder(
          'Products',
          'Read-only catalog: title, SKU, price, availableQuantity (stock summed across all sellers).',
          pick(map, ['Browse Products (Portal)', 'Get Product (Portal)'])
        ),
        folder(
          'Dashboard',
          'Customer overview — available products + catalog snapshot. Use the CUSTOMER example.',
          pick(map, ['Overview'])
        ),
      ]
    ),
  ],
};

fs.writeFileSync(src, JSON.stringify(collection, null, 2) + '\n', 'utf8');

let total = 0;
const print = (items, indent = '') => {
  for (const it of items) {
    if (it.item) {
      const count = (function c(a) {
        let n = 0;
        for (const x of a) n += x.item ? c(x.item) : 1;
        return n;
      })(it.item);
      console.log(`${indent}📁 ${it.name}/ (${count})`);
      print(it.item, indent + '   ');
    } else {
      total += 1;
      console.log(`${indent}${it.request.method.padEnd(7)} ${it.name}`);
    }
  }
};

console.log('Role-based Postman collection:\n');
print(collection.item);
console.log(`\nTotal request entries: ${total}`);
console.log(`Top-level folders: ${collection.item.map((f) => f.name).join(' · ')}`);
console.log(`Wrote ${src}`);
