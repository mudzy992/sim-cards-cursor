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
});

