const { createUser, loginAs, getRoleId, app, request } = require('./helpers');

describe('Users module RBAC & CRUD', () => {
  let managerToken;
  let designerToken;

  beforeAll(async () => {
    await createUser({
      name: 'Users Manager',
      email: 'users_manager@test.local',
      password: 'secret123',
      roleName: 'manager',
    });
    await createUser({
      name: 'Users Designer',
      email: 'users_designer@test.local',
      password: 'secret123',
      roleName: 'designer',
    });
    managerToken = await loginAs('users_manager@test.local', 'secret123');
    designerToken = await loginAs('users_designer@test.local', 'secret123');
  });

  test('non-manager cannot list users (403)', async () => {
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${designerToken}`);
    expect(res.status).toBe(403);
  });

  test('manager can create a new user', async () => {
    const roleId = await getRoleId('cashier');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'New Cashier', email: 'users_newcashier@test.local', password: 'secret123', roleId });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('users_newcashier@test.local');
    expect(res.body.data.password).toBeUndefined();
  });

  test('duplicate email is rejected with 409', async () => {
    const roleId = await getRoleId('cashier');
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Duplicate', email: 'users_newcashier@test.local', password: 'x', roleId });
    expect(res.status).toBe(409);
  });

  test('invalid roleId is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'BadRole', email: 'users_badrole@test.local', password: 'x', roleId: 9999 });
    expect(res.status).toBe(400);
  });
});
