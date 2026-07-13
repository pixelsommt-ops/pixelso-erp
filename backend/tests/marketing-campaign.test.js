const { createUser, loginAs, app, request } = require('./helpers');

describe('Marketing Campaign CRUD', () => {
  let marketingToken;
  let designerToken;

  beforeAll(async () => {
    await createUser({ name: 'Mkt User', email: 'mkt_user@test.local', password: 'secret123', roleName: 'marketing' });
    await createUser({ name: 'Mkt Designer', email: 'mkt_designer@test.local', password: 'secret123', roleName: 'designer' });
    marketingToken = await loginAs('mkt_user@test.local', 'secret123');
    designerToken = await loginAs('mkt_designer@test.local', 'secret123');
  });

  test('non marketing/manager cannot access module (403)', async () => {
    const res = await request(app).get('/api/marketing').set('Authorization', `Bearer ${designerToken}`);
    expect(res.status).toBe(403);
  });

  test('marketing can create a campaign', async () => {
    const res = await request(app)
      .post('/api/marketing')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ name: 'Test Campaign', channel: 'instagram', budget: 100000, status: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Campaign');
  });

  test('invalid campaign status is rejected', async () => {
    const res = await request(app)
      .post('/api/marketing')
      .set('Authorization', `Bearer ${marketingToken}`)
      .send({ name: 'Bad Campaign', status: 'not-a-status' });
    expect(res.status).toBe(400);
  });

  test('created campaign appears in list', async () => {
    const res = await request(app).get('/api/marketing').set('Authorization', `Bearer ${marketingToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((c) => c.name === 'Test Campaign')).toBe(true);
  });
});
