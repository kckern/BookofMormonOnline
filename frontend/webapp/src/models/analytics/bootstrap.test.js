import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(
  path.resolve(__dirname, '../../../public/index.html'),
  'utf8'
);

test('the static bootstrap is vendor-neutral', () => {
  expect(html).not.toMatch(/clicky/i);
  expect(html).toMatch(/bom:analytics-pageview/);
});

test('the SPA observer skips the initial path to avoid a duplicate pageview', () => {
  const initialPath = html.indexOf(
    'window.lastPath = window.location.pathname'
  );
  const observer = html.indexOf('new MutationObserver');

  expect(initialPath).toBeGreaterThan(-1);
  expect(observer).toBeGreaterThan(initialPath);
});
