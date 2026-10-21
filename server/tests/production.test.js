// Production safeguards: settings checks, sign-in rate limits and serving the built web app.
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { checkProductionConfig } = require('../src/config/checkProduction');
const { createLoginLimiter, createResetLimiter } = require('../src/middleware/rateLimit');

const baseConfig = {
  jwtSecret: 'x'.repeat(48),
  DEV_JWT_SECRET: 'dev-only-secret-change-me',
  appUrl: 'https://portal.gvma.example',
  mail: { host: 'smtp.example.com' },
  db: { dialect: 'mysql' },
};

describe('production settings check', () => {
  test('a well-configured server has no problems or warnings', () => {
    expect(checkProductionConfig(baseConfig)).toEqual({ problems: [], warnings: [] });
  });

  test.each([
    ['missing', ''],
    ['the development default', 'dev-only-secret-change-me'],
    ['the example value', 'change-me'],
    ['too short', 'abc123'],
  ])('refuses to start when JWT_SECRET is %s', (_, secret) => {
    const { problems } = checkProductionConfig({ ...baseConfig, jwtSecret: secret });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/JWT_SECRET/);
  });

  test('warns about localhost links, plain http, no SMTP and SQLite', () => {
    const local = checkProductionConfig({ ...baseConfig, appUrl: 'http://localhost:5173', mail: { host: '' }, db: { dialect: 'sqlite' } });
    expect(local.problems).toEqual([]);
    expect(local.warnings.join(' ')).toMatch(/localhost.*SMTP_HOST.*SQLite/s);
    expect(checkProductionConfig({ ...baseConfig, appUrl: 'http://portal.gvma.example' }).warnings[0]).toMatch(/https/);
  });
});

describe('rate limits', () => {
  const appWith = (limiter, status) => {
    const app = express();
    app.use(express.json());
    app.post('/login', limiter, (req, res) => res.status(req.body.password === 'right' ? 200 : status).json({}));
    return app;
  };

  test('failed sign-ins for one email are blocked after the limit; other emails are not affected', async () => {
    const app = appWith(createLoginLimiter({ limit: 3 }), 401);
    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).post('/login').send({ email: 'a@x.test', password: 'wrong' })).status).toBe(401);
    }
    const blocked = await request(app).post('/login').send({ email: 'a@x.test', password: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Too many failed sign-in attempts/);
    // Even the right password is refused until the window passes.
    expect((await request(app).post('/login').send({ email: 'A@x.test ', password: 'right' })).status).toBe(429);
    expect((await request(app).post('/login').send({ email: 'b@x.test', password: 'wrong' })).status).toBe(401);
  });

  test('successful sign-ins do not use up attempts', async () => {
    const app = appWith(createLoginLimiter({ limit: 2 }), 401);
    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).post('/login').send({ email: 'ok@x.test', password: 'right' })).status).toBe(200);
    }
  });

  test('password reset requests are limited per address', async () => {
    const app = appWith(createResetLimiter({ limit: 2 }), 200);
    await request(app).post('/login').send({ email: 'a@x.test' });
    await request(app).post('/login').send({ email: 'b@x.test' });
    expect((await request(app).post('/login').send({ email: 'c@x.test' })).status).toBe(429);
  });
});

describe('serving the built web app', () => {
  let app;
  let dist;

  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'gvma-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
    fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    jest.isolateModules(() => {
      process.env.CLIENT_DIST = dist;
      app = require('../src/app');
      delete process.env.CLIENT_DIST;
    });
  });

  afterAll(() => fs.rmSync(dist, { recursive: true, force: true }));

  test('pages of the web app get index.html', async () => {
    const res = await request(app).get('/students/3');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  test('built assets are served with long caching', async () => {
    const res = await request(app).get('/assets/app-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  test('API addresses always get a JSON answer, never the web app page', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(401); // all API routes after login need a token
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).not.toContain('<div id="root">');
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
  });

  test('security headers are set', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
  });
});
