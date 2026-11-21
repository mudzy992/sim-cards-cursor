import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Critical workflows (smoke e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('WF-00 health endpoint reports db connected', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'connected' });
  });

  it('WF-01 login endpoint responds (without asserting payload)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      emailOrUsername: 'non-existing',
      password: 'invalid',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('WF-02 shipments list requires auth', async () => {
    const res = await request(app.getHttpServer()).get('/shipments');
    expect(res.status).toBe(401);
  });

  it('WF-03 analytics overview requires auth', async () => {
    const res = await request(app.getHttpServer()).get('/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('WF-04 install-tasks and demount-tasks endpoints require auth', async () => {
    const [installRes, demountRes] = await Promise.all([
      request(app.getHttpServer()).get('/install-tasks/my'),
      request(app.getHttpServer()).get('/demount-tasks/my'),
    ]);
    expect(installRes.status).toBe(401);
    expect(demountRes.status).toBe(401);
  });

  it('WF-05 seeded admin can authenticate and query shipments & tasks', async () => {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'CiSeedPassword!123';
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
      emailOrUsername: process.env.ADMIN_EMAIL ?? 'admin@simtracker.local',
      password: adminPassword,
    });

    expect(loginRes.status).toBe(201);
    const token: string | undefined =
      loginRes.body?.accessToken ?? loginRes.body?.data?.accessToken;
    expect(typeof token).toBe('string');

    const [shipmentsRes, installRes, demountRes] = await Promise.all([
      request(app.getHttpServer())
        .get('/shipments')
        .set('Authorization', `Bearer ${token}`),
      request(app.getHttpServer())
        .get('/install-tasks/my')
        .set('Authorization', `Bearer ${token}`),
      request(app.getHttpServer())
        .get('/demount-tasks/my')
        .set('Authorization', `Bearer ${token}`),
    ]);

    expect(shipmentsRes.status).toBe(200);
    expect(installRes.status).toBe(200);
    expect(demountRes.status).toBe(200);
  });

  it('WF-06 imports 8,500+ SIM cards via CSV preview & importAllValid against PostgreSQL and cleans up', async () => {
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'CiSeedPassword!123';
    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
      emailOrUsername: process.env.ADMIN_EMAIL ?? 'admin@simtracker.local',
      password: adminPassword,
    });
    expect(loginRes.status).toBe(201);
    const token: string | undefined =
      loginRes.body?.accessToken ?? loginRes.body?.data?.accessToken;
    expect(typeof token).toBe('string');

    const distRes = await request(app.getHttpServer())
      .get('/distributions')
      .set('Authorization', `Bearer ${token}`);
    expect(distRes.status).toBe(200);
    const distributions = Array.isArray(distRes.body)
      ? distRes.body
      : Array.isArray(distRes.body?.data)
        ? distRes.body.data
        : [];
    const distributionId: string | undefined = distributions[0]?.id;

    const createRes = await request(app.getHttpServer())
      .post('/shipments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `E2E 8500 Import ${Date.now()}`,
        provider: 'BH Telecom',
        receivedDate: '2026-11-20T10:00:00.000Z',
        ...(distributionId ? { distributionId } : {}),
      });
    expect(createRes.status).toBe(201);
    const shipmentId: string | undefined = createRes.body?.id ?? createRes.body?.data?.id;
    expect(typeof shipmentId).toBe('string');

    const rowCount = 8_500;
    const suffix = String(Date.now()).slice(-4);
    const lines = ['ICCID,IP,Public_IP,Phone,APN'];
    for (let i = 0; i < rowCount; i += 1) {
      const iccid = `893879${suffix}${String(1000000000 + i)}`;
      const third = Math.floor(i / 250);
      const fourth = (i % 250) + 1;
      const ip = `10.${90 + Math.floor(third / 250)}.${third % 250}.${fourth}`;
      const pubIp = `198.${51 + Math.floor(third / 250)}.${third % 250}.${fourth}`;
      const phone = `069${suffix}${String(10000 + i)}`;
      lines.push(`${iccid},${ip},${pubIp},${phone},e2e.apn`);
    }
    const csvBuffer = Buffer.from(lines.join('\n'), 'utf8');

    try {
      const previewRes = await request(app.getHttpServer())
        .post(`/shipments/${shipmentId}/import`)
        .set('Authorization', `Bearer ${token}`)
        .field('applyImport', 'false')
        .attach('file', csvBuffer, { filename: 'e2e-8500.csv', contentType: 'text/csv' });

      expect(previewRes.status).toBe(201);
      const previewBody = previewRes.body?.data ?? previewRes.body;
      expect(previewBody.mode).toBe('preview');
      expect(previewBody.summary?.totalRows).toBe(rowCount);
      expect(previewBody.summary?.validRows).toBe(rowCount);

      const applyRes = await request(app.getHttpServer())
        .post(`/shipments/${shipmentId}/import`)
        .set('Authorization', `Bearer ${token}`)
        .field('applyImport', 'true')
        .field('importAllValid', 'true')
        .attach('file', csvBuffer, { filename: 'e2e-8500.csv', contentType: 'text/csv' });

      expect(applyRes.status).toBe(201);
      const applyBody = applyRes.body?.data ?? applyRes.body;
      expect(applyBody.mode).toBe('import');
      expect(applyBody.insertedRows).toBe(rowCount);
      expect(applyBody.skippedRows).toBe(0);

      const detailRes = await request(app.getHttpServer())
        .get(`/shipments/${shipmentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(detailRes.status).toBe(200);
      const detailBody = detailRes.body?.data ?? detailRes.body;
      expect(detailBody.totalCards).toBe(rowCount);
      expect(detailBody._count?.simCards).toBe(rowCount);
    } finally {
      if (shipmentId) {
        await request(app.getHttpServer())
          .delete(`/shipments/${shipmentId}`)
          .set('Authorization', `Bearer ${token}`);
      }
    }
  }, 120_000);
});
