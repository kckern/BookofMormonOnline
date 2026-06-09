const axios = require('axios');

// Mirrors BoMOnlineAPI.js:39-40 exactly — this IS the contract under test.
function wrapCompound(queryString) {
  let compound = '{' + queryString + '}';
  compound = compound.replace(/{mutation(.*)}/, 'mutation$1');
  return compound;
}

const defaultPost = (url, query) => axios({
  method: 'post',
  url,
  timeout: 45000, // matches the frontend client timeout
  headers: { 'Content-Type': 'application/json' },
  data: { query },
  validateStatus: () => true, // Apollo sends GraphQL errors with 400; those bodies are contract
});

async function postQuery(url, queryString, { post = defaultPost } = {}) {
  const compound = wrapCompound(queryString);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await post(url, compound);
      const body = response.data;
      if (body && typeof body === 'object' && ('data' in body || 'errors' in body)) return body;
      lastError = new Error(
        `Non-GraphQL response (HTTP ${response.status}) from ${url}: ${JSON.stringify(body).slice(0, 200)}`
      );
    } catch (error) {
      lastError = new Error(`Transport failure POSTing to ${url}: ${error.message}`);
    }
  }
  throw lastError;
}

module.exports = { wrapCompound, postQuery };
