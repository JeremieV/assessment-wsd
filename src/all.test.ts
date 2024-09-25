import request from 'supertest';
import app from './task2';

const futureEvent = `https://www.betmgm.co.uk/sports#racing/event/1021685425`;
const pastEvent = `https://www.betmgm.co.uk/sports#racing/event/1021694011`;
// const internationalEvent = `https://www.betmgm.co.uk/sports#racing/event/1021694152`;

describe('Single test suite for the entire API', () => {
  // 200 seconds just in case
  // the time it takes to run these tests is very long because
  // in some cases we have to wait for the request to time out
  jest.setTimeout(100_000);

  // POST /login route

  it('should fail for requests missing a body', async () => {
    const res = await request(app)
      .post('/login');

    expect(res.status).toBe(400);
  });

  it('should fail for requests missing a username', async () => {
    const res = await request(app)
      .post('/login')
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return an non-empty auth token', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'test' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  // GET /odds route

  it('should fail for unauthenticated requests (without body)', async () => {
    const res = await request(app)
      .get('/odds');

    expect(res.status).toBe(401);
  });

  it('should fail for unauthenticated requests (with body)', async () => {
    const res = await request(app)
      .get('/odds')
      .send({ eventUrl: 'https://www.betmgm.co.uk' });

    expect(res.status).toBe(401);
  });

  it('should fail for requests made on another bookmaker', async () => {
    // aquire token
    const loginRes = await request(app)
      .post('/login')
      .send({ username: 'test' });

    const token = loginRes.body.token;

    const res = await request(app)
      .get('/odds')
      .set('Authorization', `Bearer ${token}`)
      // this is an event scheduled in the future
      .send({ eventUrl: 'https://www.bet365.com/#/AC/B2/C101/D20240925/E20998544/F162335784/' });

    expect(res.status).toBe(400);
  });

  it('should fail for an event that has already passed', async () => {
    // aquire token
    const loginRes = await request(app)
      .post('/login')
      .send({ username: 'test' });

    const token = loginRes.body.token;

    const res = await request(app)
      .get('/odds')
      .set('Authorization', `Bearer ${token}`)
      // this is an event that happened in the past
      .send({ eventUrl: pastEvent });

    expect(res.status).toBe(400);
  });

  it('should succeed for future events', async () => {
    // aquire token
    const loginRes = await request(app)
      .post('/login')
      .send({ username: 'test' });

    const token = loginRes.body.token;

    const res = await request(app)
      .get('/odds')
      .set('Authorization', `Bearer ${token}`)
      // this is an event scheduled in the future
      .send({ eventUrl: futureEvent });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('eventUrl');
    expect(res.body).toHaveProperty('horses');
    expect(res.body.horses.length).toBeGreaterThan(0);

    for (const horse of res.body.horses) {
      expect(horse).toHaveProperty('name');
      expect(horse).toHaveProperty('odds');

      // name should be a non-empty string
      expect(typeof horse.name).toBe('string');
      expect(horse.name.length).toBeGreaterThan(0);

      // odds should be a fractional odd
      expect(typeof horse.odds).toBe('string');
      // odds should be a fraction or 'SP'
      if (horse.odds !== 'SP') {
        const [num, den] = horse.odds.split('/');
        expect(parseInt(num)).toBeGreaterThanOrEqual(1);
        expect(parseInt(den)).toBeGreaterThanOrEqual(1);
      }
    }
  });

  // i have remove this test because it may be hard to understand what an "international" event is
  // it('all odds should be "SP" for "international" events', async () => {
  //   // aquire token
  //   const loginRes = await request(app)
  //     .post('/login')
  //     .send({ username: 'test' });

  //   const token = loginRes.body.token;

  //   const res = await request(app)
  //     .get('/odds')
  //     .set('Authorization', `Bearer ${token}`)
  //     // this is an event scheduled in the future
  //     .send({ eventUrl: internationalEvent });

  //   expect(res.status).toBe(200);
  //   expect(res.body).toHaveProperty('eventUrl');
  //   expect(res.body).toHaveProperty('horses');
  //   expect(res.body.horses.length).toBeGreaterThan(0);

  //   for (const horse of res.body.horses) {
  //     expect(horse).toHaveProperty('name');
  //     expect(horse).toHaveProperty('odds');

  //     // name should be a non-empty string
  //     expect(typeof horse.name).toBe('string');
  //     expect(horse.name.length).toBeGreaterThan(0);

  //     // odds should be 'SP'
  //     expect(typeof horse.odds).toBe('string');
  //     expect(horse.odds).toBe('SP');
  //   }
  // });

  afterAll((done) => {
    app.close(() => done());
  });
});
