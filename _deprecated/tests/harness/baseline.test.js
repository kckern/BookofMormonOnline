const fs = require('fs');
const os = require('os');
const path = require('path');
const { saveBaseline, loadBaseline } = require('./baseline');

describe('baseline storage', () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); delete process.env.RECAPTURE; });

  test('round-trips a body', () => {
    saveBaseline('en', 'person', 'single', { data: { person: [{ slug: 'nephi' }] } }, { dir });
    expect(loadBaseline('en', 'person', 'single', { dir }))
      .toEqual({ data: { person: [{ slug: 'nephi' }] } });
  });

  test('refuses overwrite without RECAPTURE=1', () => {
    saveBaseline('en', 'person', 'single', { v: 1 }, { dir });
    const second = saveBaseline('en', 'person', 'single', { v: 2 }, { dir });
    expect(second.written).toBe(false);
    expect(loadBaseline('en', 'person', 'single', { dir })).toEqual({ v: 1 });
  });

  test('overwrites with RECAPTURE=1', () => {
    saveBaseline('en', 'person', 'single', { v: 1 }, { dir });
    process.env.RECAPTURE = '1';
    saveBaseline('en', 'person', 'single', { v: 2 }, { dir });
    expect(loadBaseline('en', 'person', 'single', { dir })).toEqual({ v: 2 });
  });

  test('missing baseline fails loudly with capture instructions', () => {
    expect(() => loadBaseline('ko', 'person', 'single', { dir }))
      .toThrow(/Missing baseline.*test:gql:capture/s);
  });
});
