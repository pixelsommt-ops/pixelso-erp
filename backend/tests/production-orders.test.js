jest.mock('../src/common/utils/mailer');
const { sendMail } = require('../src/common/utils/mailer');
const { createUser, loginAs, prisma, app, request } = require('./helpers');

describe('Production Orders lifecycle', () => {
  let designerToken;
  let cashierToken;
  let customerId;
  let productId;

  beforeAll(async () => {
    await createUser({
      name: 'PO Designer',
      email: 'po_designer@test.local',
      password: 'secret123',
      roleName: 'designer',
    });
    await createUser({
      name: 'PO Cashier',
      email: 'po_cashier@test.local',
      password: 'secret123',
      roleName: 'cashier',
    });
    designerToken = await loginAs('po_designer@test.local', 'secret123');
    cashierToken = await loginAs('po_cashier@test.local', 'secret123');

    const customer = await prisma.customer.create({ data: { name: 'PO Test Customer' } });
    customerId = customer.customerId;
    const product = await prisma.product.create({ data: { name: 'PO Test Product', basePrice: 10000, unit: 'pcs' } });
    productId = product.productId;
  });

  test('non designer/manager cannot create PO (403)', async () => {
    const res = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ customerId, poDetails: [{ productId, qty: 1 }] });
    expect(res.status).toBe(403);
  });

  test('designer creates PO, designerId auto-filled, status starts as draft', async () => {
    const res = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId, poDetails: [{ productId, qty: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.poNumber).toMatch(/^PO-\d{8}-\d{4}$/);
  });

  test('creating PO without items is rejected', async () => {
    const res = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId, poDetails: [] });
    expect(res.status).toBe(400);
  });

  test('invalid status transition (draft -> production) is rejected', async () => {
    const createRes = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId, poDetails: [{ productId, qty: 1 }] });
    const poId = createRes.body.data.poId;

    const res = await request(app)
      .put(`/api/production-orders/${poId}`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ status: 'production' });
    expect(res.status).toBe(400);
  });

  test('valid status transition (draft -> approved) is accepted', async () => {
    const createRes = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId, poDetails: [{ productId, qty: 1 }] });
    const poId = createRes.body.data.poId;

    const res = await request(app)
      .put(`/api/production-orders/${poId}`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
  });

  test('transitioning to ready emails the customer, other transitions do not', async () => {
    sendMail.mockClear();
    const customerWithEmail = await prisma.customer.create({
      data: { name: 'PO Ready Email Customer', email: 'po_ready_customer@test.local' },
    });

    const createRes = await request(app)
      .post('/api/production-orders')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ customerId: customerWithEmail.customerId, poDetails: [{ productId, qty: 1 }] });
    const poId = createRes.body.data.poId;

    for (const status of ['approved', 'pos', 'material', 'queue', 'production', 'qc']) {
      const res = await request(app)
        .put(`/api/production-orders/${poId}`)
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ status });
      expect(res.status).toBe(200);
    }
    expect(sendMail).not.toHaveBeenCalled();

    const readyRes = await request(app)
      .put(`/api/production-orders/${poId}`)
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ status: 'ready' });
    expect(readyRes.status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'po_ready_customer@test.local' });
  });
});
