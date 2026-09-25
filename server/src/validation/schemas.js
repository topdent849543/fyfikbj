import { z } from 'zod';

const trimmedString = (min, max) => z.string().trim().min(min).max(max);
const optionalText = (max) => z.string().trim().max(max).optional().nullable();
const optionalUrl = z.string().trim().url().max(500).optional().nullable();
const phone = z.string().trim().regex(/^[+0-9()\-\s]{6,25}$/, 'رقم الهاتف غير صالح');
const uuid = z.string().uuid('المعرف غير صالح');
const money = z.coerce.number().finite().nonnegative().max(9999999999999);
const positiveMoney = money.refine((value) => value > 0, 'يجب أن يكون المبلغ أكبر من صفر');
const imagePath = z.string().trim().max(500).refine((value) => /^https:\/\//i.test(value), 'يجب أن تكون الصورة محفوظة في التخزين الدائم');
const date = z.coerce.date();

export const idParamsSchema = z.object({ id: uuid }).strict();
export const itemIdParamsSchema = z.object({ itemId: uuid }).strict();
export const productIdParamsSchema = z.object({ productId: uuid }).strict();
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
}).strip();

export const registerSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'كلمة المرور يجب أن تحتوي 8 محارف على الأقل').max(128),
  passwordConfirmation: z.string().min(8).max(128),
  fullName: trimmedString(6, 255),
  phone,
  whatsapp: phone.optional().or(z.literal('')).transform((value) => value || undefined),
  province: trimmedString(2, 100),
  area: trimmedString(2, 150),
  address: optionalText(500),
  universityClinic: optionalText(255),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true)
}).strict().refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'], message: 'تأكيد كلمة المرور غير مطابق' });

export const merchantRegisterSchema = z.object({
  account: registerSchema,
  companyName: trimmedString(2, 255),
  companyDescription: optionalText(5000),
  logoUrl: optionalUrl,
  contactEmail: z.string().trim().email().max(255).optional().nullable(),
  websiteUrl: optionalUrl,
  contactDetails: z.record(z.string().max(255)).optional().default({})
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
}).strict();

export const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()) }).strict();
export const resetPasswordSchema = z.object({
  token: z.string().min(40).max(200),
  password: z.string().min(8).max(128),
  passwordConfirmation: z.string().min(8).max(128)
}).strict().refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'], message: 'تأكيد كلمة المرور غير مطابق' });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  password: z.string().min(8).max(128),
  passwordConfirmation: z.string().min(8).max(128)
}).strict().refine((value) => value.password === value.passwordConfirmation, { path: ['passwordConfirmation'], message: 'تأكيد كلمة المرور غير مطابق' });

const productFields = {
  name: trimmedString(2, 255),
  code: trimmedString(1, 100).optional(),
  category: trimmedString(1, 100),
  subCategory: optionalText(100),
  description: trimmedString(10, 10000),
  specifications: optionalText(20000),
  condition: z.enum(['new', 'used']).default('new'),
  price: positiveMoney,
  currency: z.enum(['SYP', 'USD']).default('SYP'),
  stockQuantity: z.coerce.number().int().min(0).max(1000000),
  images: z.array(imagePath).min(2, 'أضف صورتين على الأقل').max(12),
  expirationDate: z.coerce.date().optional().nullable(),
  manufacturer: optionalText(255),
  countryOfOrigin: optionalText(100),
  warrantyDetails: optionalText(2000),
  warrantyMonths: z.coerce.number().int().min(0).max(600).optional().nullable(),
  accessories: optionalText(5000),
  maintenanceDetails: optionalText(5000),
  deliverySameProvince: z.boolean().default(true),
  shippingOtherProvince: z.boolean().default(true),
  sellerProvince: trimmedString(2, 100),
  sellerArea: trimmedString(2, 150),
  sellerUniversity: optionalText(255),
  usageDurationMonths: z.coerce.number().int().min(0).max(1200).optional().nullable(),
  defects: optionalText(10000),
  sellerDeclaration: z.boolean().default(false),
  platformFeeAccepted: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional().default({})
};

export const createProductSchema = z.object(productFields).strict().superRefine((value, ctx) => {
  if (value.condition === 'used') {
    if (!value.usageDurationMonths && value.usageDurationMonths !== 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['usageDurationMonths'], message: 'مدة الاستخدام مطلوبة للمنتج المستعمل' });
    if (!value.defects) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defects'], message: 'اذكر الأعطال أو اكتب لا يوجد' });
    if (!value.sellerDeclaration) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sellerDeclaration'], message: 'إقرار مطابقة الصور والوصف مطلوب' });
    if (!value.platformFeeAccepted) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['platformFeeAccepted'], message: 'الموافقة على رسوم المنصة مطلوبة' });
  }
});
export const updateProductSchema = z.object(productFields).partial().strict().refine((value) => Object.keys(value).length > 0, 'أدخل حقلاً واحداً على الأقل');

export const productQuerySchema = z.object({
  category: trimmedString(1, 100).optional(),
  subCategory: trimmedString(1, 100).optional(),
  condition: z.enum(['new', 'used']).optional(),
  merchantId: uuid.optional(),
  province: trimmedString(1, 100).optional(),
  university: trimmedString(1, 255).optional(),
  minPrice: money.optional(),
  maxPrice: money.optional(),
  currency: z.enum(['SYP', 'USD']).optional(),
  minUsageMonths: z.coerce.number().int().min(0).optional(),
  maxUsageMonths: z.coerce.number().int().min(0).optional(),
  expiresBefore: date.optional(),
  createdAfter: date.optional(),
  sortBy: z.enum(['newest', 'oldest', 'cheapest', 'expensive']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: trimmedString(1, 200).optional(),
  offers: z.enum(['true', 'false']).optional()
}).strip().superRefine(({ minPrice, maxPrice, minUsageMonths, maxUsageMonths }, ctx) => {
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minPrice'], message: 'السعر الأدنى لا يمكن أن يتجاوز الأعلى' });
  if (minUsageMonths !== undefined && maxUsageMonths !== undefined && minUsageMonths > maxUsageMonths) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['minUsageMonths'], message: 'مدة الاستخدام الأدنى لا يمكن أن تتجاوز الأعلى' });
});

export const addCartItemSchema = z.object({ productId: uuid, quantity: z.coerce.number().int().min(1).max(999).default(1) }).strict();
export const updateCartItemSchema = z.object({ quantity: z.coerce.number().int().min(1).max(999) }).strict();

export const createOrderSchema = z.object({
  items: z.array(z.object({ productId: uuid, quantity: z.coerce.number().int().min(1).max(999) }).strict()).min(1).max(100),
  deliverySpeed: z.enum(['normal', 'urgent', 'very_urgent']),
  deliveryTimeSlot: optionalText(100),
  customerName: trimmedString(6, 255),
  customerPhone: phone,
  customerWhatsapp: phone.optional().or(z.literal('')).transform((value) => value || undefined),
  province: trimmedString(2, 100),
  area: trimmedString(2, 150),
  address: trimmedString(5, 500),
  universityClinic: optionalText(255),
  paymentMethod: z.enum(['cash_on_delivery', 'external_transfer']).default('cash_on_delivery'),
  paymentProvider: optionalText(100),
  paymentReference: optionalText(150),
  paymentReceiptUrl: imagePath.optional().nullable(),
  discountCode: z.string().trim().min(1).max(50).optional().transform((value) => value?.toUpperCase()),
  notes: optionalText(2000),
  acceptsReturnPolicy: z.literal(true)
}).strict().superRefine((value, ctx) => {
  const seen = new Set();
  value.items.forEach((item, index) => {
    if (seen.has(item.productId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'productId'], message: 'المنتج مكرر في الطلب' });
    seen.add(item.productId);
  });
  if (value.deliverySpeed === 'very_urgent' && !value.deliveryTimeSlot) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deliveryTimeSlot'], message: 'حدد وقت التوصيل الفوري' });
  if (value.paymentMethod === 'external_transfer' && (!value.paymentProvider || !value.paymentReference)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentReference'], message: 'بيانات التحويل الخارجي مطلوبة' });
});

export const orderQuoteSchema = z.object({
  items: z.array(z.object({ productId: uuid, quantity: z.coerce.number().int().min(1).max(999) }).strict()).min(1).max(100),
  deliverySpeed: z.enum(['normal', 'urgent', 'very_urgent']),
  province: trimmedString(2, 100),
  discountCode: z.string().trim().min(1).max(50).optional().transform((value) => value?.toUpperCase())
}).strict().superRefine((value, ctx) => {
  const seen = new Set();
  value.items.forEach((item, index) => {
    if (seen.has(item.productId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'productId'], message: 'المنتج مكرر في الطلب' });
    seen.add(item.productId);
  });
});

export const orderStatusSchema = z.object({
  status: z.enum(['new', 'pending_review', 'approved', 'preparing', 'assigned_to_driver', 'in_delivery', 'arrived', 'delivered', 'awaiting_payment', 'payment_received', 'rejected', 'cancelled', 'completed', 'archive']),
  reason: optionalText(1000)
}).strict();
export const assignDriverSchema = z.object({ driverId: uuid, note: optionalText(1000) }).strict();
export const driverProofSchema = z.object({ note: optionalText(2000), proofUrl: imagePath.optional().nullable() }).strict();
export const moneyReceiptSchema = z.object({ recipientName: trimmedString(2, 255), amount: money, currency: z.enum(['SYP', 'USD']), notes: optionalText(2000), proofUrl: imagePath.optional().nullable() }).strict();

export const userProfileSchema = z.object({
  fullName: trimmedString(6, 255), phone, whatsapp: phone.optional().or(z.literal('')).transform((value) => value || null),
  province: trimmedString(2, 100), area: trimmedString(2, 150), address: optionalText(500), universityClinic: optionalText(255), avatarUrl: optionalUrl
}).strict();

export const merchantProfileSchema = z.object({
  companyName: trimmedString(2, 255), phone, whatsapp: phone.optional().or(z.literal('')).transform((value) => value || null),
  province: trimmedString(2, 100), area: trimmedString(2, 150), description: optionalText(5000), logoUrl: optionalUrl,
  contactEmail: z.string().trim().email().max(255).optional().nullable(), websiteUrl: optionalUrl, dollarRate: positiveMoney, contactDetails: z.record(z.string().max(255)).optional().default({})
}).strict();

export const deliverySpeedParamsSchema = z.object({ speed: z.enum(['normal', 'urgent', 'very_urgent']) }).strict();
export const deliveryRateSchema = z.object({ sameProvince: money, otherProvince: money }).strict();
export const deliveryQuoteQuerySchema = z.object({ merchantId: uuid.optional(), productId: uuid.optional(), speed: z.enum(['normal', 'urgent', 'very_urgent']), province: trimmedString(2, 100) }).strict().refine(({ merchantId, productId }) => Boolean(merchantId) !== Boolean(productId), { message: 'حدد المنتج أو الشركة فقط', path: ['merchantId'] });

export const approvalSchema = z.object({ approved: z.boolean(), reason: optionalText(1000) }).strict();
export const createCategorySchema = z.object({ name: trimmedString(2, 255), description: optionalText(2000), iconUrl: optionalUrl, orderIndex: z.coerce.number().int().min(0).max(10000).default(0) }).strict();
export const createSubCategorySchema = z.object({ categoryId: uuid, name: trimmedString(2, 255), description: optionalText(2000) }).strict();
export const createDiscountSchema = z.object({
  code: z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase()),
  discountPercentage: z.coerce.number().finite().gt(0).max(100).optional(), discountAmount: positiveMoney.optional(),
  maxUses: z.coerce.number().int().positive().max(1000000).optional().nullable(), maxUserUses: z.coerce.number().int().positive().max(1000000).optional().nullable(),
  minOrderAmount: money.default(0), startsAt: date.optional().nullable(), expiresAt: date.optional().nullable(), merchantId: uuid.optional().nullable(), productIds: z.array(uuid).max(100).default([])
}).strict().superRefine(({ discountPercentage, discountAmount, startsAt, expiresAt }, ctx) => {
  if ((discountPercentage === undefined) === (discountAmount === undefined)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['discountPercentage'], message: 'حدد نسبة أو مبلغ الخصم فقط' });
  if (startsAt && expiresAt && expiresAt <= startsAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'تاريخ الانتهاء يجب أن يكون بعد البداية' });
});
export const createOfferSchema = z.object({ title: trimmedString(2, 255), description: optionalText(5000), imageUrl: imagePath, merchantId: uuid.optional().nullable(), productIds: z.array(uuid).max(100).default([]), startsAt: date.optional().nullable(), endsAt: date.optional().nullable(), orderIndex: z.coerce.number().int().min(0).max(10000).default(0), isActive: z.boolean().default(true) }).strict().refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, { path: ['endsAt'], message: 'تاريخ النهاية يجب أن يكون بعد البداية' });

export const reportProductSchema = z.object({ reason: trimmedString(3, 100), details: optionalText(2000) }).strict();
export const rentalRequestSchema = z.object({ rentalId: uuid, startsOn: date, endsOn: date, notes: optionalText(2000) }).strict().refine((value) => value.endsOn >= value.startsOn, { path: ['endsOn'], message: 'تاريخ النهاية يجب أن يكون بعد البداية' });
export const createRentalSchema = z.object({ productId: uuid, dailyPrice: positiveMoney.optional().nullable(), weeklyPrice: positiveMoney.optional().nullable(), depositAmount: money.default(0), returnTerms: trimmedString(5, 5000), lateFeePerDay: money.default(0), isActive: z.boolean().default(true) }).strict().refine((value) => value.dailyPrice || value.weeklyPrice, { message: 'حدد سعر اليوم أو الأسبوع' });
export const dentalCardRequestSchema = z.object({ doctorName: trimmedString(3, 255), specialty: optionalText(255), phone, address: optionalText(500), email: z.string().trim().email().max(255).optional().nullable(), logoUrl: imagePath.optional().nullable(), colors: optionalText(255), requestedText: optionalText(5000), requestedTemplate: optionalText(100), attachments: z.array(imagePath).max(10).default([]) }).strict();
export const dentalCardQuoteSchema = z.object({ quotedPrice: positiveMoney, executionDays: z.coerce.number().int().min(1).max(365), includedRevisions: z.coerce.number().int().min(0).max(50).default(0), status: z.enum(['quoted', 'in_progress', 'revision', 'completed', 'cancelled']), adminNote: optionalText(5000) }).strict();
export const adminUserSchema = z.object({ role: z.enum(['customer', 'merchant', 'manager', 'driver', 'admin']).optional(), isActive: z.boolean().optional() }).strict().refine((value) => value.role !== undefined || value.isActive !== undefined, 'حدد تغييراً واحداً على الأقل');
export const bannerSchema = z.object({ title: optionalText(255), imageUrl: imagePath, linkUrl: z.string().trim().max(500).optional().nullable(), orderIndex: z.coerce.number().int().min(0).max(10000).default(0), isActive: z.boolean().default(true) }).strict();
export const settingSchema = z.object({ key: z.string().trim().min(2).max(255).regex(/^[A-Za-z0-9_.-]+$/), value: z.string().trim().max(20000) }).strict();
export const paymentReviewSchema = z.object({ approved: z.boolean(), note: optionalText(2000) }).strict();
export const provinceSchema = z.object({ name: trimmedString(2, 100), isActive: z.boolean().default(true) }).strict();
export const rentalStatusSchema = z.object({ status: z.enum(['new', 'pending_review', 'approved', 'rejected', 'ready', 'active', 'returned', 'closed', 'cancelled']), managerNote: optionalText(5000), returnCondition: optionalText(5000) }).strict();
