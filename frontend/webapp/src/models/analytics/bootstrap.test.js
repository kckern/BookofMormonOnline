import fs from 'fs';
import path from 'path';

// One template since react-scripts was removed: Vite's root index.html. The
// list survives so a second template (e.g. an SSR shell) would be checked too.
const TEMPLATES = ['../../../index.html']
  .map((rel) => path.resolve(__dirname, rel))
  .filter((abs) => fs.existsSync(abs));

if (!TEMPLATES.length) throw new Error('no HTML template found to check');

const templates = TEMPLATES.map((abs) => [path.basename(abs), fs.readFileSync(abs, 'utf8')]);

test.each(templates)('the static bootstrap is vendor-neutral (%s)', (_name, html) => {
  expect(html).not.toMatch(/clicky/i);
  expect(html).toMatch(/bom:analytics-pageview/);
});

test.each(templates)('the SPA observer marks the first meaningful title as the initial pageview (%s)', (_name, html) => {
  const initialPath = html.indexOf(
    'window.lastPath = window.location.pathname'
  );
  const observer = html.indexOf('new MutationObserver');

  expect(initialPath).toBeGreaterThan(-1);
  expect(observer).toBeGreaterThan(initialPath);
  expect(html).toMatch(/const initial = window\.lastTitle === undefined/);
  expect(html).toMatch(/window\.lastPath === path && !initial/);
});

test.each(templates)('the title bridge emits one initial view and later pathname changes (%s)', async (_name, html) => {
  const script = html.match(
    /<script type="text\/javascript">\s*(const defaultTitle[\s\S]*?)<\/script>/
  )[1];
  document.head.insertAdjacentHTML('afterbegin', '<title></title>');
  const title = document.querySelector('title');
  Object.defineProperty(title, 'outerText', {
    configurable: true,
    get() { return this.textContent; },
  });
  const events = [];
  const listener = (event) => events.push(event.detail);
  window.addEventListener('bom:analytics-pageview', listener);

  window.eval(script);
  title.textContent = ' ';
  await new Promise((resolve) => setTimeout(resolve, 0));
  title.textContent = 'Lehites | Book of Mormon Online';
  await new Promise((resolve) => setTimeout(resolve, 0));
  title.textContent = 'Lehites updated | Book of Mormon Online';
  await new Promise((resolve) => setTimeout(resolve, 0));
  window.history.pushState({}, '', '/study');
  title.textContent = 'Study | Book of Mormon Online';
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(events).toEqual([
    { path: '/', title: 'Lehites', initial: true },
    { path: '/study', title: 'Study', initial: false },
  ]);

  window.titleObserver.disconnect();
  window.removeEventListener('bom:analytics-pageview', listener);
  window.history.replaceState({}, '', '/');
  title.remove();
  delete window.lastPath;
  delete window.lastTitle;
});
