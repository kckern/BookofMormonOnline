import { GOALS } from './goals';
test('GOALS catalog has the 10 known goals with stable string values', () => {
  expect(GOALS).toEqual({
    SIGNIN: 'signin', SIGNUP: 'signup', COMMENT: 'comment', STUDY: 'study',
    READ: 'read', WATCH: 'watch', FINISH: 'finish', LANGUAGE: 'language',
    KR_BUY: 'kr_buy', KR_DOWNLOAD: 'kr_download',
  });
});
