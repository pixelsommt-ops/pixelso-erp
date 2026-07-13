const { createUser, loginAs, app, request } = require('./helpers');

describe('Auth', () => {
  beforeAll(async () => {
    await createUser({
      name: 'Auth Manager',
      email: 'auth_manager@test.local',
      password: 'secret123',
      roleName: 'manager',
    });
    await createUser({
      name: 'Auth Inactive',
      email: 'auth_inactive@test.local',
      password: 'secret123',
      roleName: 'designer',
      status: 'inactive',
    });
  });

  test('login success returns token and user info', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auth_manager@test.local', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('manager');
  });

  test('login with wrong password is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auth_manager@test.local', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('login as inactive user is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auth_inactive@test.local', password: 'secret123' });
    expect(res.status).toBe(401);
  });

  test('GET /auth/me returns full user data for valid token', async () => {
    const token = await loginAs('auth_manager@test.local', 'secret123');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('auth_manager@test.local');
    expect(res.body.data.name).toBe('Auth Manager');
  });

  test('protected route without token is rejected', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });
});
