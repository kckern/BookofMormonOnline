import fs from 'fs';
import path from 'path';
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
test('Utils.js no longer defines clickyUser', () => {
  expect(read('../Utils.js')).not.toMatch(/export function clickyUser/);
});
test('appController uses analytics.identify + goal(SIGNIN) and drops clickyUser', () => {
  const src = read('../appController.js');
  expect(src).not.toMatch(/clickyUser/);
  expect(src).toMatch(/analytics\.identify\(/);
  expect(src).toMatch(/analytics\.goal\(GOALS\.SIGNIN\)/);
});
