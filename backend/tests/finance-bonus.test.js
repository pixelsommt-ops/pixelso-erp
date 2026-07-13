const { createUser, loginAs, prisma, app, request } = require('./helpers');

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function createConfirmedPo(designerToken, customerId, productId) {
  const createRes = await request(app)
    .post('/api/production-orders')
    .set('Authorization', `Bearer ${designerToken}`)
    .send({ customerId, poDetails: [{ productId, qty: 1 }] });
  await request(app)
    .put(`/api/production-orders/${createRes.body.data.poId}`)
    .set('Authorization', `Bearer ${designerToken}`)
    .send({ status: 'approved' });
}

describe('Finance bonus (manual + auto-calculate)', () => {
  let financeToken;
  let designerToken;
  let designerId;
  let customerId;
  let productId;

  beforeAll(async () => {
    await createUser({ name: 'Bonus Finance', email: 'bonus_finance@test.local', password: 'secret123', roleName: 'finance' });
    const designer = await createUser({
      name: 'Bonus Designer',
      email: 'bonus_designer@test.local',
      password: 'secret123',
      roleName: 'designer',
    });
    designerId = designer.userId;
    financeToken = await loginAs('bonus_finance@test.local', 'secret123');
    designerToken = await loginAs('bonus_designer@test.local', 'secret123');

    const customer = await prisma.customer.create({ data: { name: 'Bonus Test Customer' } });
    customerId = customer.customerId;
    const product = await prisma.product.create({ data: { name: 'Bonus Test Product', basePrice: 1000, unit: 'pcs' } });
    productId = product.productId;

    // Desainer bikin 2 PO terkonfirmasi (bukan draft) pada bulan berjalan.
    await createConfirmedPo(designerToken, customerId, productId);
    await createConfirmedPo(designerToken, customerId, productId);
  });

  test('manual bonus entry rejects invalid source', async () => {
    const badRes = await request(app)
      .post('/api/finance')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ userId: designerId, period: currentPeriod(), source: 'not-a-source', amount: 1000 });
    expect(badRes.status).toBe(400);
  });

  test('auto-calculate creates bonus based on confirmed PO count', async () => {
    const period = currentPeriod();
    const res = await request(app)
      .post('/api/finance/bonus/auto-calculate')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ period });
    expect(res.status).toBe(200);

    const poBonus = res.body.data.find((b) => b.userId === designerId && b.source === 'po');
    expect(poBonus).toBeDefined();
    expect(Number(poBonus.score)).toBe(2);
    expect(poBonus.isAuto).toBe(true);
  });

  test('editing an auto-generated bonus marks it manual (isAuto=false)', async () => {
    const period = currentPeriod();
    const list = await request(app)
      .get(`/api/finance?period=${period}&source=po`)
      .set('Authorization', `Bearer ${financeToken}`);
    const autoRecord = list.body.data.find((b) => b.userId === designerId && b.source === 'po');
    expect(autoRecord.isAuto).toBe(true);

    const updateRes = await request(app)
      .put(`/api/finance/${autoRecord.bonusId}`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ amount: 777777 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.isAuto).toBe(false);
  });

  test('re-running auto-calculate does not overwrite the now-manual entry', async () => {
    const period = currentPeriod();

    // Desainer lain buat 1 PO lagi supaya auto-calculate benar2 punya nilai baru utk dihitung ulang.
    await createConfirmedPo(designerToken, customerId, productId);

    await request(app)
      .post('/api/finance/bonus/auto-calculate')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ period });

    const list = await request(app)
      .get(`/api/finance?period=${period}&source=po`)
      .set('Authorization', `Bearer ${financeToken}`);
    const record = list.body.data.find((b) => b.userId === designerId && b.source === 'po');

    expect(record.isAuto).toBe(false);
    expect(Number(record.amount)).toBe(777777); // tetap nilai manual, tidak tertimpa
  });
});
