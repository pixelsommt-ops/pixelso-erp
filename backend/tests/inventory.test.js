const { createUser, loginAs, app, request } = require('./helpers');

describe('Inventory stock movements', () => {
  let invToken;
  let materialId;

  beforeAll(async () => {
    await createUser({ name: 'Inv User', email: 'inv_user@test.local', password: 'secret123', roleName: 'inventory' });
    invToken = await loginAs('inv_user@test.local', 'secret123');

    const res = await request(app)
      .post('/api/inventory')
      .set('Authorization', `Bearer ${invToken}`)
      .send({ name: 'Test Material', unit: 'meter', stockQty: 50, minStock: 10 });
    materialId = res.body.data.materialId;
  });

  test('out movement exceeding available stock is rejected', async () => {
    const res = await request(app)
      .put(`/api/inventory/${materialId}`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ movement: { type: 'out', qty: 9999 } });
    expect(res.status).toBe(400);
  });

  test('valid out movement reduces stock correctly', async () => {
    const res = await request(app)
      .put(`/api/inventory/${materialId}`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ movement: { type: 'out', qty: 20 } });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.stockQty)).toBe(30);
  });

  test('negative adjustment beyond current stock is rejected', async () => {
    const res = await request(app)
      .put(`/api/inventory/${materialId}`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ movement: { type: 'adjustment', qty: -9999 } });
    expect(res.status).toBe(400);
  });

  test('negative adjustment within stock succeeds (stock opname correction)', async () => {
    const res = await request(app)
      .put(`/api/inventory/${materialId}`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ movement: { type: 'adjustment', qty: -5 } });
    expect(res.status).toBe(200);
    expect(Number(res.body.data.stockQty)).toBe(25);
  });
});
