import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(
  path.resolve(__dirname, '../../../public/index.html'),
  'utf8'
);

test('Clicky owns the initial pageview so it can capture the external referrer', () => {
  expect(html).not.toMatch(/clicky_custom\.pageview_disable\s*=/);
  expect(html).toMatch(/clicky_custom\.history_disable\s*=\s*true/);
});

test('the SPA observer skips the initial path to avoid a duplicate pageview', () => {
  const initialPath = html.indexOf(
    'window.lastPath = window.location.pathname'
  );
  const observer = html.indexOf('new MutationObserver');

  expect(initialPath).toBeGreaterThan(-1);
  expect(observer).toBeGreaterThan(initialPath);
});
