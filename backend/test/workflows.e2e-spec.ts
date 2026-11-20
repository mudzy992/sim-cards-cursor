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
});
