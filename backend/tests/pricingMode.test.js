const { createUser, loginAs, app, request } = require('./helpers');

describe('PricingMode (Master Mode Harga)', () => {
  let managerToken;
  let designerToken;

  beforeAll(async () => {
    await createUser({ name: 'Mode Manager', email: 'mode_manager@test.local', password: 'secret123', roleName: 'manager' });
    await createUser({ name: 'Mode Designer', email: 'mode_designer@test.local', password: 'secret123', roleName: 'designer' });
    managerToken = await loginAs('mode_manager@test.local', 'secret123');
    designerToken = await loginAs('mode_designer@test.local', 'secret123');
  });

  test('GET /api/pricing-modes includes the seeded area/unit modes', async () => {
    const res = await request(app).get('/api/pricing-modes').set('Authorization', `Bearer ${designerToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((m) => m.key);
    expect(keys).toEqual(expect.arrayContaining(['area', 'unit']));
  });

  test('non-manager/inventory cannot create a mode (403)', async () => {
    const res = await request(app)
      .post('/api/pricing-modes')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ key: 'menit', label: 'Per Menit', calcType: 'scalar', unitLabel: 'menit', inputLabel: 'Durasi (menit)' });
    expect(res.status).toBe(403);
  });

  test('manager can create a scalar mode', async () => {
    const res = await request(app)
      .post('/api/pricing-modes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'menit', label: 'Per Menit', calcType: 'scalar', unitLabel: 'menit', inputLabel: 'Durasi (menit)' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ key: 'menit', label: 'Per Menit', calcType: 'scalar' });
  });

  test('invalid calcType is rejected', async () => {
    const res = await request(app)
      .post('/api/pricing-modes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'gram', label: 'Per Gram', calcType: 'weight', unitLabel: 'gram', inputLabel: 'Berat (gram)' });
    expect(res.status).toBe(400);
  });

  test('key cannot be changed once created', async () => {
    const res = await request(app)
      .put('/api/pricing-modes/menit')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'menit-renamed' });
    expect(res.status).toBe(400);
  });

  test('creating a print product with an unknown pricingMode is rejected (400)', async () => {
    const res = await request(app)
      .post('/api/pricing/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'test-unknown-mode', name: 'Test Unknown Mode', pricingMode: 'not-a-real-mode', baseRate: 1000 });
    expect(res.status).toBe(400);
  });

  test('creating a print product with the new "menit" mode succeeds', async () => {
    const res = await request(app)
      .post('/api/pricing/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'test-laser-menit', name: 'Test Laser', pricingMode: 'menit', baseRate: 5000 });
    expect(res.status).toBe(201);
    expect(res.body.data.pricingMode).toBe('menit');
  });

  test('public pricing enriches products with calcType/unitLabel/inputLabel from the mode', async () => {
    const res = await request(app).get('/api/public/pricing').set('X-API-Key', 'test_landing_page_api_key');
    expect(res.status).toBe(200);
    const product = res.body.data.products.find((p) => p.key === 'test-laser-menit');
    expect(product).toMatchObject({ mode: 'menit', calcType: 'scalar', unitLabel: 'menit', inputLabel: 'Durasi (menit)' });
  });

  test('cannot delete a mode that is still used by a print product', async () => {
    const res = await request(app)
      .delete('/api/pricing-modes/menit')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  test('manager can delete an unused mode', async () => {
    await request(app)
      .post('/api/pricing-modes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'unused-mode', label: 'Unused', calcType: 'scalar', unitLabel: 'x', inputLabel: 'X' });
    const res = await request(app)
      .delete('/api/pricing-modes/unused-mode')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });
});
