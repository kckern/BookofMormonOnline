import fs from 'fs';
import path from 'path';
const files = [
  '../../views/User/SignUp.js', '../../views/_Common/Study/StudyChat.js',
  '../../views/_Common/Study/Study.js', '../../views/Home/Feed.js',
  '../../views/_Common/Study/StudyHall.js', '../../views/Page/Page.js',
  '../../views/Theater/Theater.js', '../../views/User/Victory.js',
  '../../views/_Common/Sidebar.js', '../../views/About/KRSEB.js',
  '../../views/Page/Narration.js',
];
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
test('no migrated view still calls window.clicky directly', () => {
  for (const f of files) expect(read(f)).not.toMatch(/window\.clicky/);
});
test('KRSEB goals are wrapped in an arrow fn (not fired at render)', () => {
  const src = read('../../views/About/KRSEB.js');
  expect(src).toMatch(/onClick=\{\(\)\s*=>\s*analytics\.goal\(GOALS\.KR_BUY\)\}/);
  expect(src).toMatch(/onClick=\{\(\)\s*=>\s*analytics\.goal\(GOALS\.KR_DOWNLOAD\)\}/);
});
