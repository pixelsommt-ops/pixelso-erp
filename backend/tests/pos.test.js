const { createUser, loginAs, prisma, app, request } = require('./helpers');

describe('POS & Payments', () => {
  let cashierToken;
  let approvedPoId;

  beforeAll(async () => {
    await createUser({ name: 'Pos Designer', email: 'pos_designer@test.local', password: 'secret123', roleName: 'designer' });
    await createUser({ name: 'Pos Cashier', email: 'pos_cashier@test.local', password: 'secret123', roleName: 'cashier' });
    const designerToken = await loginAs('pos_designer@test.local', 'secret123');
    cashierToken = await loginAs('pos_cashier@test.local', 'secret123');

    const customer = await prisma.customer.create({ data: { name: 'Pos Test Customer' } });
    const product = await prisma.product.create({ data: { name: 'Pos Test Product', basePrice: 50000, unit: 'pcs' } });

    const createRes = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId: customer.customerId, poDetails: [{ productId: product.productId, qty: 2 }] });
    approvedPoId = createRes.body.data.poId;

    await request(app)
      .put(`/api/production-orders/${approvedPoId}`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ status: 'approved' });
  });

  test('creating invoice computes total from qty * basePrice', async () => {
    const res = await request(app)
      .post('/api/pos')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ poId: approvedPoId, dp: 20000, paymentMethod: 'cash' });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.total)).toBe(100000); // 2 x 50000
    expect(res.body.data.paidStatus).toBe('partial');
  });

  test('duplicate invoice for the same PO is rejected with 409', async () => {
    const res = await request(app)
      .post('/api/pos')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ poId: approvedPoId, dp: 0 });
    expect(res.status).toBe(409);
  });

  test('payment exceeding remaining balance is rejected', async () => {
    const listRes = await request(app).get('/api/pos').set('Authorization', `Bearer ${cashierToken}`);
    const sale = listRes.body.data.sales.find((s) => s.poId === approvedPoId);

    const res = await request(app)
      .put(`/api/pos/${sale.saleId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ payment: { amount: 999999, method: 'cash' } });
    expect(res.status).toBe(400);
  });

  test('paying the exact remaining balance completes the invoice', async () => {
    const listRes = await request(app).get('/api/pos').set('Authorization', `Bearer ${cashierToken}`);
    const sale = listRes.body.data.sales.find((s) => s.poId === approvedPoId);

    const res = await request(app)
      .put(`/api/pos/${sale.saleId}`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ payment: { amount: 80000, method: 'transfer' } });
    expect(res.status).toBe(200);
    expect(res.body.data.paidStatus).toBe('paid');
  });
});
