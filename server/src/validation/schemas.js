import { z } from 'zod';

const trimmedString = (min, max) => z.string().trim().min(min).max(max);
const optionalText = (max) => z.string().trim().max(max).optional().nullable();
const phone = z.string().trim().regex(/^[+0-9()\-\s]{6,25}$/, 'Invalid phone number');
const uuid = z.string().uuid();
const money = z.coerce.number().finite().nonnegative().max(9999999999999);
const positiveMoney = money.refine((value) => value > 0, 'Must be greater than zero');
const imagePath = z.string().trim().max(500).refine(
  (value) => value.startsWith('/') || /^https?:\/\//i.test(value),
  'Image must be an absolute URL or site-relative path'
);

export const idParamsSchema = z.object({ id: uuid }).strict();
export const itemIdParamsSchema = z.object({ itemId: uuid }).strict();
export const productIdParamsSchema = z.object({ productId: uuid }).strict();

export const registerSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  fullName: trimmedString(2, 255),
  phone: phone.optional().or(z.literal('')).transform((value) => value || undefined),
  role: z.enum(['customer', 'merchant']).default('customer')
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
}).strict();

const productFields = {
  name: trimmedString(2, 255),
  code: trimmedString(1, 100).optional(),
  category: trimmedString(1, 100),
  subCategory: optionalText(100),
  description: optionalText(10000),
  specifications: optionalText(20000),
  condition: z.enum(['new', 'used']).default('new'),
  price: positiveMoney,
  currency: z.enum(['SYP', 'USD']).default('SYP'),
  stockQuantity: z.coerce.number().int().min(0).max(1000000),
  images: z.array(imagePath).max(12).default([])
};

export const createProductSchema = z.object(productFields).strict();
export const updateProductSchema = z.object(productFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const productQuerySchema = z.object({
  category: trimmedString(1, 100).optional(),
  subCategory: trimmedString(1, 100).optional(),
  condition: z.enum(['new', 'used']).optional(),
  merchantId: uuid.optional(),
  province: trimmedString(1, 100).optional(),
  minPrice: money.optional(),
  maxPrice: money.optional(),
  currency: z.enum(['SYP', 'USD']).optional(),
  sortBy: z.enum(['newest', 'oldest', 'cheapest', 'expensive']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: trimmedString(1, 200).optional(),
  offers: z.enum(['true', 'false']).optional()
}).strip().refine(
  ({ minPrice, maxPrice }) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
  { message: 'minPrice cannot exceed maxPrice', path: ['minPrice'] }
);

export const addCartItemSchema = z.object({
  productId: uuid,
  quantity: z.coerce.number().int().min(1).max(999).default(1)
}).strict();

export const updateCartItemSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(999)
}).strict();

export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: uuid,
    quantity: z.coerce.number().int().min(1).max(999)
  }).strict()).min(1).max(100),
  deliverySpeed: z.enum(['normal', 'urgent', 'very_urgent']),
  deliveryTimeSlot: optionalText(100),
  customerName: trimmedString(2, 255),
  customerPhone: phone,
  customerWhatsapp: phone.optional().or(z.literal('')).transform((value) => value || undefined),
  province: trimmedString(2, 100),
  address: trimmedString(5, 500),
  discountCode: z.string().trim().min(1).max(50).optional().transform((value) => value?.toUpperCase()),
  notes: optionalText(2000)
}).strict().superRefine(({ items }, ctx) => {
  const seen = new Set();
  items.forEach((item, index) => {
    if (seen.has(item.productId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'productId'], message: 'Duplicate product' });
    }
    seen.add(item.productId);
  });
});

export const orderStatusSchema = z.object({
  status: z.enum([
    'new', 'pending_review', 'approved', 'preparing', 'in_delivery', 'arrived',
    'delivered', 'awaiting_payment', 'payment_received', 'rejected', 'cancelled', 'completed'
  ])
}).strict();

export const createDiscountSchema = z.object({
  code: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  discountPercentage: z.coerce.number().finite().gt(0).max(100).optional(),
  discountAmount: positiveMoney.optional(),
  maxUses: z.coerce.number().int().positive().max(1000000).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable()
}).strict().superRefine(({ discountPercentage, discountAmount, expiresAt }, ctx) => {
  if ((discountPercentage === undefined) === (discountAmount === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountPercentage'], message: 'Provide exactly one discount type' });
  }
  if (expiresAt && expiresAt <= new Date()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Expiration must be in the future' });
  }
});

export const deliverySpeedParamsSchema = z.object({
  speed: z.enum(['normal', 'urgent', 'very_urgent'])
}).strict();

export const deliveryRateSchema = z.object({
  sameProvince: money,
  otherProvince: money
}).strict();

export const deliveryQuoteQuerySchema = z.object({
  merchantId: uuid.optional(),
  productId: uuid.optional(),
  speed: z.enum(['normal', 'urgent', 'very_urgent']),
  province: trimmedString(2, 100)
}).strict().refine(
  ({ merchantId, productId }) => Boolean(merchantId) !== Boolean(productId),
  { message: 'Provide exactly one of merchantId or productId', path: ['merchantId'] }
);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strip();
