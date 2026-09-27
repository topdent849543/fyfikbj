import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-secret-used-only-by-automated-tests-12345';
process.env.CORS_ORIGINS = 'https://shop.example.com';

const [{ assertAssignableScope, buildAccessContext, can, canAccessCompany, canAll, canAny }, { actorCanTransition, ORDER_TRANSITIONS }, { orderStatusSchema }] = await Promise.all([
  import('../src/services/permissionService.js'),
  import('../src/lib/orderWorkflow.js'),
  import('../src/validation/schemas.js')
]);

const user = { id: 'u-1', email: 'manager@example.com', full_name: 'مدير الشركة', role: 'customer', is_active: true, account_status: 'active' };
const companyA = '11111111-1111-4111-8111-111111111111';
const companyB = '22222222-2222-4222-8222-222222222222';

test('effective access keeps platform admin permissionless until explicitly granted', () => {
  const access = buildAccessContext(user, [{ id: 'a-1', role_id: 'r-1', company_id: null, scope_type: 'global', is_active: true, role: { key: 'platform_admin', is_active: true, role_permissions: [] } }]);
  assert.deepEqual(access.roles, ['platform_admin']);
  assert.equal(access.isPlatformOwner, false);
  assert.equal(can(access, 'orders.view'), false);
  assert.equal(canAny(access, ['orders.view', 'reports.view']), false);
});

test('company access is limited to assigned companies and active permissions', () => {
  const access = buildAccessContext(user, [{
    id: 'a-2', role_id: 'r-2', company_id: companyA, scope_type: 'company', is_active: true,
    role: { key: 'company_manager', is_active: true, role_permissions: [{ permission: { key: 'orders.view' } }, { permission: { key: 'orders.change_status' } }] }
  }]);
  assert.equal(access.scopeType, 'company');
  assert.deepEqual(access.companyIds, [companyA]);
  assert.equal(can(access, 'orders.view'), true);
  assert.equal(canAll(access, ['orders.view', 'orders.change_status']), true);
  assert.equal(canAccessCompany(access, companyA), true);
  assert.equal(canAccessCompany(access, companyB), false);
});

test('role scopes reject unsafe global company assignments', () => {
  assert.throws(() => assertAssignableScope({ roleKey: 'company_admin', scopeType: 'global', companyId: null }), /شركة واحدة/);
  assert.throws(() => assertAssignableScope({ roleKey: 'platform_driver', scopeType: 'company', companyId: companyA }), /نطاق المنصة/);
  assert.doesNotThrow(() => assertAssignableScope({ roleKey: 'company_driver', scopeType: 'company', companyId: companyA }));
});

test('new workflow enforces final review and permission-bound transitions', () => {
  assert.equal(ORDER_TRANSITIONS.delivered.includes('completed'), false);
  assert.equal(ORDER_TRANSITIONS.delivered.includes('final_review'), true);
  const driver = { role: 'customer', permissions: ['orders.confirm_delivery'], isPlatformOwner: false };
  const reviewer = { role: 'customer', permissions: ['orders.final_review'], isPlatformOwner: false };
  assert.equal(actorCanTransition(driver, 'arrived', 'delivered'), true);
  assert.equal(actorCanTransition(driver, 'delivered', 'completed'), false);
  assert.equal(actorCanTransition(reviewer, 'final_review', 'completed'), true);
});

test('order validation accepts the final-review lifecycle statuses', () => {
  assert.equal(orderStatusSchema.parse({ status: 'ready_for_delivery' }).status, 'ready_for_delivery');
  assert.equal(orderStatusSchema.parse({ status: 'final_review' }).status, 'final_review');
  assert.equal(orderStatusSchema.parse({ status: 'needs_follow_up' }).status, 'needs_follow_up');
});
