import express from 'express';
import bcrypt from 'bcrypt';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken } from '../middleware/auth.js';
import { requireAllPermissions, requireAnyPermission, requirePermission } from '../middleware/permissions.js';
import { applyCompanyScope, assertCompanyScope } from '../middleware/scope.js';
import { asyncHandler, AppError, audit, notify, pageRange } from '../lib/http.js';
import { assertCanGrantRole, assertAssignableScope, getRoleWithPermissions } from '../services/permissionService.js';
import { assertOrderAccess, getOrderWithRelations, transitionOrder } from '../lib/orderWorkflow.js';
import {
  assignDriverSchema, companyCreateSchema, companyStatusSchema, companyUpdateSchema, deliveryIssueSchema,
  driverCreateSchema, driverStatusSchema, idParamsSchema, notificationBroadcastSchema, orderStatusSchema,
  platformProductUpdateSchema, platformUserCreateSchema, productStatusSchema, roleAssignmentSchema, roleCreateSchema, rolePermissionsSchema, roleUpdateSchema, userStatusSchema, createCategorySchema, createSubCategorySchema, universitySchema, deliveryRateSchema, deliverySpeedParamsSchema
} from '../validation/schemas.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(verifyToken);

const dateSlug = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');
const csv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');

function companyQuery(query, actor) {
  return applyCompanyScope(query, actor, 'id');
}

async function saveRoleAssignment(values) {
  let lookup = supabaseAdmin.from('user_role_assignments').select('id').eq('user_id', values.user_id).eq('role_id', values.role_id);
  lookup = values.company_id ? lookup.eq('company_id', values.company_id) : lookup.is('company_id', null);
  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) throw lookupError;
  const payload = { ...values, updated_at: new Date().toISOString() };
  const request = existing
    ? supabaseAdmin.from('user_role_assignments').update(payload).eq('id', existing.id)
    : supabaseAdmin.from('user_role_assignments').insert(payload);
  const { data, error } = await request.select().single();
  if (error) throw error;
  return data;
}

async function findCompany(id, actor, requiredPermission = 'companies.view') {
  if (!actor.isPlatformOwner && !actor.permissions.includes(requiredPermission)) throw new AppError(403, 'ليس لديك صلاحية تنفيذ هذا الإجراء', 'PERMISSION_FORBIDDEN');
  assertCompanyScope(actor, id);
  const { data, error } = await supabaseAdmin.from('merchants').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'الشركة غير موجودة', 'COMPANY_NOT_FOUND');
  return data;
}

router.get('/dashboard', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
  const companyIds = req.user.hasGlobalScope ? null : req.user.companyIds;
  const [usersResult, companiesResult, productsResult, ordersResult, receiptsResult] = await Promise.all([
    supabaseAdmin.from('users').select('id, account_status, is_active'),
    companyIds ? supabaseAdmin.from('merchants').select('id, is_active').in('id', companyIds) : supabaseAdmin.from('merchants').select('id, is_active'),
    companyIds ? supabaseAdmin.from('products').select('id, status, merchant_id').in('merchant_id', companyIds) : supabaseAdmin.from('products').select('id, status, merchant_id'),
    companyIds ? supabaseAdmin.from('orders').select('id, status, total, merchant_id').eq('order_type', 'merchant').in('merchant_id', companyIds) : supabaseAdmin.from('orders').select('id, status, total, merchant_id').eq('order_type', 'merchant'),
    companyIds ? supabaseAdmin.from('money_receipts').select('id, amount, order:orders!inner(merchant_id)').in('order.merchant_id', companyIds) : supabaseAdmin.from('money_receipts').select('id, amount')
  ]);
  for (const result of [usersResult, companiesResult, productsResult, ordersResult, receiptsResult]) if (result.error) throw result.error;
  const orders = ordersResult.data || [];
  const count = (statuses) => orders.filter((order) => statuses.includes(order.status)).length;
  res.json({
    scope: req.user.scopeType,
    stats: {
      users: usersResult.data?.length || 0,
      companies: companiesResult.data?.length || 0,
      products: productsResult.data?.length || 0,
      orders: orders.length,
      newOrders: count(['new', 'pending_review']),
      preparing: count(['approved', 'preparing']),
      readyForDelivery: count(['ready_for_delivery', 'assigned_to_driver']),
      inDelivery: count(['in_delivery', 'arrived']),
      finalReview: count(['delivered', 'final_review']),
      completed: count(['completed', 'archive']),
      cancelled: count(['cancelled', 'rejected', 'failed_delivery']),
      pendingProducts: (productsResult.data || []).filter((product) => product.status === 'pending').length,
      totalSales: orders.filter((order) => ['completed', 'archive'].includes(order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0),
      uncollected: orders.filter((order) => ['delivered', 'final_review'].includes(order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0),
      collections: (receiptsResult.data || []).reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0)
    }
  });
}));

router.get('/reports', requirePermission('reports.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('orders').select('id, order_number, merchant_id, status, total, currency, created_at, merchant:merchants(company_name)').eq('order_type', 'merchant');
  query = applyCompanyScope(query, req.user);
  if (req.query.companyId) { assertCompanyScope(req.user, req.query.companyId); query = query.eq('merchant_id', req.query.companyId); }
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.from) query = query.gte('created_at', req.query.from);
  if (req.query.to) query = query.lte('created_at', req.query.to);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  const rows = data || [];
  const total = rows.reduce((sum, order) => sum + Number(order.total || 0), 0);
  if (req.query.format === 'csv') {
    if (!req.user.isPlatformOwner && !req.user.permissions.includes('reports.export')) throw new AppError(403, 'لا تملك صلاحية تصدير التقارير', 'REPORT_EXPORT_FORBIDDEN');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="topdent-report-${dateSlug()}.csv"`);
    return res.send(`\ufeff${csv([['رقم الطلب', 'الشركة', 'الحالة', 'الإجمالي', 'العملة', 'التاريخ'], ...rows.map((order) => [order.order_number, order.merchant?.company_name, order.status, order.total, order.currency, order.created_at])])}`);
  }
  return res.json({ rows, summary: { orders: rows.length, total, currency: 'SYP' } });
}));

router.get('/companies', requirePermission('companies.view'), asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let query = supabaseAdmin.from('merchants').select('*, manager:users!merchants_user_id_fkey(id, full_name, email)', { count: 'exact' });
  query = companyQuery(query, req.user);
  if (req.query.status === 'active') query = query.eq('is_active', true);
  if (req.query.status === 'inactive') query = query.eq('is_active', false);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ companies: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.post('/companies', requireAllPermissions(['companies.create', 'users.create']), validate({ body: companyCreateSchema }), asyncHandler(async (req, res) => {
  if (!req.user.hasGlobalScope) throw new AppError(403, 'إنشاء الشركات يتطلب نطاق المنصة', 'GLOBAL_SCOPE_REQUIRED');
  const body = req.body;
  const { data: company, error } = await supabaseAdmin.from('merchants').insert({
    user_id: body.managerUserId,
    company_name: body.companyName,
    phone: body.phone || null,
    whatsapp: body.whatsapp || null,
    province: body.province || null,
    area: body.area || null,
    contact_email: body.contactEmail || null,
    description: body.description || null,
    logo_url: body.logoUrl || null,
    is_active: true,
    is_approved: true,
    approval_status: 'approved',
    dollar_rate: body.dollarRate || 1
  }).select().single();
  if (error) throw error;
  const { data: managerRole, error: roleError } = await supabaseAdmin.from('roles').select('id').eq('key', 'company_manager').single();
  if (roleError) throw roleError;
  await saveRoleAssignment({ user_id: body.managerUserId, role_id: managerRole.id, company_id: company.id, scope_type: 'company', assigned_by: req.user.id, is_active: true });
  await audit(req.user.id, 'company_created', 'company', company.id, { managerUserId: body.managerUserId }, company.id, null, company, req.user.roles?.[0]);
  res.status(201).json({ message: 'تم إنشاء الشركة وتعيين مديرها', company });
}));

router.get('/companies/:id', requirePermission('companies.view'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const company = await findCompany(req.params.id, req.user);
  const [teamResult, productsResult, ordersResult] = await Promise.all([
    supabaseAdmin.from('user_role_assignments').select('*, user:users(id, full_name, email, phone, account_status), role:roles(key, name_ar)').eq('company_id', company.id).eq('is_active', true),
    supabaseAdmin.from('products').select('id, name, status, stock_quantity').eq('merchant_id', company.id).order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('orders').select('id, order_number, status, total, created_at').eq('merchant_id', company.id).eq('order_type', 'merchant').order('created_at', { ascending: false }).limit(20)
  ]);
  for (const result of [teamResult, productsResult, ordersResult]) if (result.error) throw result.error;
  res.json({ company, team: teamResult.data || [], products: productsResult.data || [], orders: ordersResult.data || [] });
}));

router.patch('/companies/:id', requirePermission('companies.update'), validate({ params: idParamsSchema, body: companyUpdateSchema }), asyncHandler(async (req, res) => {
  const company = await findCompany(req.params.id, req.user, 'companies.update');
  const { data, error } = await supabaseAdmin.from('merchants').update({
    ...(req.body.companyName !== undefined ? { company_name: req.body.companyName } : {}),
    ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
    ...(req.body.whatsapp !== undefined ? { whatsapp: req.body.whatsapp } : {}),
    ...(req.body.province !== undefined ? { province: req.body.province } : {}),
    ...(req.body.area !== undefined ? { area: req.body.area } : {}),
    ...(req.body.description !== undefined ? { description: req.body.description } : {}),
    ...(req.body.logoUrl !== undefined ? { logo_url: req.body.logoUrl } : {}),
    ...(req.body.dollarRate !== undefined ? { dollar_rate: req.body.dollarRate } : {}),
    ...(req.body.deliveryEnabled !== undefined ? { delivery_enabled: req.body.deliveryEnabled } : {}),
    updated_at: new Date().toISOString()
  }).eq('id', company.id).select().single();
  if (error) throw error;
  await audit(req.user.id, 'company_updated', 'company', company.id, {}, company.id, company, data, req.user.roles?.[0]);
  res.json({ message: 'تم تحديث بيانات الشركة', company: data });
}));

router.patch('/companies/:id/status', requirePermission('companies.disable'), validate({ params: idParamsSchema, body: companyStatusSchema }), asyncHandler(async (req, res) => {
  const company = await findCompany(req.params.id, req.user, 'companies.disable');
  const { data, error } = await supabaseAdmin.from('merchants').update({ is_active: req.body.isActive, updated_at: new Date().toISOString() }).eq('id', company.id).select().single();
  if (error) throw error;
  await audit(req.user.id, 'company_status_updated', 'company', company.id, { isActive: req.body.isActive }, company.id, { is_active: company.is_active }, { is_active: data.is_active }, req.user.roles?.[0]);
  res.json({ message: req.body.isActive ? 'تم تفعيل الشركة' : 'تم تعطيل الشركة ومنع منتجاتها وطلباتها الجديدة', company: data });
}));

router.get('/companies/:id/team', requirePermission('companies.manage_team'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  await findCompany(req.params.id, req.user, 'companies.manage_team');
  const { data, error } = await supabaseAdmin.from('user_role_assignments').select('*, user:users(id, full_name, email, phone, account_status), role:roles(key, name_ar)').eq('company_id', req.params.id).order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ team: data || [] });
}));

router.get('/users', requirePermission('users.view'), asyncHandler(async (req, res) => {
  const { page, limit, from, to } = pageRange(req.query.page, req.query.limit);
  let assignments = supabaseAdmin.from('user_role_assignments').select('user_id').eq('is_active', true);
  if (!req.user.hasGlobalScope) assignments = assignments.in('company_id', req.user.companyIds);
  const { data: assignmentRows, error: assignmentError } = await assignments;
  if (assignmentError) throw assignmentError;
  const userIds = [...new Set((assignmentRows || []).map((row) => row.user_id))];
  let query = supabaseAdmin.from('users').select('id, full_name, email, phone, whatsapp, province, role, account_status, is_active, created_at', { count: 'exact' });
  if (!req.user.hasGlobalScope) query = query.in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) throw error;
  res.json({ users: data || [], pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) } });
}));

router.post('/users', requirePermission('users.create'), validate({ body: platformUserCreateSchema }), asyncHandler(async (req, res) => {
  if (req.body.companyId) assertCompanyScope(req.user, req.body.companyId);
  if (!req.body.companyId && !req.user.hasGlobalScope) throw new AppError(403, 'إنشاء مستخدم عام يتطلب نطاق المنصة', 'GLOBAL_SCOPE_REQUIRED');
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const { data, error } = await supabaseAdmin.from('users').insert({
    email: req.body.email,
    password: passwordHash,
    full_name: req.body.fullName,
    phone: req.body.phone || null,
    whatsapp: req.body.whatsapp || null,
    province: req.body.province || null,
    area: req.body.area || null,
    address: req.body.address || null,
    role: 'customer',
    account_status: 'pending',
    is_active: false,
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString(),
    password_changed_at: new Date().toISOString()
  }).select('id, email, full_name, account_status').single();
  if (error?.code === '23505') throw new AppError(409, 'البريد الإلكتروني أو الهاتف مستخدم بالفعل', 'USER_EXISTS');
  if (error) throw error;
  await audit(req.user.id, 'platform_user_created', 'user', data.id, { companyId: req.body.companyId || null }, req.body.companyId || null, null, { id: data.id, email: data.email }, req.user.roles?.[0]);
  res.status(201).json({ message: 'تم إنشاء الحساب بحالة معلّقة. عيّن الدور ثم فعّله.', user: data });
}));

router.get('/users/:id', requirePermission('users.view'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: user, error } = await supabaseAdmin.from('users').select('id, full_name, email, phone, whatsapp, province, area, role, account_status, is_active, created_at').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!user) throw new AppError(404, 'المستخدم غير موجود', 'USER_NOT_FOUND');
  const { data: assignments, error: assignmentError } = await supabaseAdmin.from('user_role_assignments').select('*, role:roles(key, name_ar), company:merchants(id, company_name)').eq('user_id', user.id);
  if (assignmentError) throw assignmentError;
  if (!req.user.hasGlobalScope && !(assignments || []).some((assignment) => req.user.companyIds.includes(assignment.company_id))) throw new AppError(403, 'لا تملك صلاحية عرض هذا المستخدم', 'USER_SCOPE_FORBIDDEN');
  res.json({ user, roleAssignments: assignments || [] });
}));

router.patch('/users/:id/status', requirePermission('users.disable'), validate({ params: idParamsSchema, body: userStatusSchema }), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id && req.body.accountStatus !== 'active') throw new AppError(409, 'لا يمكنك تعطيل حسابك من هذه الشاشة', 'SELF_DISABLE_BLOCKED');
  const { data: target, error: targetError } = await supabaseAdmin.from('users').select('id, account_status, is_active').eq('id', req.params.id).maybeSingle();
  if (targetError) throw targetError;
  if (!target) throw new AppError(404, 'المستخدم غير موجود', 'USER_NOT_FOUND');
  const { data: targetAssignments, error: targetAssignmentsError } = await supabaseAdmin.from('user_role_assignments').select('company_id, role:roles(key)').eq('user_id', target.id).eq('is_active', true);
  if (targetAssignmentsError) throw targetAssignmentsError;
  if (!req.user.hasGlobalScope && !(targetAssignments || []).some((assignment) => req.user.companyIds.includes(assignment.company_id))) throw new AppError(403, 'لا تملك صلاحية إدارة حساب خارج نطاق شركتك', 'USER_SCOPE_FORBIDDEN');
  const ownerAssignment = (targetAssignments || []).find((assignment) => assignment.role?.key === 'platform_owner');
  if (ownerAssignment) throw new AppError(403, 'حساب المدير العام محمي من التعطيل', 'PLATFORM_OWNER_PROTECTED');
  const { data, error } = await supabaseAdmin.from('users').update({ account_status: req.body.accountStatus, updated_at: new Date().toISOString() }).eq('id', target.id).select('id, account_status, is_active').single();
  if (error) throw error;
  await audit(req.user.id, 'user_account_status_updated', 'user', target.id, { accountStatus: req.body.accountStatus }, null, target, data, req.user.roles?.[0]);
  res.json({ message: 'تم تحديث حالة الحساب', user: data });
}));

router.get('/roles', requirePermission('roles.view'), asyncHandler(async (req, res) => {
  const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabaseAdmin.from('roles').select('*, role_permissions(permission:permissions(id, key, name_ar, module))').order('is_system', { ascending: false }).order('name_ar'),
    supabaseAdmin.from('permissions').select('id, key, name_ar, description, module').order('module').order('name_ar')
  ]);
  if (rolesError) throw rolesError;
  if (permissionsError) throw permissionsError;
  res.json({ roles: roles || [], permissions: permissions || [] });
}));

router.post('/roles', requirePermission('roles.create'), validate({ body: roleCreateSchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('roles').insert({ key: req.body.key, name_ar: req.body.nameAr, description: req.body.description || null, is_system: false, is_active: true }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'مفتاح الدور مستخدم بالفعل', 'ROLE_KEY_EXISTS');
  if (error) throw error;
  await audit(req.user.id, 'role_created', 'role', data.id, { key: data.key }, null, null, data, req.user.roles?.[0]);
  res.status(201).json({ role: data });
}));

router.patch('/roles/:id', requirePermission('roles.update'), validate({ params: idParamsSchema, body: roleUpdateSchema }), asyncHandler(async (req, res) => {
  const role = await getRoleWithPermissions(req.params.id);
  if (role.key === 'platform_owner') throw new AppError(403, 'دور المدير العام محمي', 'PLATFORM_OWNER_PROTECTED');
  const { data, error } = await supabaseAdmin.from('roles').update({ ...req.body, name_ar: req.body.nameAr, nameAr: undefined, updated_at: new Date().toISOString() }).eq('id', role.id).select().single();
  if (error) throw error;
  await audit(req.user.id, 'role_updated', 'role', role.id, {}, null, role, data, req.user.roles?.[0]);
  res.json({ role: data });
}));

router.put('/roles/:id/permissions', requirePermission('roles.assign'), validate({ params: idParamsSchema, body: rolePermissionsSchema }), asyncHandler(async (req, res) => {
  const role = await getRoleWithPermissions(req.params.id);
  if (role.key === 'platform_owner') throw new AppError(403, 'دور المدير العام محمي', 'PLATFORM_OWNER_PROTECTED');
  const { data: permissions, error: permissionError } = await supabaseAdmin.from('permissions').select('id, key').in('id', req.body.permissionIds);
  if (permissionError) throw permissionError;
  if ((permissions || []).length !== req.body.permissionIds.length) throw new AppError(400, 'توجد صلاحية غير صحيحة', 'INVALID_PERMISSION');
  if (!req.user.isPlatformOwner && !(permissions || []).every((permission) => req.user.permissions.includes(permission.key))) throw new AppError(403, 'لا يمكنك منح صلاحيات لا تملكها', 'PERMISSION_ESCALATION_BLOCKED');
  const { error: deleteError } = await supabaseAdmin.from('role_permissions').delete().eq('role_id', role.id);
  if (deleteError) throw deleteError;
  if (permissions?.length) {
    const { error: insertError } = await supabaseAdmin.from('role_permissions').insert(permissions.map((permission) => ({ role_id: role.id, permission_id: permission.id, assigned_by: req.user.id })));
    if (insertError) throw insertError;
  }
  await audit(req.user.id, 'role_permissions_updated', 'role', role.id, { permissionIds: req.body.permissionIds }, null, role.role_permissions, permissions, req.user.roles?.[0]);
  res.json({ message: 'تم تحديث صلاحيات الدور' });
}));

router.post('/roles/assign', requireAnyPermission(['roles.assign', 'users.assign_role', 'companies.manage_team']), validate({ body: roleAssignmentSchema }), asyncHandler(async (req, res) => {
  const role = await getRoleWithPermissions(req.body.roleId);
  assertCanGrantRole(req.user, role);
  assertAssignableScope({ roleKey: role.key, scopeType: req.body.scopeType, companyId: req.body.companyId });
  if (!req.user.isPlatformOwner && ['platform_admin', 'platform_driver', 'company_manager'].includes(role.key)) {
    throw new AppError(403, 'تعيين هذا الدور محصور بالمدير العام', 'ROLE_ASSIGNMENT_RESTRICTED');
  }
  if (req.body.companyId) assertCompanyScope(req.user, req.body.companyId);
  if (role.key === 'company_manager' && req.body.companyId) {
    const { count, error: countError } = await supabaseAdmin.from('user_role_assignments').select('id', { count: 'exact', head: true }).eq('user_id', req.body.userId).eq('role_id', role.id).eq('is_active', true);
    if (countError) throw countError;
    if (count) throw new AppError(409, 'مدير الشركة يمكن ربطه بشركة واحدة فقط', 'COMPANY_MANAGER_SINGLE_COMPANY');
  }
  const data = await saveRoleAssignment({ user_id: req.body.userId, role_id: role.id, company_id: req.body.companyId || null, scope_type: req.body.scopeType, is_active: true, assigned_by: req.user.id });
  await audit(req.user.id, 'role_assigned', 'user_role_assignment', data.id, { role: role.key, userId: req.body.userId, companyId: req.body.companyId || null }, req.body.companyId || null, null, data, req.user.roles?.[0]);
  res.status(201).json({ message: 'تم تعيين الدور والنطاق', assignment: data });
}));

router.get('/products', requirePermission('products.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('products').select('*, merchant:merchants(id, company_name), images:product_images(image_url, is_primary)');
  query = applyCompanyScope(query, req.user);
  if (req.query.companyId) { assertCompanyScope(req.user, req.query.companyId); query = query.eq('merchant_id', req.query.companyId); }
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.search) query = query.or(`name.ilike.%${String(req.query.search).replaceAll(',', '')}%,code.ilike.%${String(req.query.search).replaceAll(',', '')}%`);
  if (req.query.minPrice || req.query.minTotal) query = query.gte('price', Number(req.query.minPrice || req.query.minTotal));
  if (req.query.maxPrice || req.query.maxTotal) query = query.lte('price', Number(req.query.maxPrice || req.query.maxTotal));
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  res.json({ products: data || [] });
}));

router.get('/products/:id', requirePermission('products.view'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: product, error } = await supabaseAdmin.from('products').select('*, merchant:merchants(*), images:product_images(*), reports:product_reports(*), order_items:order_items(id, order_id, quantity, price, created_at)').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  assertCompanyScope(req.user, product.merchant_id);
  res.json({ product });
}));

router.patch('/products/:id', requireAnyPermission(['products.update', 'products.price.update', 'products.stock.update']), validate({ params: idParamsSchema, body: platformProductUpdateSchema }), asyncHandler(async (req, res) => {
  const { data: product, error: productError } = await supabaseAdmin.from('products').select('*').eq('id', req.params.id).maybeSingle();
  if (productError) throw productError;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  assertCompanyScope(req.user, product.merchant_id);
  if ((req.body.name !== undefined || req.body.description !== undefined || req.body.isActive !== undefined || req.body.status !== undefined) && !req.user.isPlatformOwner && !req.user.permissions.includes('products.update')) throw new AppError(403, 'لا تملك صلاحية تعديل بيانات المنتج', 'PRODUCT_UPDATE_FORBIDDEN');
  if (req.body.price !== undefined && !req.user.isPlatformOwner && !req.user.permissions.includes('products.price.update')) throw new AppError(403, 'لا تملك صلاحية تعديل السعر', 'PRODUCT_PRICE_FORBIDDEN');
  if (req.body.stockQuantity !== undefined && !req.user.isPlatformOwner && !req.user.permissions.includes('products.stock.update')) throw new AppError(403, 'لا تملك صلاحية تعديل المخزون', 'PRODUCT_STOCK_FORBIDDEN');
  const updates = {
    ...(req.body.name !== undefined ? { name: req.body.name } : {}),
    ...(req.body.description !== undefined ? { description: req.body.description } : {}),
    ...(req.body.price !== undefined ? { price: req.body.price, original_price: req.body.price, price_syp: req.body.price } : {}),
    ...(req.body.stockQuantity !== undefined ? { stock_quantity: req.body.stockQuantity } : {}),
    ...(req.body.isActive !== undefined ? { is_active: req.body.isActive } : {}),
    ...(req.body.status !== undefined ? { status: req.body.status } : {}),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabaseAdmin.from('products').update(updates).eq('id', product.id).select().single();
  if (error) throw error;
  await audit(req.user.id, 'platform_product_updated', 'product', product.id, Object.keys(updates), product.merchant_id, product, data, req.user.roles?.[0]);
  res.json({ message: 'تم تحديث المنتج', product: data });
}));

router.patch('/products/:id/status', requireAnyPermission(['products.approve', 'products.reject', 'products.hide', 'products.archive']), validate({ params: idParamsSchema, body: productStatusSchema }), asyncHandler(async (req, res) => {
  const { data: product, error: productError } = await supabaseAdmin.from('products').select('*').eq('id', req.params.id).maybeSingle();
  if (productError) throw productError;
  if (!product) throw new AppError(404, 'المنتج غير موجود', 'PRODUCT_NOT_FOUND');
  assertCompanyScope(req.user, product.merchant_id);
  const statusPermission = { approved: 'products.approve', rejected: 'products.reject', inactive: 'products.hide', archive: 'products.archive' }[req.body.status];
  if (!req.user.isPlatformOwner && !req.user.permissions.includes(statusPermission)) throw new AppError(403, 'لا تملك صلاحية تغيير المنتج إلى هذه الحالة', 'PRODUCT_STATUS_FORBIDDEN');
  if (req.body.status === 'rejected' && !req.body.reason) throw new AppError(400, 'أدخل سبب الرفض', 'REJECTION_REASON_REQUIRED');
  const { data, error } = await supabaseAdmin.from('products').update({ status: req.body.status === 'archive' ? 'inactive' : req.body.status, is_approved: req.body.status === 'approved', is_active: !['inactive', 'archive'].includes(req.body.status), rejection_reason: req.body.status === 'rejected' ? req.body.reason : null, updated_at: new Date().toISOString() }).eq('id', product.id).select().single();
  if (error) throw error;
  await audit(req.user.id, 'platform_product_status_updated', 'product', product.id, { status: req.body.status, reason: req.body.reason }, product.merchant_id, product, data, req.user.roles?.[0]);
  res.json({ message: 'تم تحديث حالة المنتج', product: data });
}));

router.get('/orders', requirePermission('orders.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('orders').select('*, customer:users(full_name, phone), merchant:merchants(id, company_name), driver:driver_profiles(id, user:users(full_name)), items:order_items(*)').eq('order_type', 'merchant');
  query = applyCompanyScope(query, req.user);
  if (req.query.companyId) { assertCompanyScope(req.user, req.query.companyId); query = query.eq('merchant_id', req.query.companyId); }
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.search) query = query.ilike('order_number', `%${String(req.query.search).replaceAll('%', '')}%`);
  if (req.query.minTotal) query = query.gte('total', Number(req.query.minTotal));
  if (req.query.maxTotal) query = query.lte('total', Number(req.query.maxTotal));
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  res.json({ orders: data || [] });
}));

router.get('/orders/:id', requirePermission('orders.view'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  await assertOrderAccess(order, req.user);
  const { data: history, error } = await supabaseAdmin.from('order_status_history').select('*, actor:users(full_name)').eq('order_id', order.id).order('created_at');
  if (error) throw error;
  res.json({ order, history: history || [] });
}));

router.patch('/orders/:id/status', requireAnyPermission(['orders.review', 'orders.approve', 'orders.reject', 'orders.cancel', 'orders.change_status', 'orders.final_review', 'orders.archive']), validate({ params: idParamsSchema, body: orderStatusSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  if (order.merchant_id) assertCompanyScope(req.user, order.merchant_id);
  const updated = await transitionOrder({ order, actor: req.user, toStatus: req.body.status, reason: req.body.reason });
  res.json({ message: 'تم تحديث حالة الطلب', order: updated });
}));

router.post('/orders/:id/assign-driver', requirePermission('orders.assign_driver'), validate({ params: idParamsSchema, body: assignDriverSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  if (!order.merchant_id) throw new AppError(400, 'لا يمكن تعيين سائق للطلب المجمع', 'PARENT_ORDER_NOT_DELIVERABLE');
  assertCompanyScope(req.user, order.merchant_id);
  const { data: driver, error } = await supabaseAdmin.from('driver_profiles').select('*, user:users(id, full_name, is_active)').eq('id', req.body.driverId).maybeSingle();
  if (error) throw error;
  if (!driver?.is_active || !driver?.is_available || !driver.user?.is_active) throw new AppError(409, 'السائق غير متاح', 'DRIVER_UNAVAILABLE');
  if (driver.driver_type === 'company' && driver.company_id !== order.merchant_id) throw new AppError(403, 'لا يمكن تعيين سائق شركة مختلفة', 'DRIVER_COMPANY_SCOPE_FORBIDDEN');
  const updated = await transitionOrder({ order, actor: req.user, toStatus: 'assigned_to_driver', reason: req.body.note || 'تعيين سائق', extra: { assigned_driver_id: driver.id } });
  const { error: assignmentError } = await supabaseAdmin.from('driver_assignments').upsert({ order_id: order.id, driver_id: driver.id, assigned_by: req.user.id, notes: req.body.note || null, active: true }, { onConflict: 'order_id' });
  if (assignmentError) throw assignmentError;
  await notify(driver.user_id, 'driver_assignment', 'مهمة توصيل جديدة', `تم تعيين الطلب ${order.order_number} لك`, order.id);
  res.json({ message: 'تم تعيين السائق', order: updated });
}));

router.get('/drivers', requirePermission('drivers.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('driver_profiles').select('*, user:users(id, full_name, phone, account_status)');
  query = applyCompanyScope(query, req.user, 'company_id');
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ drivers: data || [] });
}));

router.get('/drivers/:id', requirePermission('drivers.view'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: driver, error } = await supabaseAdmin.from('driver_profiles').select('*, user:users(id, full_name, email, phone, whatsapp, province, area, address, account_status, is_active, created_at), company:merchants(id, company_name, phone, province, area), assignments:driver_assignments(*, order:orders(id, order_number, status, total, created_at))').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!driver) throw new AppError(404, 'السائق غير موجود', 'DRIVER_NOT_FOUND');
  assertCompanyScope(req.user, driver.company_id);
  res.json({ driver });
}));

router.post('/drivers', requirePermission('drivers.create'), validate({ body: driverCreateSchema }), asyncHandler(async (req, res) => {
  if (req.body.driverType === 'company') assertCompanyScope(req.user, req.body.companyId);
  if (req.body.driverType === 'platform' && !req.user.hasGlobalScope) throw new AppError(403, 'إنشاء سائق عام يتطلب نطاق المنصة', 'GLOBAL_SCOPE_REQUIRED');
  const { data, error } = await supabaseAdmin.from('driver_profiles').upsert({ user_id: req.body.userId, driver_type: req.body.driverType, company_id: req.body.companyId || null, vehicle_info: req.body.vehicleInfo || {}, plate_number: req.body.plateNumber || null, is_available: req.body.isAvailable, is_active: true, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select().single();
  if (error) throw error;
  const roleKey = req.body.driverType === 'company' ? 'company_driver' : 'platform_driver';
  const { data: role, error: roleError } = await supabaseAdmin.from('roles').select('id').eq('key', roleKey).single();
  if (roleError) throw roleError;
  await saveRoleAssignment({ user_id: req.body.userId, role_id: role.id, company_id: req.body.companyId || null, scope_type: req.body.driverType === 'company' ? 'company' : 'global', assigned_by: req.user.id, is_active: true });
  await audit(req.user.id, 'driver_created', 'driver', data.id, { driverType: data.driver_type }, data.company_id, null, data, req.user.roles?.[0]);
  res.status(201).json({ driver: data });
}));

router.patch('/drivers/:id/status', requirePermission('drivers.disable'), validate({ params: idParamsSchema, body: driverStatusSchema }), asyncHandler(async (req, res) => {
  const { data: driver, error: findError } = await supabaseAdmin.from('driver_profiles').select('*').eq('id', req.params.id).maybeSingle();
  if (findError) throw findError;
  if (!driver) throw new AppError(404, 'السائق غير موجود', 'DRIVER_NOT_FOUND');
  if (driver.company_id) assertCompanyScope(req.user, driver.company_id);
  const { data, error } = await supabaseAdmin.from('driver_profiles').update({ is_active: req.body.isActive, is_available: req.body.isAvailable ?? driver.is_available, updated_at: new Date().toISOString() }).eq('id', driver.id).select().single();
  if (error) throw error;
  await audit(req.user.id, 'driver_status_updated', 'driver', driver.id, {}, driver.company_id, driver, data, req.user.roles?.[0]);
  res.json({ driver: data });
}));

router.get('/collections', requirePermission('finance.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('money_receipts').select('*, order:orders!inner(order_number, merchant_id, total, customer:users(full_name), merchant:merchants(company_name)), receiver:users!money_receipts_received_by_fkey(full_name), confirmer:users!money_receipts_confirmed_by_fkey(full_name)');
  if (!req.user.hasGlobalScope) query = query.in('order.merchant_id', req.user.companyIds);
  const { data, error } = await query.order('received_at', { ascending: false });
  if (error) throw error;
  res.json({ collections: data || [] });
}));

router.post('/collections/:id/confirm', requireAnyPermission(['finance.confirm_payment', 'orders.confirm_payment']), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: receipt, error } = await supabaseAdmin.from('money_receipts').select('*, order:orders(merchant_id, status)').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!receipt) throw new AppError(404, 'سجل التحصيل غير موجود', 'COLLECTION_NOT_FOUND');
  if (receipt.order?.merchant_id) assertCompanyScope(req.user, receipt.order.merchant_id);
  const { data, error: updateError } = await supabaseAdmin.from('money_receipts').update({ confirmed_by: req.user.id, confirmed_at: new Date().toISOString() }).eq('id', receipt.id).select().single();
  if (updateError) throw updateError;
  await audit(req.user.id, 'collection_confirmed', 'money_receipt', receipt.id, {}, receipt.order?.merchant_id, receipt, data, req.user.roles?.[0]);
  res.json({ message: 'تم تأكيد التحصيل', collection: data });
}));

router.get('/invoices', requirePermission('invoices.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('invoices').select('*, customer:users(full_name, email), company:merchants(id, company_name)');
  if (!req.user.hasGlobalScope) query = query.in('company_id', req.user.companyIds);
  if (req.query.companyId) { assertCompanyScope(req.user, req.query.companyId); query = query.eq('company_id', req.query.companyId); }
  if (req.query.search) query = query.ilike('invoice_number', `%${String(req.query.search).replaceAll('%', '')}%`);
  if (req.query.minTotal) query = query.gte('total', Number(req.query.minTotal));
  if (req.query.maxTotal) query = query.lte('total', Number(req.query.maxTotal));
  if (req.query.from) query = query.gte('issued_at', req.query.from);
  if (req.query.to) query = query.lte('issued_at', req.query.to);
  const { data, error } = await query.order('issued_at', { ascending: false });
  if (error) throw error;
  res.json({ invoices: data || [] });
}));

router.get('/invoices/:id', requirePermission('invoices.view'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: invoice, error } = await supabaseAdmin.from('invoices').select('*, customer:users(full_name, phone, email), company:merchants(company_name), items:invoice_items(*)').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة', 'INVOICE_NOT_FOUND');
  if (invoice.company_id) assertCompanyScope(req.user, invoice.company_id);
  res.json({ invoice });
}));

router.get('/invoices/:id/export', requirePermission('invoices.export'), validate({ params: idParamsSchema }), asyncHandler(async (req, res) => {
  const { data: invoice, error } = await supabaseAdmin.from('invoices').select('*, company:merchants(company_name), items:invoice_items(*)').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة', 'INVOICE_NOT_FOUND');
  if (invoice.company_id) assertCompanyScope(req.user, invoice.company_id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.csv"`);
  res.send(`\ufeff${csv([['الفاتورة', invoice.invoice_number], ['الشركة', invoice.company?.company_name || 'TopDent'], ['الإجمالي', invoice.total], [], ['المنتج', 'الكمية', 'سعر الوحدة', 'الإجمالي'], ...invoice.items.map((item) => [item.name, item.quantity, item.unit_price, item.line_total])])}`);
}));


router.get('/catalog/categories', requirePermission('catalog.view'), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').select('*, subCategories:sub_categories(*)').order('order_index').order('name');
  if (error) throw error;
  res.json({ categories: data || [] });
}));
router.post('/catalog/categories', requirePermission('catalog.manage'), validate({ body: createCategorySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').insert({ name: req.body.name, description: req.body.description || null, icon_url: req.body.iconUrl || null, order_index: req.body.orderIndex }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'اسم التصنيف مستخدم بالفعل', 'CATEGORY_EXISTS');
  if (error) throw error;
  await audit(req.user.id, 'catalog_category_created', 'category', data.id);
  res.status(201).json({ category: data });
}));
router.put('/catalog/categories/:id', requirePermission('catalog.manage'), validate({ params: idParamsSchema, body: createCategorySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').update({ name: req.body.name, description: req.body.description || null, icon_url: req.body.iconUrl || null, order_index: req.body.orderIndex }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'التصنيف غير موجود', 'CATEGORY_NOT_FOUND');
  await audit(req.user.id, 'catalog_category_updated', 'category', data.id);
  res.json({ category: data });
}));
router.patch('/catalog/categories/:id/status', requirePermission('catalog.manage'), validate({ params: idParamsSchema, body: companyStatusSchema.pick({ isActive: true }) }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('categories').update({ is_active: req.body.isActive }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'التصنيف غير موجود', 'CATEGORY_NOT_FOUND');
  await audit(req.user.id, 'catalog_category_status_updated', 'category', data.id, { isActive: req.body.isActive });
  res.json({ category: data });
}));
router.post('/catalog/sub-categories', requirePermission('catalog.manage'), validate({ body: createSubCategorySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('sub_categories').insert({ category_id: req.body.categoryId, name: req.body.name, description: req.body.description || null }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'اسم التصنيف الفرعي مستخدم بالفعل', 'SUBCATEGORY_EXISTS');
  if (error) throw error;
  await audit(req.user.id, 'catalog_subcategory_created', 'sub_category', data.id);
  res.status(201).json({ subCategory: data });
}));
router.put('/catalog/sub-categories/:id', requirePermission('catalog.manage'), validate({ params: idParamsSchema, body: createSubCategorySchema.omit({ categoryId: true }) }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('sub_categories').update({ name: req.body.name, description: req.body.description || null }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'التصنيف الفرعي غير موجود', 'SUBCATEGORY_NOT_FOUND');
  res.json({ subCategory: data });
}));
router.patch('/catalog/sub-categories/:id/status', requirePermission('catalog.manage'), validate({ params: idParamsSchema, body: companyStatusSchema.pick({ isActive: true }) }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('sub_categories').update({ is_active: req.body.isActive }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'التصنيف الفرعي غير موجود', 'SUBCATEGORY_NOT_FOUND');
  res.json({ subCategory: data });
}));
router.get('/catalog/universities', requirePermission('catalog.view'), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('universities').select('*, province:provinces(id, name)').order('order_index').order('name');
  if (error) throw error;
  res.json({ universities: data || [] });
}));
router.post('/catalog/universities', requirePermission('catalog.manage'), validate({ body: universitySchema }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('universities').insert({ name: req.body.name, province_id: req.body.provinceId || null, is_active: req.body.isActive, order_index: req.body.orderIndex }).select().single();
  if (error?.code === '23505') throw new AppError(409, 'اسم الجامعة مستخدم في هذه المحافظة', 'UNIVERSITY_EXISTS');
  if (error) throw error;
  res.status(201).json({ university: data });
}));
router.patch('/catalog/universities/:id/status', requirePermission('catalog.manage'), validate({ params: idParamsSchema, body: companyStatusSchema.pick({ isActive: true }) }), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('universities').update({ is_active: req.body.isActive, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'الجامعة غير موجودة', 'UNIVERSITY_NOT_FOUND');
  res.json({ university: data });
}));
router.get('/delivery/platform-rates', requirePermission('catalog.view'), asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin.from('platform_delivery_rates').select('*').order('speed');
  if (error) throw error;
  res.json({ rates: data || [] });
}));
router.put('/delivery/platform-rates/:speed', requirePermission('delivery.platform.manage'), validate({ params: deliverySpeedParamsSchema, body: deliveryRateSchema }), asyncHandler(async (req, res) => {
  const speed = req.params.speed;
  if (!['normal', 'urgent', 'very_urgent'].includes(speed)) throw new AppError(400, 'سرعة التوصيل غير صالحة', 'INVALID_DELIVERY_SPEED');
  const { data, error } = await supabaseAdmin.from('platform_delivery_rates').upsert({ speed, same_province: req.body.sameProvince, other_province: req.body.otherProvince, updated_at: new Date().toISOString() }, { onConflict: 'speed' }).select().single();
  if (error) throw error;
  res.json({ rate: data });
}));
router.get('/audit-log', requirePermission('audit.view'), asyncHandler(async (req, res) => {
  let query = supabaseAdmin.from('activity_log').select('*, user:users(full_name, email), company:merchants(company_name)');
  if (!req.user.hasGlobalScope) query = query.in('company_id', req.user.companyIds);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  res.json({ entries: data || [] });
}));

router.post('/notifications', requirePermission('notifications.send'), validate({ body: notificationBroadcastSchema }), asyncHandler(async (req, res) => {
  let userIds = req.body.userIds || [];
  if (req.body.companyId) {
    assertCompanyScope(req.user, req.body.companyId);
    const { data, error } = await supabaseAdmin.from('user_role_assignments').select('user_id').eq('company_id', req.body.companyId).eq('is_active', true);
    if (error) throw error;
    userIds = [...new Set([...userIds, ...(data || []).map((entry) => entry.user_id)])];
  }
  if (req.body.allUsers) {
    if (!req.user.hasGlobalScope) throw new AppError(403, 'إرسال إشعار للجميع يتطلب نطاق المنصة', 'GLOBAL_SCOPE_REQUIRED');
    const { data, error } = await supabaseAdmin.from('users').select('id').eq('account_status', 'active');
    if (error) throw error;
    userIds = [...new Set([...userIds, ...(data || []).map((user) => user.id)])];
  }
  if (!userIds.length) throw new AppError(400, 'حدد مستلمًا واحدًا على الأقل', 'NOTIFICATION_RECIPIENT_REQUIRED');
  const { error } = await supabaseAdmin.from('notifications').insert(userIds.map((userId) => ({ user_id: userId, type: req.body.type, title: req.body.title, message: req.body.message, related_order_id: req.body.orderId || null })));
  if (error) throw error;
  await audit(req.user.id, 'notification_sent', 'notification', null, { count: userIds.length, type: req.body.type }, req.body.companyId || null, null, null, req.user.roles?.[0]);
  res.status(201).json({ message: 'تم إرسال الإشعار', recipients: userIds.length });
}));

router.get('/settings', requirePermission('settings.view'), asyncHandler(async (req, res) => {
  if (!req.user.hasGlobalScope) throw new AppError(403, 'إعدادات المنصة تتطلب نطاقًا عامًا', 'GLOBAL_SCOPE_REQUIRED');
  const { data, error } = await supabaseAdmin.from('settings').select('*').order('key');
  if (error) throw error;
  res.json({ settings: data || [] });
}));

router.patch('/settings', requirePermission('settings.manage'), asyncHandler(async (req, res) => {
  if (!req.user.hasGlobalScope) throw new AppError(403, 'إعدادات المنصة تتطلب نطاقًا عامًا', 'GLOBAL_SCOPE_REQUIRED');
  const { key, value } = req.body || {};
  if (typeof key !== 'string' || typeof value !== 'string' || key.length > 255 || value.length > 20000) throw new AppError(400, 'بيانات الإعداد غير صالحة', 'INVALID_SETTING');
  const { data, error } = await supabaseAdmin.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' }).select().single();
  if (error) throw error;
  await audit(req.user.id, 'platform_setting_updated', 'setting', data.id, { key }, null, null, data, req.user.roles?.[0]);
  res.json({ setting: data });
}));

router.post('/orders/:id/issues', requireAnyPermission(['orders.confirm_delivery', 'orders.change_status']), validate({ params: idParamsSchema, body: deliveryIssueSchema }), asyncHandler(async (req, res) => {
  const order = await getOrderWithRelations(req.params.id);
  await assertOrderAccess(order, req.user);
  const { data: driver, error: driverError } = await supabaseAdmin.from('driver_profiles').select('id').eq('user_id', req.user.id).maybeSingle();
  if (driverError) throw driverError;
  if (!driver || order.assigned_driver_id !== driver.id) throw new AppError(403, 'فقط السائق المعيّن يمكنه تسجيل المشكلة', 'DRIVER_ASSIGNMENT_REQUIRED');
  const { data, error } = await supabaseAdmin.from('delivery_issues').insert({ order_id: order.id, driver_id: driver.id, issue_type: req.body.issueType, notes: req.body.notes || null }).select().single();
  if (error) throw error;
  const nextStatus = ['customer_refused', 'customer_not_available'].includes(req.body.issueType) ? 'failed_delivery' : 'needs_follow_up';
  const updated = await transitionOrder({ order, actor: req.user, toStatus: nextStatus, reason: req.body.notes || req.body.issueType });
  await audit(req.user.id, 'delivery_issue_reported', 'delivery_issue', data.id, { issueType: data.issue_type }, order.merchant_id, null, data, req.user.roles?.[0]);
  res.status(201).json({ message: 'تم تسجيل مشكلة التوصيل', issue: data, order: updated });
}));

export default router;
