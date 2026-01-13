// Known good test data - slugs/IDs that exist in the database
export const fixtures = {
  // Content
  divisions: ['1-nephi', '2-nephi', 'jacob', 'enos', 'jarom', 'omni'],
  pages: ['1-nephi-1', '1-nephi-2', 'alma-32'],
  sections: ['1-nephi-1-1', '1-nephi-1-2'],
  textSlugs: ['1-nephi-1-1-1', '1-nephi-1-1-2'],

  // Scripture
  scriptureRefs: ['1 Nephi 1:1', '1 Nephi 1:1-5', 'Alma 32:21'],
  verseIds: [31103001, 31103002, 31103003], // 1 Nephi 1:1-3

  // People & Places
  people: ['nephi-1', 'lehi-1', 'laman-1', 'lemuel-1'],
  places: ['jerusalem', 'red-sea', 'bountiful'],
  maps: ['arabian-peninsula', 'promised-land'],

  // Notes
  commentaryIds: ['1', '2', '3'],
  imageIds: ['1', '2', '3'],
  chiasmusIds: ['1', '2'],

  // Search
  searchQueries: ['faith', 'repent', 'Jesus Christ', 'plates'],

  // Test user (create if needed)
  testUser: {
    username: 'testuser_regression',
    email: 'test_regression@example.com',
    password: 'testpass123',
    token: '' // Will be populated during test setup
  }
};

// Invalid data for negative tests
export const invalidFixtures = {
  nonExistentSlug: 'this-slug-does-not-exist-12345',
  nonExistentId: '99999999',
  invalidVerseId: -1,
  emptyString: '',
  nullValue: null
};

// Expected response shapes for validation
export const expectedShapes = {
  division: ['title', 'slug', 'description'],
  page: ['title', 'slug', 'sections'],
  section: ['title', 'slug', 'rows'],
  textBlock: ['guid', 'slug', 'heading', 'content'],
  person: ['slug', 'name', 'title'],
  place: ['slug', 'name', 'info'],
  searchResult: ['reference', 'text', 'slug']
};
