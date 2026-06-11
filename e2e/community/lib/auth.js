/**
 * Auth helper — drive the REAL SignIn.js form (no token injection).
 *
 * The SignIn form (#username / #password / the "login" button) renders on /user
 * when logged out. We submit the regression creds and wait for the app to store
 * the session token in localStorage (appController.processSignIn), which is the
 * authoritative "logged in" signal.
 */
const cfg = require('./config');

/** Read the persisted session token from localStorage (null when logged out). */
async function getToken(page) {
  return page.evaluate(() => window.localStorage.getItem('token'));
}

/**
 * Log in via the SignIn form. Returns the session token.
 * Throws (with the on-screen error) if the credentials are rejected.
 */
async function signIn(page, { username = cfg.username, password = cfg.password } = {}) {
  if (!username || !password) throw new Error('signIn: missing regression creds (tests/.env.test)');

  await page.goto(`${cfg.baseUrl}/user`, { waitUntil: 'domcontentloaded' });

  // The login form lives behind the logged-out /user view.
  const userInput = page.locator('#username');
  await userInput.waitFor({ state: 'visible', timeout: 20_000 });

  await userInput.fill(username);
  await page.locator('#password').fill(password);

  // The login button is the first button in the .Login row (sibling is "signup").
  await page.locator('.Login button.login').first().click();

  // Success = appController persisted the token. Surface a credential error fast.
  try {
    await page.waitForFunction(() => !!window.localStorage.getItem('token'), null, { timeout: 20_000 });
  } catch (e) {
    const err = await page.locator('.alert-danger').first().textContent().catch(() => null);
    throw new Error(`signIn failed${err ? `: ${err.trim()}` : ' (no token persisted, no on-screen error)'}`);
  }

  return getToken(page);
}

/** True when a session token is present. */
async function isLoggedIn(page) {
  return Boolean(await getToken(page));
}

module.exports = { signIn, getToken, isLoggedIn };
