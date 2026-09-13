import productRepository from './product.repository.js';
import inventoryRepository from '../inventory/inventory.repository.js';
import customerRepository from '../customer/customer.repository.js';
import ApiError from '../../utils/ApiError.js';
import { deleteStoredFile } from '../../utils/fileStorage.js';
import {
  mapProductToExportRow,
  parseCsvToRows,
  parseJsonToRows,
  parseXlsxToRows,
  productsToCsv,
  productsToJson,
  productsToXlsxBuffer,
} from './productImportExport.js';
import { importProductRowSchema } from './product.validation.js';

const mapSellerProduct = (product) => {
  if (!product) return null;
  const assignment = product.assignedUsers?.[0];
  const { assignedUsers, ...rest } = product;
  return {
    ...rest,
    quantity: assignment?.quantity ?? 0,
    assignmentId: assignment?.id ?? null,
    assignedAt: assignment?.updatedAt ?? null,
  };
};

/** Never accept ownership changes from the client body. */
const stripOwnershipFields = (payload = {}) => {
  const {
    ownerId: _ownerId,
    owner: _owner,
    quantity: _quantity,
    assignUserId: _assignUserId,
    ...safe
  } = payload;
  return safe;
};

const assertSellerAssignee = async (assignUserId) => {
  if (!assignUserId) {
    throw ApiError.badRequest('Select a seller when setting initial quantity');
  }
  const user = await inventoryRepository.userExists(assignUserId);
  if (!user) {
    throw ApiError.notFound('Seller not found');
  }
  if (user.role !== 'SELLER') {
    throw ApiError.badRequest('Initial stock can only be assigned to a seller');
  }
  return user;
};

const assignInitialStock = async ({
  userId,
  productId,
  quantity,
  performedBy,
  reason,
}) => {
  await inventoryRepository.assign({
    userId,
    productId,
    quantity,
    ...(quantity > 0
      ? {
          ledger: {
            type: 'RECEIVED',
            reason,
            performedBy,
          },
        }
      : {}),
  });
};

const parseInitialQuantity = (value) => {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 0) return 0;
  return Math.floor(qty);
};

const parseOptionalQuantity = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return parseInitialQuantity(value);
};

const syncAssignmentQuantity = async ({
  assignmentId,
  currentQuantity,
  nextQuantity,
  performedBy,
  reason,
}) => {
  if (!assignmentId || nextQuantity === currentQuantity) return;

  await inventoryRepository.updateQuantity(assignmentId, nextQuantity, {
    type: 'MANUAL_UPDATE',
    beforeQuantity: currentQuantity,
    reason,
    performedBy,
  });
};

const resolveCustomerCountryId = async (requester) => {
  if (requester?.role !== 'CUSTOMER') return null;
  return customerRepository.findCountryIdByUserId(requester.id);
};

const productService = {
  async create(payload, uploadedFile, requester) {
    const initialQuantity = parseInitialQuantity(payload?.quantity);
    const safePayload = stripOwnershipFields(payload);
    const sku = safePayload.sku.trim().toUpperCase();
    const existing = await productRepository.findBySku(sku);
    if (existing) {
      throw ApiError.conflict('SKU already exists');
    }

    const isSeller = requester?.role === 'SELLER';
    const isAdmin = requester?.role === 'ADMIN';
    const assignUserId = payload?.assignUserId;
    const ownerId = isSeller ? requester.id : null;

    try {
      const product = await productRepository.create({
        title: safePayload.title.trim(),
        sku,
        description: safePayload.description ?? null,
        price: safePayload.price ?? 0,
        imageUrl: uploadedFile?.publicPath ?? null,
        ownerId,
      });

      // Seller-created products must appear in their inventory list immediately.
      if (isSeller) {
        await assignInitialStock({
          userId: requester.id,
          productId: product.id,
          quantity: initialQuantity,
          performedBy: requester.id,
          reason: 'Initial stock on product creation',
        });
        return mapSellerProduct(
          await productRepository.findByIdForSeller(product.id, requester.id)
        );
      }

      if (isAdmin && initialQuantity > 0) {
        await assertSellerAssignee(assignUserId);
        await assignInitialStock({
          userId: assignUserId,
          productId: product.id,
          quantity: initialQuantity,
          performedBy: requester.id,
          reason: 'Initial stock on product creation',
        });
      }

      return productRepository.findById(product.id);
    } catch (error) {
      if (uploadedFile?.publicPath) {
        await deleteStoredFile(uploadedFile.publicPath);
      }
      throw error;
    }
  },

  async list(query, requester) {
    const { page, limit, search, minPrice, maxPrice } = query;
    const skip = (page - 1) * limit;
    const isSeller = requester?.role === 'SELLER';
    const isCustomer = requester?.role === 'CUSTOMER';
    const customerCountryId = isCustomer
      ? await resolveCustomerCountryId(requester)
      : null;

    if (isCustomer && !customerCountryId) {
      return {
        items: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      };
    }

    const { items, total } = await productRepository.findMany({
      filters: {
        search,
        minPrice,
        maxPrice,
      },
      skip,
      take: limit,
      sellerId: isSeller ? requester.id : null,
      forCustomer: isCustomer,
      countryId: customerCountryId,
    });

    return {
      items: isSeller ? items.map(mapSellerProduct) : items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  },

  async getById(id, requester) {
    if (requester?.role === 'SELLER') {
      const product = await productRepository.findByIdForSeller(id, requester.id);
      if (!product) {
        throw ApiError.notFound('Product not found or not assigned to you');
      }
      return mapSellerProduct(product);
    }

    if (requester?.role === 'CUSTOMER') {
      const customerCountryId = await resolveCustomerCountryId(requester);
      const product = await productRepository.findByIdForCustomer(id, {
        countryId: customerCountryId,
      });
      if (!product) {
        throw ApiError.notFound('Product not found');
      }
      return product;
    }

    const product = await productRepository.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    return product;
  },

  async update(id, payload, uploadedFile, requester) {
    const requestedQuantity = parseOptionalQuantity(payload?.quantity);
    const safePayload = stripOwnershipFields(payload);
    const isSeller = requester?.role === 'SELLER';

    let existing;
    if (isSeller) {
      existing = await productRepository.findById(id);
      if (!existing) {
        throw ApiError.notFound('Product not found');
      }
      if (!existing.ownerId || existing.ownerId !== requester.id) {
        throw ApiError.forbidden(
          'You can only update products you own. Catalog and other sellers’ products cannot be edited.'
        );
      }
      const assigned = await productRepository.findByIdForSeller(id, requester.id);
      if (!assigned) {
        throw ApiError.forbidden('Product is not available in your inventory');
      }
    } else {
      existing = await this.getById(id, { role: 'ADMIN' });
    }

    if (safePayload.sku) {
      const sku = safePayload.sku.trim().toUpperCase();
      const skuOwner = await productRepository.findBySku(sku);
      if (skuOwner && skuOwner.id !== id) {
        throw ApiError.conflict('SKU already exists');
      }
      safePayload.sku = sku;
    }

    const data = {
      ...(safePayload.title !== undefined
        ? { title: safePayload.title.trim() }
        : {}),
      ...(safePayload.sku !== undefined ? { sku: safePayload.sku } : {}),
      ...(safePayload.description !== undefined
        ? { description: safePayload.description }
        : {}),
      ...(safePayload.price !== undefined ? { price: safePayload.price } : {}),
    };

    const removeImage = Boolean(safePayload.removeImage);
    let previousImageUrl = null;

    if (uploadedFile?.publicPath) {
      previousImageUrl = existing.imageUrl;
      data.imageUrl = uploadedFile.publicPath;
    } else if (removeImage && existing.imageUrl) {
      previousImageUrl = existing.imageUrl;
      data.imageUrl = null;
    }

    if (Object.keys(data).length === 0 && !uploadedFile && !removeImage && requestedQuantity === undefined) {
      throw ApiError.badRequest('At least one field is required');
    }

    try {
      if (Object.keys(data).length > 0 || uploadedFile || removeImage) {
        await productRepository.update(id, data);
      }
      if (previousImageUrl) {
        const updatedCheck = await productRepository.findById(id);
        if (previousImageUrl && previousImageUrl !== updatedCheck?.imageUrl) {
          await deleteStoredFile(previousImageUrl);
        }
      }

      if (requestedQuantity !== undefined) {
        if (isSeller) {
          const assigned = await productRepository.findByIdForSeller(id, requester.id);
          const assignment = assigned?.assignedUsers?.[0];
          if (!assignment) {
            throw ApiError.forbidden('Product is not available in your inventory');
          }
          await syncAssignmentQuantity({
            assignmentId: assignment.id,
            currentQuantity: assignment.quantity ?? 0,
            nextQuantity: requestedQuantity,
            performedBy: requester.id,
            reason: 'Quantity updated via product edit',
          });
        } else {
          const catalog = await productRepository.findById(id);
          const assignmentCount = catalog?._count?.assignedUsers ?? 0;

          if (assignmentCount > 1) {
            throw ApiError.badRequest(
              'Multiple seller assignments exist. Update stock via Inventory.'
            );
          }
          if (assignmentCount === 0 && requestedQuantity > 0) {
            throw ApiError.badRequest(
              'Assign this product to a seller via Inventory before setting stock.'
            );
          }
          if (assignmentCount === 1 && catalog?.assignmentId) {
            await syncAssignmentQuantity({
              assignmentId: catalog.assignmentId,
              currentQuantity: catalog.quantity ?? 0,
              nextQuantity: requestedQuantity,
              performedBy: requester.id,
              reason: 'Quantity updated via product edit',
            });
          }
        }
      }

      if (isSeller) {
        return mapSellerProduct(
          await productRepository.findByIdForSeller(id, requester.id)
        );
      }
      return productRepository.findById(id);
    } catch (error) {
      if (uploadedFile?.publicPath) {
        await deleteStoredFile(uploadedFile.publicPath);
      }
      throw error;
    }
  },

  async remove(id) {
    await this.getById(id, { role: 'ADMIN' });
    return productRepository.delete(id);
  },

  async exportProducts(query, requester) {
    const format = query.format || 'csv';
    const items = [];
    let page = 1;
    let totalPages = 1;

    do {
      const pageResult = await this.list(
        {
          page,
          limit: 100,
          search: query.search,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
        },
        requester,
      );
      items.push(...(pageResult.items || []));
      totalPages = pageResult.meta?.totalPages || 1;
      page += 1;
    } while (page <= totalPages);

    const rows = items.map(mapProductToExportRow);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'xlsx') {
      const buffer = await productsToXlsxBuffer(rows);
      return {
        buffer,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `products-export-${stamp}.xlsx`,
      };
    }

    if (format === 'json') {
      return {
        buffer: Buffer.from(productsToJson(rows), 'utf8'),
        contentType: 'application/json; charset=utf-8',
        filename: `products-export-${stamp}.json`,
      };
    }

    const csv = productsToCsv(rows);
    return {
      buffer: Buffer.from(csv, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      filename: `products-export-${stamp}.csv`,
    };
  },

  async importProducts(file, requester) {
    if (!file?.buffer) {
      throw ApiError.badRequest('Spreadsheet file is required');
    }

    const name = String(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '');
    const isXlsx = name.endsWith('.xlsx');
    const isCsv = name.endsWith('.csv') || mime === 'text/csv';
    const isJson = name.endsWith('.json') || mime === 'application/json';

    if (!isXlsx && !isCsv && !isJson) {
      throw ApiError.badRequest('Invalid file. Allowed types: csv, xlsx, json');
    }

    let rawRows;
    try {
      if (isXlsx) {
        rawRows = await parseXlsxToRows(file.buffer);
      } else if (isJson) {
        rawRows = parseJsonToRows(file.buffer.toString('utf8'));
      } else {
        rawRows = parseCsvToRows(file.buffer.toString('utf8'));
      }
    } catch (error) {
      throw ApiError.badRequest(error?.message || 'Failed to parse file');
    }
    if (!rawRows.length) {
      throw ApiError.badRequest('No product rows found in the file');
    }

    if (rawRows.length > 500) {
      throw ApiError.badRequest('Import is limited to 500 rows per file');
    }

    const created = [];
    const failed = [];

    for (const raw of rawRows) {
      const rowNumber = raw.__rowNumber || failed.length + created.length + 2;
      try {
        const parsed = importProductRowSchema.parse({
          title: raw.title,
          sku: raw.sku,
          description: raw.description || undefined,
          price: raw.price === '' || raw.price == null ? 0 : raw.price,
          quantity: raw.quantity === '' || raw.quantity == null ? 0 : raw.quantity,
          assignUserId: raw.assignUserId || undefined,
        });

        // Sellers ignore assignUserId — ownership/stock follows create() rules.
        const payload =
          requester?.role === 'SELLER'
            ? {
                title: parsed.title,
                sku: parsed.sku,
                description: parsed.description,
                price: parsed.price,
                quantity: parsed.quantity,
              }
            : parsed;

        const product = await this.create(payload, null, requester);
        created.push({
          row: rowNumber,
          id: product.id,
          sku: product.sku,
          title: product.title,
        });
      } catch (error) {
        let message = error?.message || 'Invalid row';
        if (error?.name === 'ZodError') {
          message = error.errors.map((e) => e.message).join('; ');
        } else if (error?.statusCode && error?.message) {
          message = error.message;
        }
        failed.push({
          row: rowNumber,
          sku: raw.sku || null,
          title: raw.title || null,
          message,
        });
      }
    }

    return {
      totalRows: rawRows.length,
      successCount: created.length,
      failureCount: failed.length,
      created,
      failed,
    };
  },
};

export default productService;
