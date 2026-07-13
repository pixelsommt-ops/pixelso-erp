const { createUser, loginAs, prisma, app, request } = require('./helpers');

describe('Notifications (persisted, read/unread)', () => {
  let managerToken;
  let otherManagerToken;

  beforeAll(async () => {
    await createUser({ name: 'Notif Manager', email: 'notif_manager@test.local', password: 'secret123', roleName: 'manager' });
    await createUser({ name: 'Notif Other Manager', email: 'notif_other@test.local', password: 'secret123', roleName: 'manager' });
    managerToken = await loginAs('notif_manager@test.local', 'secret123');
    otherManagerToken = await loginAs('notif_other@test.local', 'secret123');

    // Buat kondisi yang memicu alert stok kritis untuk manager.
    await prisma.material.create({ data: { name: 'Notif Material', unit: 'pcs', stockQty: 1, minStock: 10 } });
  });

  test('list generates alerts and persists them', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((n) => n.type === 'low_stock')).toBe(true);
    expect(res.body.data.every((n) => n.notificationId)).toBe(true);
  });

  test('calling list again does not create duplicates', async () => {
    const first = await request(app).get('/api/notifications').set('Authorization', `Bearer ${managerToken}`);
    const second = await request(app).get('/api/notifications').set('Authorization', `Bearer ${managerToken}`);
    expect(second.body.data.length).toBe(first.body.data.length);
  });

  test('marking a notification read persists across requests', async () => {
    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${managerToken}`);
    const target = list.body.data.find((n) => n.type === 'low_stock');

    const markRes = await request(app)
      .put(`/api/notifications/${target.notificationId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isRead: true });
    expect(markRes.status).toBe(200);
    expect(markRes.body.data.isRead).toBe(true);

    const after = await request(app).get('/api/notifications').set('Authorization', `Bearer ${managerToken}`);
    const same = after.body.data.find((n) => n.notificationId === target.notificationId);
    expect(same.isRead).toBe(true);
  });

  test('a user cannot mark another user notification as read', async () => {
    const list = await request(app).get('/api/notifications').set('Authorization', `Bearer ${managerToken}`);
    const target = list.body.data[0];

    const res = await request(app)
      .put(`/api/notifications/${target.notificationId}`)
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .send({ isRead: true });
    expect(res.status).toBe(404);
  });
});
