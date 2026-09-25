import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-secret-used-only-by-automated-tests-12345';
process.env.CORS_ORIGINS = 'https://shop.example.com';
process.env.HEALTHCHECK_SKIP_DB = 'true';

const [{ createApp }, { validateJwtSecret }, { createProductSchema, createOrderSchema, orderQuoteSchema }, { ORDER_TRANSITIONS, roleCanTransition }] = await Promise.all([
  import('../src/index.js'),
  import('../src/config/env.js'),
  import('../src/validation/schemas.js'),
  import('../src/lib/orderWorkflow.js')
]);

async function withServer(run) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('health endpoint starts without exposing configuration details', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'skipped');
    assert.equal(JSON.stringify(body).includes('SUPABASE'), false);
  });
});

test('CORS reflects only configured browser origins', async () => {
  await withServer(async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://shop.example.com' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://shop.example.com');
    const denied = await fetch(`${baseUrl}/health`, { headers: { Origin: 'https://attacker.example.com' } });
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });
});

test('auth validation rejects malformed requests before database access', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short', fullName: '' })
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, 'VALIDATION_FAILED');
  });
});

test('JWT secrets are mandatory in every runtime environment', () => {
  assert.throws(() => validateJwtSecret('production', ''), /JWT_SECRET/);
  assert.throws(() => validateJwtSecret('development', ''), /JWT_SECRET/);
  assert.throws(() => validateJwtSecret('production', 'your-secret-key'), /JWT_SECRET/);
  assert.equal(validateJwtSecret('production', 'a-secure-production-secret-with-32-plus-characters'), 'a-secure-production-secret-with-32-plus-characters');
});

test('product, quote, and checkout schemas enforce commerce invariants', () => {
  assert.throws(() => createProductSchema.parse({ name: 'Dental mirror', category: 'أدوات', description: 'وصف منتج مناسب للاختبار', price: '12.5', currency: 'USD', stockQuantity: '2', images: [] }), /صورتين/);
  const productId = '9f5c6d7e-96a2-4b08-99c0-c171bdf6e907';
  assert.throws(() => orderQuoteSchema.parse({ items: [{ productId, quantity: 1 }, { productId, quantity: 2 }], deliverySpeed: 'normal', province: 'دمشق' }), /مكرر/);
  assert.throws(() => createOrderSchema.parse({ items: [{ productId, quantity: 1 }], deliverySpeed: 'very_urgent', customerName: 'عميل اختبار كامل', customerPhone: '+963 999 999 999', province: 'دمشق', area: 'المزة', address: 'عنوان صحيح للاختبار', acceptsReturnPolicy: true }), /وقت التوصيل/);
});

test('order workflow blocks unsafe status jumps and grants only role-specific transitions', () => {
  assert.equal(ORDER_TRANSITIONS.new.includes('approved'), false);
  assert.equal(roleCanTransition('manager', 'new', 'pending_review'), true);
  assert.equal(roleCanTransition('merchant', 'approved', 'preparing'), true);
  assert.equal(roleCanTransition('merchant', 'approved', 'delivered'), false);
  assert.equal(roleCanTransition('driver', 'assigned_to_driver', 'in_delivery'), true);
  assert.equal(roleCanTransition('driver', 'arrived', 'delivered'), true);
  assert.equal(roleCanTransition('customer', 'new', 'cancelled'), true);
});
