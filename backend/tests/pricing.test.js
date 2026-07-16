const { createUser, loginAs, app, request } = require('./helpers');

describe('Pricing (harga kalkulator website)', () => {
  let managerToken;
  let designerToken;

  beforeAll(async () => {
    await createUser({ name: 'Pricing Manager', email: 'pricing_manager@test.local', password: 'secret123', roleName: 'manager' });
    await createUser({ name: 'Pricing Designer', email: 'pricing_designer@test.local', password: 'secret123', roleName: 'designer' });
    managerToken = await loginAs('pricing_manager@test.local', 'secret123');
    designerToken = await loginAs('pricing_designer@test.local', 'secret123');
  });

  test('non-manager cannot access /api/pricing (403)', async () => {
    const res = await request(app).get('/api/pricing').set('Authorization', `Bearer ${designerToken}`);
    expect(res.status).toBe(403);
  });

  test('manager can create a print product', async () => {
    const res = await request(app)
      .post('/api/pricing/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'test-banner', name: 'Test Banner', pricingMode: 'area', baseRate: 10000, minimumArea: 0.5, setupFee: 0 });
    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe('test-banner');
  });

  test('key cannot be changed once created', async () => {
    const res = await request(app)
      .put('/api/pricing/products/test-banner')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'renamed-banner' });
    expect(res.status).toBe(400);
  });

  test('invalid pricingMode is rejected', async () => {
    const res = await request(app)
      .post('/api/pricing/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ key: 'bad-mode', name: 'Bad Mode', pricingMode: 'weight', baseRate: 1000 });
    expect(res.status).toBe(400);
  });

  test('manager can update global settings', async () => {
    const res = await request(app)
      .put('/api/pricing/settings')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ designFee: 50000, materialFactors: { standard: 1 }, finishingRates: { none: 0 } });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.designFee)).toBe(50000);
  });

  test('public pricing endpoint rejects missing API key (401)', async () => {
    const res = await request(app).get('/api/public/pricing');
    expect(res.status).toBe(401);
  });

  test('public pricing endpoint rejects wrong API key (401)', async () => {
    const res = await request(app).get('/api/public/pricing').set('X-API-Key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  test('public pricing endpoint returns landing-page shaped data with correct key', async () => {
    const res = await request(app).get('/api/public/pricing').set('X-API-Key', 'test_landing_page_api_key');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('designFee');
    expect(res.body.data).toHaveProperty('materialFactors');
    expect(res.body.data).toHaveProperty('finishingRates');
    expect(Array.isArray(res.body.data.products)).toBe(true);
    const testBanner = res.body.data.products.find((p) => p.key === 'test-banner');
    expect(testBanner).toMatchObject({ key: 'test-banner', mode: 'area', baseRate: 10000 });
  });

  test('manager can create a choice with qty tiers, and it round-trips on read', async () => {
    const createRes = await request(app)
      .post('/api/pricing/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        key: 'test-tiered',
        name: 'Test Tiered Product',
        pricingMode: 'unit',
        baseRate: 9000,
        optionGroups: [
          {
            label: 'Bahan',
            required: true,
            choices: [
              {
                label: 'Stiker HVS',
                priceMode: 'replace_base',
                priceValue: 9000,
                isDefault: true,
                qtyTiers: [
                  { minQty: 1, maxQty: 100, price: 9000 },
                  { minQty: 101, maxQty: null, price: 8850 },
                ],
              },
            ],
          },
        ],
      });
    expect(createRes.status).toBe(201);

    const getRes = await request(app)
      .get('/api/pricing/products/test-tiered')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(getRes.status).toBe(200);
    const choice = getRes.body.data.optionGroups[0].choices[0];
    expect(choice.qtyTiers).toEqual([
      { minQty: 1, maxQty: 100, price: 9000 },
      { minQty: 101, maxQty: null, price: 8850 },
    ]);
  });

  test('qty tier with maxQty below minQty is rejected (400)', async () => {
    const res = await request(app)
      .post('/api/pricing/products')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        key: 'test-bad-tier',
        name: 'Test Bad Tier',
        pricingMode: 'unit',
        baseRate: 1000,
        optionGroups: [
          {
            label: 'Bahan',
            choices: [{ label: 'X', priceMode: 'replace_base', priceValue: 1000, qtyTiers: [{ minQty: 100, maxQty: 1, price: 500 }] }],
          },
        ],
      });
    expect(res.status).toBe(400);
  });
});
