// Single source of truth for Clicky goal names. Editor-hint only (no tsc in this
// CRA/JS app): GOALS.TYPO is undefined and clicky.goal(undefined) safely no-ops.
export const GOALS = {
  SIGNIN: 'signin', SIGNUP: 'signup', COMMENT: 'comment', STUDY: 'study',
  READ: 'read', WATCH: 'watch', FINISH: 'finish', LANGUAGE: 'language',
  KR_BUY: 'kr_buy', KR_DOWNLOAD: 'kr_download',
};
/** @typedef {typeof GOALS[keyof typeof GOALS]} GoalName */
