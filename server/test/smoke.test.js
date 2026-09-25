import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-secret-used-only-by-automated-tests';
process.env.CORS_ORIGINS = 'https://shop.example.com';

const [{ createApp }, { validateJwtSecret }, { createProductSchema, createOrderSchema }] = await Promise.all([
  import('../src/index.js'),
  import('../src/config/env.js'),
  import('../src/validation/schemas.js')
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

test('health endpoint starts without contacting the database', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
  });
});

test('CORS only reflects configured browser origins', async () => {
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short', fullName: '' })
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'Validation failed');
  });
});

test('production JWT secrets must be strong and non-placeholder', () => {
  assert.throws(() => validateJwtSecret('production', ''), /JWT_SECRET/);
  assert.throws(() => validateJwtSecret('production', 'your-secret-key'), /JWT_SECRET/);
  assert.equal(
    validateJwtSecret('production', 'a-secure-production-secret-with-32-plus-characters'),
    'a-secure-production-secret-with-32-plus-characters'
  );
});

test('product and order schemas enforce numeric and uniqueness invariants', () => {
  assert.equal(createProductSchema.parse({
    name: 'Dental mirror', category: 'Tools', price: '12.5', currency: 'USD', stockQuantity: '2'
  }).price, 12.5);

  const productId = '9f5c6d7e-96a2-4b08-99c0-c171bdf6e907';
  assert.throws(() => createOrderSchema.parse({
    items: [{ productId, quantity: 1 }, { productId, quantity: 2 }],
    deliverySpeed: 'normal',
    customerName: 'Test Customer',
    customerPhone: '+963 999 999 999',
    province: 'Damascus',
    address: 'A valid delivery address'
  }), /Duplicate product/);
});
