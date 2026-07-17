jest.mock('../src/common/utils/mailer');
const { sendMail } = require('../src/common/utils/mailer');
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

  test('quote previews items and subtotal before the invoice is created', async () => {
    const res = await request(app)
      .get(`/api/pos/quote/${approvedPoId}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(res.status).toBe(200);
    expect(Number(res.body.data.subtotal)).toBe(100000); // 2 x 50000
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.minDpRatio).toBe(0.5);
  });

  test('dp below 50% of total is rejected', async () => {
    const res = await request(app)
      .post('/api/pos')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ poId: approvedPoId, dp: 20000, paymentMethod: 'cash' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/DP minimal 50%/);
  });

  test('creating invoice computes total from qty * basePrice', async () => {
    const res = await request(app)
      .post('/api/pos')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ poId: approvedPoId, dp: 50000, paymentMethod: 'cash' });
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
      .send({ payment: { amount: 50000, method: 'transfer' } });
    expect(res.status).toBe(200);
    expect(res.body.data.paidStatus).toBe('paid');
  });

  test('area-mode product under 1m2 is billed at the 1m2 minimum', async () => {
    const designerToken = await loginAs('pos_designer@test.local', 'secret123');
    const customer = await prisma.customer.create({ data: { name: 'Pos Min Area Customer' } });
    const areaProduct = await prisma.product.create({
      data: { name: 'Pos Min Area Product', basePrice: 40000, unit: 'm2', pricingMode: 'area' },
    });

    const createRes = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({
        customerId: customer.customerId,
        poDetails: [{ productId: areaProduct.productId, qty: 1, widthCm: 50, heightCm: 50 }], // 0.25 m2
      });
    const poId = createRes.body.data.poId;
    await request(app)
      .put(`/api/production-orders/${poId}`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ status: 'approved' });

    const quoteRes = await request(app)
      .get(`/api/pos/quote/${poId}`)
      .set('Authorization', `Bearer ${cashierToken}`);
    expect(quoteRes.status).toBe(200);
    const item = quoteRes.body.data.items[0];
    expect(item.areaM2).toBeCloseTo(0.25);
    expect(item.billedAreaM2).toBe(1);
    expect(item.minAreaApplied).toBe(true);
    expect(Number(item.lineTotal)).toBe(40000); // 1m2 minimum x 1 x 40000, not 0.25 x 40000
    expect(Number(quoteRes.body.data.subtotal)).toBe(40000);
  });

  test('creating invoice emails a nota to the customer when they have an email on file', async () => {
    sendMail.mockClear();
    const designerToken = await loginAs('pos_designer@test.local', 'secret123');
    const customerWithEmail = await prisma.customer.create({
      data: { name: 'Pos Emailed Customer', email: 'pos_customer@test.local' },
    });
    const product = await prisma.product.create({ data: { name: 'Pos Email Test Product', basePrice: 30000, unit: 'pcs' } });

    const createRes = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId: customerWithEmail.customerId, poDetails: [{ productId: product.productId, qty: 1 }] });
    const poId = createRes.body.data.poId;
    await request(app)
      .put(`/api/production-orders/${poId}`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ status: 'approved' });

    const res = await request(app)
      .post('/api/pos')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ poId, dp: 15000, paymentMethod: 'cash' });
    expect(res.status).toBe(201);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'pos_customer@test.local' });
  });
});
