import { fetchHighlightRange, __clearHighlightCache } from '../highlightApi';

jest.mock('axios', () => ({ __esModule: true, default: jest.fn() }));
import axios from 'axios';

jest.mock('src/models/BoMOnlineAPI', () => ({ ApiBaseUrl: 'http://api.test' }));
jest.mock('src/models/Utils', () => ({ determineLanguage: () => 'en' }));

beforeEach(() => { axios.mockReset(); __clearHighlightCache(); });

test('posts a highlight query and returns the range', async () => {
  axios.mockResolvedValue({ data: { data: { highlight: { start: 2, end: 9 } } } });
  const r = await fetchHighlightRange('afterlife', "a, b, and the resurrection");
  expect(r).toEqual({ start: 2, end: 9 });
  const arg = axios.mock.calls[0][0];
  expect(arg.method).toBe('post');
  expect(arg.data.query).toContain('highlight(query:');
  expect(arg.data.query).toContain(JSON.stringify('afterlife'));
});

test('caches by (query,text): second call does not hit axios again', async () => {
  axios.mockResolvedValue({ data: { data: { highlight: { start: 0, end: 1 } } } });
  await fetchHighlightRange('q', 't');
  await fetchHighlightRange('q', 't');
  expect(axios).toHaveBeenCalledTimes(1);
});

test('returns null on error (never throws)', async () => {
  axios.mockRejectedValue(new Error('network'));
  expect(await fetchHighlightRange('q', 'different text')).toBeNull();
});

test('null for empty query or text without calling axios', async () => {
  expect(await fetchHighlightRange('', 'x')).toBeNull();
  expect(await fetchHighlightRange('q', '')).toBeNull();
  expect(axios).not.toHaveBeenCalled();
});
