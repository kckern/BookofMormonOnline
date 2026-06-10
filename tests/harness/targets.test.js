const { getTarget, urlFor } = require('./targets');

describe('targets', () => {
  const oldEnv = process.env.TARGET;
  afterEach(() => {
    if (oldEnv === undefined) {
      delete process.env.TARGET;
    } else {
      process.env.TARGET = oldEnv;
    }
  });

  test('defaults to dev', () => {
    delete process.env.TARGET;
    expect(getTarget().name).toBe('dev');
    expect(getTarget().sandbox).toBe(true);
  });

  test('resolves prod as non-sandbox', () => {
    process.env.TARGET = 'prod';
    const t = getTarget();
    expect(t.base).toBe('https://bookofmormon.online');
    expect(t.sandbox).toBe(false);
  });

  test('builds language URLs', () => {
    process.env.TARGET = 'local';
    expect(urlFor(getTarget(), 'ko')).toBe('http://localhost:5005/ko');
  });

  test('resolves next (green-field backend) as sandbox on :5006', () => {
    process.env.TARGET = 'next';
    const t = getTarget();
    expect(t.base).toBe('http://localhost:5006');
    expect(t.sandbox).toBe(true);
  });

  test('rejects unknown targets', () => {
    process.env.TARGET = 'staging';
    expect(() => getTarget()).toThrow(/Unknown TARGET/);
  });
});
