const { createUser, loginAs, app, request } = require('./helpers');

describe('Theme (Tema Website)', () => {
  let managerToken;
  let designerToken;

  beforeAll(async () => {
    await createUser({ name: 'Theme Manager', email: 'theme_manager@test.local', password: 'secret123', roleName: 'manager' });
    await createUser({ name: 'Theme Designer', email: 'theme_designer@test.local', password: 'secret123', roleName: 'designer' });
    managerToken = await loginAs('theme_manager@test.local', 'secret123');
    designerToken = await loginAs('theme_designer@test.local', 'secret123');
  });

  test('non-manager cannot access themes (403)', async () => {
    const res = await request(app).get('/api/themes').set('Authorization', `Bearer ${designerToken}`);
    expect(res.status).toBe(403);
  });

  test('manager creates a theme, unknown color keys are dropped', async () => {
    const res = await request(app)
      .post('/api/themes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Kemerdekaan RI',
        colors: { '--red-500': '#ff0000', '--maroon-950': '#8b0000', '--not-a-real-var': '#000000' },
        logoUrl: '/uploads/logo-merdeka.png',
        heroSlides: [{ url: '/uploads/hero-merdeka.jpg', linkUrl: null }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.isActive).toBe(false);
    expect(res.body.data.colors).toEqual({ '--red-500': '#ff0000', '--maroon-950': '#8b0000' });
  });

  test('storefront settings has no activeTheme when none is active', async () => {
    const res = await request(app).get('/api/storefront/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.activeTheme).toBeNull();
  });

  test('activating a theme deactivates any previously active one', async () => {
    const createA = await request(app)
      .post('/api/themes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Tema A' });
    const createB = await request(app)
      .post('/api/themes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Tema B' });

    const activateA = await request(app)
      .put(`/api/themes/${createA.body.data.themeId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(activateA.status).toBe(200);
    expect(activateA.body.data.isActive).toBe(true);

    const activateB = await request(app)
      .put(`/api/themes/${createB.body.data.themeId}/activate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(activateB.status).toBe(200);
    expect(activateB.body.data.isActive).toBe(true);

    const listRes = await request(app).get('/api/themes').set('Authorization', `Bearer ${managerToken}`);
    const activeOnes = listRes.body.data.filter((t) => t.isActive);
    expect(activeOnes).toHaveLength(1);
    expect(activeOnes[0].themeId).toBe(createB.body.data.themeId);

    const settingsRes = await request(app).get('/api/storefront/settings');
    expect(settingsRes.body.data.activeTheme.themeId).toBe(createB.body.data.themeId);
  });

  test('deactivating the active theme removes it from storefront settings', async () => {
    const listRes = await request(app).get('/api/themes').set('Authorization', `Bearer ${managerToken}`);
    const active = listRes.body.data.find((t) => t.isActive);

    const res = await request(app)
      .put(`/api/themes/${active.themeId}/deactivate`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const settingsRes = await request(app).get('/api/storefront/settings');
    expect(settingsRes.body.data.activeTheme).toBeNull();
  });

  test('deleting a theme works', async () => {
    const createRes = await request(app)
      .post('/api/themes')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Tema Sekali Pakai' });

    const res = await request(app)
      .delete(`/api/themes/${createRes.body.data.themeId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/themes/${createRes.body.data.themeId}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(getRes.status).toBe(404);
  });
});
