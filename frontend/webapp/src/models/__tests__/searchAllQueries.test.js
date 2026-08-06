import { prepareQueries } from '../GraphQLQueries';

test('keyword searchAll requests verseTotal and matters, no mode arg', () => {
  const [q] = prepareQueries({ searchAll: 'faith' });
  expect(q.type).toBe('searchAll');
  expect(q.query).toContain('searchAll (query: "faith")');
  expect(q.query).toContain('verseTotal');
  expect(q.query).toContain('matters { slug title snippet ref score }');
});

test('searchAllRich targets the searchAll field with mode:"rich" and type stays searchAll', () => {
  const [q] = prepareQueries({ searchAllRich: 'faith' });
  expect(q.type).toBe('searchAll');
  expect(q.query).toContain('searchAll (query: "faith", mode: "rich")');
  expect(q.query).toContain('matters { slug title snippet ref score }');
});
