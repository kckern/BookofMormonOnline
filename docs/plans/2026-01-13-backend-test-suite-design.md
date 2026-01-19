# Backend Test Suite Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert all ~80 Postman GraphQL requests into a comprehensive Jest test suite organized by domain.

**Architecture:** Tests run against the real database using existing test accounts. Organized by domain (user, content, scripture, reference, community) mirroring the Postman collection structure.

**Tech Stack:** Jest, ts-jest, axios, existing GraphQL helper

---

## Structure

```
test/
├── helpers/
│   ├── graphql.ts          # (existing + enhanced)
│   ├── testData.ts         # Shared tokens, credentials, slugs
│   └── assertions.ts       # Common assertion helpers
├── setup.ts                # (existing) DB connection lifecycle
│
├── user/                   # ~30 tests
│   ├── auth.test.ts        # signin, signup, signout, socialsignin, tokensignin
│   ├── profile.test.ts     # user, editProfile, changePassword
│   ├── progress.test.ts    # userprogress, pageprogress, divisionprogress
│   └── history.test.ts     # studylog, userlog, userdailyscores
│
├── community/              # ~8 tests
│   ├── groups.test.ts      # studygrouphistory, joinGroup, loadGroupsFromHash
│   └── shortlinks.test.ts  # shortlink (get/set)
│
├── content/                # ~25 tests
│   ├── division.test.ts    # division queries
│   ├── page.test.ts        # page, section queries
│   ├── text.test.ts        # text, queue, lookup
│   └── media.test.ts       # commentary, image, publications
│
├── scripture/              # ~8 tests
│   ├── read.test.ts        # read, scripture, verses
│   └── search.test.ts      # search, lookup
│
├── reference/              # ~15 tests
│   ├── people.test.ts      # person, personList
│   ├── places.test.ts      # place, placeList
│   ├── maps.test.ts        # maps, mapstories
│   └── timeline.test.ts    # timeline, history, fax, chiasmus
│
├── regression/             # (existing 42 tests - unchanged)
│   └── ...
│
└── services/               # (existing 11 tests - unchanged)
    └── AuthService.test.ts
```

---

## Phase 1: Setup & Helpers

### Task 1.1: Create Test Data Helper

**Files:**
- Create: `test/helpers/testData.ts`

```typescript
// Tokens from Postman collection (existing test accounts)
export const TEST_TOKENS = {
  primary: '0309b46d612e932dd8c7b00ed2efdfae',
  user2: '000f816ba47633696710912db6ffbbb0',
  user3: '00cf38c20c878e8fabef8a1a1669de54',
  user4: '27095f03c04b827dcc750a14947e00ff',
  user5: '028ffcba9790e8bac5086c1411a90e23',
  newSession: '2abb97d6f314acaddca76804b368060',
};

export const TEST_CREDENTIALS = {
  username: 'kckern',
  password: 'password1',
};

export const TEST_SLUGS = {
  division: 'lehites',
  page: 'jacobs-sermon',
  section: 'lehis-prophetic-call',
  text: 'lehites/93',
  person: 'samuel-the-prophet',
  place: 'zarahemla',
  map: 'internal',
};
```

**Commit:** `test: add test data helper with tokens and slugs`

---

### Task 1.2: Create Assertions Helper

**Files:**
- Create: `test/helpers/assertions.ts`

```typescript
export const expectNoErrors = (result: { errors?: unknown[] }) => {
  expect(result.errors).toBeUndefined();
};

export const expectSuccess = (
  result: { data?: Record<string, { isSuccess: boolean }> },
  field: string
) => {
  expect(result.data?.[field]?.isSuccess).toBe(true);
};

export const expectArrayWithItems = (arr: unknown[] | undefined) => {
  expect(arr).toBeDefined();
  expect(Array.isArray(arr)).toBe(true);
  expect(arr!.length).toBeGreaterThan(0);
};

export const expectDefined = (value: unknown, ...fields: string[]) => {
  expect(value).toBeDefined();
  fields.forEach(field => {
    expect(value).toHaveProperty(field);
  });
};
```

**Commit:** `test: add common assertion helpers`

---

### Task 1.3: Enhance GraphQL Helper

**Files:**
- Modify: `test/helpers/graphql.ts`

Add these exports:

```typescript
// Alias for clarity
export const executeMutation = executeQuery;

// Helper for authenticated queries
export const executeAuthQuery = (
  query: string,
  token: string,
  variables?: Record<string, unknown>
) => executeQuery(query, { ...variables, token });
```

**Commit:** `test: enhance graphql helper with mutation and auth helpers`

---

### Task 1.4: Update npm Scripts

**Files:**
- Modify: `package.json`

Add to scripts:

```json
{
  "test:user": "jest test/user --verbose",
  "test:content": "jest test/content --verbose",
  "test:scripture": "jest test/scripture --verbose",
  "test:community": "jest test/community --verbose",
  "test:reference": "jest test/reference --verbose",
  "test:fast": "jest test/services --verbose",
  "test:coverage": "jest --coverage"
}
```

**Commit:** `test: add domain-specific npm test scripts`

---

## Phase 2: User Domain Tests (~30 tests)

### Task 2.1: Auth Tests

**Files:**
- Create: `test/user/auth.test.ts`

**Tests from Postman:**
- SignIn
- SignIn Simple
- Token Sign In
- Token Sign In No HTTP
- Sign Up
- Sign Out
- Social Sign In
- Naver (social)

```typescript
import { executeQuery, executeMutation } from '../helpers/graphql';
import { TEST_TOKENS, TEST_CREDENTIALS } from '../helpers/testData';
import { expectNoErrors, expectSuccess } from '../helpers/assertions';

describe('User Authentication', () => {
  describe('signin', () => {
    // From Postman: "SignIn"
    it('should authenticate with valid credentials', async () => {
      const { data, errors } = await executeQuery(`
        {
          signin(
            username: "${TEST_CREDENTIALS.username}"
            password: "${TEST_CREDENTIALS.password}"
            token: "${TEST_TOKENS.newSession}"
          ) {
            isSuccess
            msg
            user {
              user
              email
              name
              bookmark
              progress { completed started }
              networks { network social_id }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expectSuccess({ data }, 'signin');
      expect(data?.signin.user).toBeDefined();
    });

    // From Postman: "SignIn Simple"
    it('should return minimal signin response', async () => {
      const { data, errors } = await executeQuery(`
        {
          signin(
            username: "${TEST_CREDENTIALS.username}"
            password: "${TEST_CREDENTIALS.password}"
            token: "${TEST_TOKENS.newSession}"
          ) {
            isSuccess
            msg
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.signin).toHaveProperty('isSuccess');
      expect(data?.signin).toHaveProperty('msg');
    });
  });

  describe('tokensignin', () => {
    // From Postman: "Token Sign In"
    it('should authenticate with existing token', async () => {
      const { data, errors } = await executeQuery(`
        {
          tokensignin(token: "${TEST_TOKENS.user2}") {
            isSuccess
            msg
            user { user email name }
            social { user_id nickname profile_url access_token }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.tokensignin).toBeDefined();
    });

    // From Postman: "Token Sign In No HTTP"
    it('should return user without social data', async () => {
      const { data, errors } = await executeQuery(`
        {
          tokensignin(token: "${TEST_TOKENS.newSession}") {
            isSuccess
            msg
            user { user email name progress { completed started } }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.tokensignin).toBeDefined();
    });
  });

  describe('signout', () => {
    // From Postman: "Sign Out"
    it('should sign out user', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          signout(token: "${TEST_TOKENS.newSession}")
        }
      `);

      expectNoErrors({ errors });
      expect(data?.signout).toBeDefined();
    });
  });
});
```

**Commit:** `test: add user auth tests (signin, tokensignin, signout)`

---

### Task 2.2: Profile Tests

**Files:**
- Create: `test/user/profile.test.ts`

**Tests from Postman:**
- User
- Edit Profile
- Change Password

```typescript
import { executeQuery, executeMutation } from '../helpers/graphql';
import { TEST_TOKENS } from '../helpers/testData';
import { expectNoErrors } from '../helpers/assertions';

describe('User Profile', () => {
  // From Postman: "User"
  describe('user', () => {
    it('should return user profile by token', async () => {
      const { data, errors } = await executeQuery(`
        {
          user(token: "${TEST_TOKENS.primary}") {
            user
            email
            name
            bookmark
            zip
            progress { completed started }
            social { user_id nickname profile_url }
            networks { network social_id }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.user).toBeDefined();
      expect(data?.user.user).toBeDefined();
    });
  });

  // From Postman: "Edit Profile"
  describe('editProfile', () => {
    it('should update user profile', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          editProfile(
            token: "${TEST_TOKENS.primary}"
            name: "Test User"
            email: "test@test.com"
            zip: "12345"
          ) {
            user
            name
            email
            zip
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.editProfile).toBeDefined();
    });
  });

  // From Postman: "Change Password"
  describe('changePassword', () => {
    it('should change user password', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          changePassword(
            token: "${TEST_TOKENS.primary}"
            password: "testpassword"
          )
        }
      `);

      expectNoErrors({ errors });
      expect(data?.changePassword).toBeDefined();
    });
  });
});
```

**Commit:** `test: add user profile tests`

---

### Task 2.3: Progress Tests

**Files:**
- Create: `test/user/progress.test.ts`

**Tests from Postman:**
- User Progress Only
- User Progress
- UserProgress
- PageProgress
- Division Progress Simple
- Division Progress
- Division Progress Details
- Top Level Progress
- Page + Progress
- DivisionProgress
- Percent of Source

```typescript
import { executeQuery } from '../helpers/graphql';
import { TEST_TOKENS, TEST_SLUGS } from '../helpers/testData';
import { expectNoErrors } from '../helpers/assertions';

describe('User Progress', () => {
  describe('userprogress', () => {
    // From Postman: "User Progress Only"
    it('should return user progress summary', async () => {
      const { data, errors } = await executeQuery(`
        {
          userprogress(token: "${TEST_TOKENS.primary}") {
            completed
            started
            summary { first duration count finished }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.userprogress).toBeDefined();
    });

    // From Postman: "UserProgress"
    it('should return basic progress', async () => {
      const { data, errors } = await executeQuery(`
        {
          userprogress(token: "${TEST_TOKENS.user4}") {
            started
            completed
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.userprogress).toBeDefined();
    });
  });

  describe('pageprogress', () => {
    // From Postman: "PageProgress"
    it('should return progress for specific page', async () => {
      const { data, errors } = await executeQuery(`
        {
          pageprogress(token: "${TEST_TOKENS.user4}", slug: ["${TEST_SLUGS.division}"]) {
            count
            completed_items
            started_items
            completed
            started
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.pageprogress).toBeDefined();
    });

    // From Postman: "Top Level Progress"
    it('should return progress with percentages', async () => {
      const { data, errors } = await executeQuery(`
        {
          pageprogress(token: "${TEST_TOKENS.primary}", slug: ["moroni"]) {
            count
            completed_perc
            started_perc
            completed
            started
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.pageprogress).toBeDefined();
    });

    // From Postman: "DivisionProgress"
    it('should return division progress without slug', async () => {
      const { data, errors } = await executeQuery(`
        {
          pageprogress(token: "${TEST_TOKENS.primary}") {
            count
            completed
            started
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.pageprogress).toBeDefined();
    });
  });

  describe('division with progress', () => {
    // From Postman: "Division Progress Simple"
    it('should return divisions with progress', async () => {
      const { data, errors } = await executeQuery(`
        {
          division {
            title
            slug
            description
            progress(token: "${TEST_TOKENS.user5}") {
              completed
              started
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.division).toBeDefined();
    });
  });

  describe('page with progress', () => {
    // From Postman: "Page + Progress"
    it('should return page with progress', async () => {
      const { data, errors } = await executeQuery(`
        {
          page(slug: ["land-of-nephi"]) {
            slug
            title
            sections { title }
            progress(token: "${TEST_TOKENS.primary}") {
              completed
              started
              completed_items
              started_items
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.page).toBeDefined();
    });
  });

  describe('sourceUsage', () => {
    // From Postman: "Percent of Source"
    it('should return source usage percentage', async () => {
      const { data, errors } = await executeQuery(`
        {
          sourceUsage(token: "${TEST_TOKENS.primary}", source: "11")
        }
      `);

      expectNoErrors({ errors });
      expect(data?.sourceUsage).toBeDefined();
    });
  });
});
```

**Commit:** `test: add user progress tests`

---

### Task 2.4: History Tests

**Files:**
- Create: `test/user/history.test.ts`

**Tests from Postman:**
- UserHistory
- UserHistorySummary
- UserDailyScore
- UserDailyScore-simple
- User History
- Log and Recalculate
- CloseTab

```typescript
import { executeQuery, executeMutation } from '../helpers/graphql';
import { TEST_TOKENS } from '../helpers/testData';
import { expectNoErrors } from '../helpers/assertions';

describe('User History', () => {
  describe('studylog', () => {
    // From Postman: "UserHistory"
    it('should return study log with sessions', async () => {
      const { data, errors } = await executeQuery(`
        {
          studylog(token: "${TEST_TOKENS.primary}") {
            summary { first duration count finished }
            sessions { datetime timestamp duration description slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.studylog).toBeDefined();
    });

    // From Postman: "UserHistorySummary"
    it('should return study log summary only', async () => {
      const { data, errors } = await executeQuery(`
        {
          studylog(token: "${TEST_TOKENS.user4}") {
            summary { first duration count finished }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.studylog).toBeDefined();
    });
  });

  describe('userdailyscores', () => {
    // From Postman: "UserDailyScore"
    it('should return daily scores', async () => {
      const { data, errors } = await executeQuery(`
        {
          userdailyscores(token: "<test-token>") {
            dates
            progress
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.userdailyscores).toBeDefined();
    });

    // From Postman: "UserDailyScore-simple"
    it('should return simple daily scores', async () => {
      const { data, errors } = await executeQuery(`
        {
          userdailyscores(token: "${TEST_TOKENS.primary}") {
            dates
            progress
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.userdailyscores).toBeDefined();
    });
  });

  describe('userlog', () => {
    // From Postman: "User History"
    it('should return user log sessions', async () => {
      const { data, errors } = await executeQuery(`
        {
          userlog(token: "${TEST_TOKENS.primary}") {
            sessions { datetime timestamp duration description slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.userlog).toBeDefined();
    });
  });

  describe('log mutation', () => {
    // From Postman: "Log and Recalculate"
    it('should log activity and return progress', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          log(
            token: "${TEST_TOKENS.user3}"
            key: "block"
            val: "downfall/101"
          ) {
            logged
            progress { completed started }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.log).toBeDefined();
    });
  });

  describe('closetab', () => {
    // From Postman: "CloseTab"
    it('should close tab for user', async () => {
      const { data, errors } = await executeQuery(`
        {
          closetab(token: "${TEST_TOKENS.primary}")
        }
      `);

      expectNoErrors({ errors });
      expect(data?.closetab).toBeDefined();
    });
  });
});
```

**Commit:** `test: add user history tests`

---

## Phase 3: Content Domain Tests (~25 tests)

### Task 3.1: Division Tests

**Files:**
- Create: `test/content/division.test.ts`

**Tests from Postman:**
- Contents
- Division Shell
- Division Progress Details

```typescript
import { executeQuery } from '../helpers/graphql';
import { expectNoErrors, expectArrayWithItems } from '../helpers/assertions';

describe('Division Queries', () => {
  // From Postman: "Contents"
  describe('division with full structure', () => {
    it('should return divisions with pages and sections', async () => {
      const { data, errors } = await executeQuery(`
        {
          division {
            title
            description
            pages {
              title
              slug
              sections { title slug }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.division);
    });
  });

  // From Postman: "Division Shell"
  describe('division shell', () => {
    it('should return divisions with page counts', async () => {
      const { data, errors } = await executeQuery(`
        {
          division {
            title
            slug
            description
            pages { slug title counts }
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.division);
    });
  });

  // From Postman: "Division Progress Details"
  describe('division details', () => {
    it('should return detailed division info', async () => {
      const { data, errors } = await executeQuery(`
        {
          division {
            title
            slug
            description
            pages { slug title counts }
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.division);
    });
  });
});
```

**Commit:** `test: add division content tests`

---

### Task 3.2: Page Tests

**Files:**
- Create: `test/content/page.test.ts`

**Tests from Postman:**
- Page(s)
- PAGE
- Section In Feed
- First Load

```typescript
import { executeQuery } from '../helpers/graphql';
import { TEST_TOKENS, TEST_SLUGS } from '../helpers/testData';
import { expectNoErrors } from '../helpers/assertions';

describe('Page Queries', () => {
  // From Postman: "Page(s)"
  describe('page', () => {
    it('should return page with full structure', async () => {
      const { data, errors } = await executeQuery(`
        {
          page(slug: ["${TEST_SLUGS.page}"]) {
            title
            slug
            sections {
              title
              slug
              rows {
                weight
                type
                narration {
                  description
                  text {
                    guid slug heading duration content
                    people { slug name title }
                    places { slug name info }
                  }
                }
                connection { isPage type text slug }
                capsulation { description reference slug }
              }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.page).toBeDefined();
    });
  });

  // From Postman: "Section In Feed"
  describe('section', () => {
    it('should return section with rows', async () => {
      const { data, errors } = await executeQuery(`
        {
          section(slug: ["${TEST_SLUGS.section}"]) {
            slug
            title
            page { title }
            rows {
              narration { description }
              capsulation { description }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.section).toBeDefined();
    });
  });

  // From Postman: "First Load"
  describe('first load', () => {
    it('should return division, labels, and user session', async () => {
      const { data, errors } = await executeQuery(`
        {
          division {
            title
            slug
            description
            pages { slug title counts }
          }
          labels { key val }
          tokensignin(token: "${TEST_TOKENS.user2}") {
            isSuccess
            msg
            user { user email name }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.division).toBeDefined();
      expect(data?.labels).toBeDefined();
      expect(data?.tokensignin).toBeDefined();
    });
  });
});
```

**Commit:** `test: add page and section content tests`

---

### Task 3.3: Text Tests

**Files:**
- Create: `test/content/text.test.ts`

**Tests from Postman:**
- LoadInFeed
- Text in Feed
- Queue
- Lookup

```typescript
import { executeQuery } from '../helpers/graphql';
import { TEST_TOKENS, TEST_SLUGS } from '../helpers/testData';
import { expectNoErrors } from '../helpers/assertions';

describe('Text Queries', () => {
  // From Postman: "LoadInFeed"
  describe('text basic', () => {
    it('should return text with media IDs', async () => {
      const { data, errors } = await executeQuery(`
        {
          text(slug: "${TEST_SLUGS.text}") {
            heading
            content
            imgIds
            comIds
            narration { description }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.text).toBeDefined();
    });
  });

  // From Postman: "Text in Feed"
  describe('text with context', () => {
    it('should return text with parent info and refs', async () => {
      const { data, errors } = await executeQuery(`
        {
          text(slug: ["lehites/2"]) {
            heading
            content
            imgIds
            comIds
            refs { verse_id ref significant }
            parent_page { title }
            parent_section { title }
            narration { description }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.text).toBeDefined();
    });
  });

  // From Postman: "Queue"
  describe('queue', () => {
    it('should return queued items', async () => {
      const { data, errors } = await executeQuery(`
        {
          queue(
            token: "${TEST_TOKENS.primary}"
            items: [{ reference: "3 Ne 11" }]
          ) {
            status(token: "${TEST_TOKENS.primary}")
            heading
            content
            slug
            duration
            next { slug text }
            people { slug name }
            places { slug name }
          }
        }
      `, {}, 'en');

      expectNoErrors({ errors });
      expect(data?.queue).toBeDefined();
    });
  });

  // From Postman: "Lookup"
  describe('lookup', () => {
    it('should lookup text by reference', async () => {
      const { data, errors } = await executeQuery(`
        {
          lookup(ref: ["Alma 5:3-30"]) {
            slug
            heading
            guid
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.lookup).toBeDefined();
    });
  });
});
```

**Commit:** `test: add text content tests`

---

### Task 3.4: Media Tests

**Files:**
- Create: `test/content/media.test.ts`

**Tests from Postman:**
- Commentary
- Publications
- PassageNotes
- Image
- Image in Feed
- Commentary in Feed
- Image Locations
- Commentary Locations
- Preload Com&Img

```typescript
import { executeQuery } from '../helpers/graphql';
import { expectNoErrors } from '../helpers/assertions';

describe('Media Queries', () => {
  describe('commentary', () => {
    // From Postman: "Publications"
    it('should return commentary with publication info', async () => {
      const { data, errors } = await executeQuery(`
        {
          commentary(id: ["1000001101"]) {
            id
            slug
            title
            reference
            publication {
              source_title
              source_name
              source_slug
              source_id
              source_url
              source_publisher
              source_year
            }
            location { heading slug }
            text
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.commentary).toBeDefined();
    });

    // From Postman: "Commentary in Feed"
    it('should return commentary with location context', async () => {
      const { data, errors } = await executeQuery(`
        {
          commentary(id: ["1000001101"]) {
            id
            title
            text
            publication { source_title source_name source_id }
            location {
              heading
              slug
              parent_page { title }
              parent_section { title }
              imgIds
              comIds
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.commentary).toBeDefined();
    });

    // From Postman: "Commentary Locations"
    it('should return commentary locations', async () => {
      const { data, errors } = await executeQuery(`
        {
          commentary(id: ["1000001101"]) {
            id
            reference
            location { slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.commentary).toBeDefined();
    });
  });

  describe('publications', () => {
    // From Postman: "Commentary"
    it('should return all publications', async () => {
      const { data, errors } = await executeQuery(`
        {
          publications {
            source_id
            source_title
            source_name
            source_slug
            source_url
            source_publisher
            source_description
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.publications).toBeDefined();
    });
  });

  describe('image', () => {
    // From Postman: "Image"
    it('should return image by ID', async () => {
      const { data, errors } = await executeQuery(`
        {
          image(id: ["1000"]) {
            id
            title
            artist
            link
            width
            height
            location { slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.image).toBeDefined();
    });

    // From Postman: "Image in Feed"
    it('should return image with location context', async () => {
      const { data, errors } = await executeQuery(`
        {
          image(id: ["1000"]) {
            id
            title
            artist
            link
            location {
              heading
              slug
              imgIds
              comIds
              parent_page { title }
              parent_section { title }
              narration { description }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.image).toBeDefined();
    });

    // From Postman: "Image Locations"
    it('should return image locations', async () => {
      const { data, errors } = await executeQuery(`
        {
          image(id: ["1000", "1001"]) {
            id
            location { slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.image).toBeDefined();
    });
  });

  describe('preload', () => {
    // From Postman: "Preload Com&Img"
    it('should preload commentary and images', async () => {
      const { data, errors } = await executeQuery(`
        {
          commentary(id: ["1000006101"]) {
            id
            slug
            title
            reference
            publication { source_title source_name source_slug }
            location { slug }
            text
          }
          image(id: ["2077", "1251"]) {
            id
            title
            artist
            link
            width
            height
            location { slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.commentary).toBeDefined();
      expect(data?.image).toBeDefined();
    });
  });
});
```

**Commit:** `test: add media content tests (commentary, image, publications)`

---

## Phase 4: Scripture Domain Tests (~8 tests)

### Task 4.1: Read Tests

**Files:**
- Create: `test/scripture/read.test.ts`

**Tests from Postman:**
- Read
- Scripture

```typescript
import { executeQuery } from '../helpers/graphql';
import { expectNoErrors } from '../helpers/assertions';

describe('Scripture Read Queries', () => {
  // From Postman: "Read"
  describe('read', () => {
    it('should return read block with sections', async () => {
      const { data, errors } = await executeQuery(`
        {
          read(ref: "3ne11") {
            ref
            verse_id
            verse_count
            sections {
              ref
              heading
              verse_id
              verse_count
              blocks {
                ref
                verse_id
                verse_count
                person_slug
                voice
                lines { ref verse_num verse_id text }
              }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.read).toBeDefined();
      expect(data?.read.sections).toBeDefined();
    });
  });

  // From Postman: "Scripture"
  describe('scripture', () => {
    it('should return scripture by reference', async () => {
      const { data, errors } = await executeQuery(`
        {
          scripture(ref: "1 ne 5.1-4") {
            ref
            passages {
              reference
              heading
              meta
              verses { verse text }
            }
            verses { book chapter verse text }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.scripture).toBeDefined();
    });
  });
});
```

**Commit:** `test: add scripture read tests`

---

### Task 4.2: Search Tests

**Files:**
- Create: `test/scripture/search.test.ts`

**Tests from Postman:**
- Search
- Sphinx
- Markdown Copy

```typescript
import { executeQuery } from '../helpers/graphql';
import { expectNoErrors, expectArrayWithItems } from '../helpers/assertions';

describe('Scripture Search Queries', () => {
  // From Postman: "Search"
  describe('search', () => {
    it('should return search results', async () => {
      const { data, errors } = await executeQuery(`
        {
          search(query: "spirit") {
            reference
            text
            slug
            page
            section
            narration
            speaker
            voice
            lang
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.search).toBeDefined();
    });

    // From Postman: "Sphinx"
    it('should search common phrases', async () => {
      const { data, errors } = await executeQuery(`
        {
          search(query: "came to pass") {
            reference
            text
            slug
            page
            section
            narration
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.search);
    });
  });
});
```

**Commit:** `test: add scripture search tests`

---

## Phase 5: Reference Domain Tests (~15 tests)

### Task 5.1: People Tests

**Files:**
- Create: `test/reference/people.test.ts`

**Tests from Postman:**
- Person
- PersonList

```typescript
import { executeQuery } from '../helpers/graphql';
import { TEST_SLUGS } from '../helpers/testData';
import { expectNoErrors, expectArrayWithItems } from '../helpers/assertions';

describe('People Queries', () => {
  // From Postman: "Person"
  describe('person by slug', () => {
    it('should return person with full details', async () => {
      const { data, errors } = await executeQuery(`
        {
          person(slug: ["${TEST_SLUGS.person}"]) {
            slug
            name
            title
            classification
            unit
            date
            description
            relations {
              relation
              person { name slug title }
            }
            index { slug ref text }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.person).toBeDefined();
    });
  });

  // From Postman: "PersonList"
  describe('person list', () => {
    it('should return all people', async () => {
      const { data, errors } = await executeQuery(`
        {
          person {
            slug
            name
            title
            classification
            unit
            date
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.person);
    });
  });
});
```

**Commit:** `test: add people reference tests`

---

### Task 5.2: Places Tests

**Files:**
- Create: `test/reference/places.test.ts`

**Tests from Postman:**
- Place
- PlaceList

```typescript
import { executeQuery } from '../helpers/graphql';
import { TEST_SLUGS } from '../helpers/testData';
import { expectNoErrors, expectArrayWithItems } from '../helpers/assertions';

describe('Places Queries', () => {
  // From Postman: "Place"
  describe('place by slug', () => {
    it('should return place with full details', async () => {
      const { data, errors } = await executeQuery(`
        {
          place(slug: "${TEST_SLUGS.place}") {
            slug
            name
            info
            occupants
            type
            location
            description
            maps { slug name }
            index { slug ref text }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.place).toBeDefined();
    });
  });

  // From Postman: "PlaceList"
  describe('place list', () => {
    it('should return all places', async () => {
      const { data, errors } = await executeQuery(`
        {
          place {
            slug
            name
            info
            occupants
            type
            location
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.place);
    });
  });
});
```

**Commit:** `test: add places reference tests`

---

### Task 5.3: Maps Tests

**Files:**
- Create: `test/reference/maps.test.ts`

**Tests from Postman:**
- Map List
- Map *
- MapStories

```typescript
import { executeQuery } from '../helpers/graphql';
import { TEST_SLUGS } from '../helpers/testData';
import { expectNoErrors, expectArrayWithItems } from '../helpers/assertions';

describe('Maps Queries', () => {
  // From Postman: "Map List"
  describe('maps list', () => {
    it('should return all maps', async () => {
      const { data, errors } = await executeQuery(`
        {
          maps {
            slug
            name
            desc
            centerx
            centery
            minzoom
            maxzoom
            zoom
            tiles
          }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.maps);
    });
  });

  // From Postman: "Map *"
  describe('map by slug', () => {
    it('should return map with places', async () => {
      const { data, errors } = await executeQuery(`
        {
          maps(slug: ["${TEST_SLUGS.map}"]) {
            slug
            name
            desc
            centerx
            centery
            zoom
            tiles
            places {
              slug
              name
              label
              icon
              info
              lng
              lat
              minZoom
              maxZoom
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.maps).toBeDefined();
    });
  });

  // From Postman: "MapStories"
  describe('mapstories', () => {
    it('should return map stories with moves', async () => {
      const { data, errors } = await executeQuery(`
        {
          mapstories(map: "neareast") {
            slug
            title
            description
            moves {
              seq
              travelers
              people { slug name }
              description
              startPlace { slug lat lng }
              endPlace { slug lat lng }
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.mapstories).toBeDefined();
    });
  });
});
```

**Commit:** `test: add maps reference tests`

---

### Task 5.4: Timeline Tests

**Files:**
- Create: `test/reference/timeline.test.ts`

**Tests from Postman:**
- Timeline *
- History
- Fax
- Fax Index
- Chiasm
- About *
- Labels Copy

```typescript
import { executeQuery } from '../helpers/graphql';
import { expectNoErrors, expectArrayWithItems } from '../helpers/assertions';

describe('Timeline & Reference Queries', () => {
  // From Postman: "Timeline *"
  describe('timeline', () => {
    it('should return timeline events', async () => {
      const { data, errors } = await executeQuery(`
        {
          timeline {
            slug
            file
            heading
            date
            html
            x y w h o z p
            text { slug }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.timeline).toBeDefined();
    });
  });

  // From Postman: "History"
  describe('history', () => {
    it('should return history document', async () => {
      const { data, errors } = await executeQuery(`
        {
          history(slug: "1829-08-31-golden-bible") {
            seq
            id
            slug
            year
            date
            link
            type
            source
            author
            document
            citation
            teaser
            transcript
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.history).toBeDefined();
    });
  });

  // From Postman: "Fax"
  describe('fax', () => {
    it('should return facsimile list', async () => {
      const { data, errors } = await executeQuery(`
        {
          fax {
            slug
            title
            info
            code
            pages
            index
            format
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.fax).toBeDefined();
    });
  });

  // From Postman: "Fax Index"
  describe('faxIndex', () => {
    it('should return facsimile index', async () => {
      const { data, errors } = await executeQuery(`
        {
          faxIndex(slug: "1840") {
            slug
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.faxIndex).toBeDefined();
    });
  });

  // From Postman: "Chiasm"
  describe('chiasmus', () => {
    it('should return chiasmus structures', async () => {
      const { data, errors } = await executeQuery(`
        {
          chiasmus(id: []) {
            chiasmus_id
            reference
            title
            scheme
            lines {
              line_key
              line_text
              highlights
              label
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.chiasmus).toBeDefined();
    });
  });

  // From Postman: "About *"
  describe('about', () => {
    it('should return about page content', async () => {
      const { data, errors } = await executeQuery(`
        {
          about {
            title
            aboutsections { heading text }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.about).toBeDefined();
    });
  });

  // From Postman: "Labels Copy"
  describe('labels', () => {
    it('should return labels', async () => {
      const { data, errors } = await executeQuery(`
        {
          labels { key val }
        }
      `);

      expectNoErrors({ errors });
      expectArrayWithItems(data?.labels);
    });
  });
});
```

**Commit:** `test: add timeline and reference tests`

---

## Phase 6: Community Domain Tests (~8 tests)

### Task 6.1: Groups Tests

**Files:**
- Create: `test/community/groups.test.ts`

**Tests from Postman:**
- GroupHistory
- Load Group from Hash
- Join Group from Hash
- Join Open Group
- Request to Join

```typescript
import { executeQuery, executeMutation } from '../helpers/graphql';
import { TEST_TOKENS } from '../helpers/testData';
import { expectNoErrors } from '../helpers/assertions';

describe('Community Groups', () => {
  // From Postman: "GroupHistory"
  describe('studygrouphistory', () => {
    it('should return study group history', async () => {
      const { data, errors } = await executeQuery(`
        {
          studygrouphistory(
            token: "${TEST_TOKENS.primary}"
            studyGroupID: "${TEST_TOKENS.primary}"
          ) {
            studyGroupID
            studyGroupName
            dates
            userHistories { user completed }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.studygrouphistory).toBeDefined();
    });
  });

  // From Postman: "Load Group from Hash"
  describe('loadGroupsFromHash', () => {
    it('should load group by hash', async () => {
      const { data, errors } = await executeQuery(`
        {
          loadGroupsFromHash(hash: ["K5SWkCIuy"]) {
            channel_url
            name
            member_count
            cover_url
            custom_type
            data
            messages {
              message_id
              created_at
              message
              user { user_id nickname profile_url }
            }
            members {
              user_id
              is_active
              role
              is_online
              nickname
              profile_url
            }
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.loadGroupsFromHash).toBeDefined();
    });
  });

  // From Postman: "Join Group from Hash"
  describe('joinGroup', () => {
    it('should join group by hash', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          joinGroup(hash: "OFpQFwvH1", token: "${TEST_TOKENS.primary}") {
            isSuccess
            msg
            user
            channel
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.joinGroup).toBeDefined();
    });
  });

  // From Postman: "Join Open Group"
  describe('joinOpenGroup', () => {
    it('should join open group by URL', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          joinOpenGroup(
            url: "08e1a6987e4d8dab52919b6191f279aa"
            token: "${TEST_TOKENS.user3}"
          ) {
            isSuccess
            msg
            user
            channel
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.joinOpenGroup).toBeDefined();
    });
  });

  // From Postman: "Request to Join"
  describe('requestToJoinGroup', () => {
    it('should request to join group', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          requestToJoinGroup(
            url: "a8d5d36bb1b8d4afb382bb60f17bd588"
            token: "${TEST_TOKENS.user3}"
          ) {
            isSuccess
            msg
            user
            channel
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.requestToJoinGroup).toBeDefined();
    });
  });
});
```

**Commit:** `test: add community groups tests`

---

### Task 6.2: Shortlinks Tests

**Files:**
- Create: `test/community/shortlinks.test.ts`

**Tests from Postman:**
- Set Short Link
- Short Link

```typescript
import { executeQuery, executeMutation } from '../helpers/graphql';
import { expectNoErrors } from '../helpers/assertions';

describe('Shortlinks', () => {
  // From Postman: "Set Short Link"
  describe('shortlink mutation', () => {
    it('should create shortlink', async () => {
      const { data, errors } = await executeMutation(`
        mutation {
          shortlink(string: "4ef489e2de8cc731f8c9aea557e20a3c") {
            hash
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.shortlink).toBeDefined();
      expect(data?.shortlink.hash).toBeDefined();
    });
  });

  // From Postman: "Short Link"
  describe('shortlink query', () => {
    it('should resolve shortlink hash', async () => {
      const { data, errors } = await executeQuery(`
        {
          shortlink(hash: "LhE7TdMls") {
            string
          }
        }
      `);

      expectNoErrors({ errors });
      expect(data?.shortlink).toBeDefined();
    });
  });
});
```

**Commit:** `test: add shortlinks tests`

---

## Summary

| Phase | Domain | Files | Tests |
|-------|--------|-------|-------|
| 1 | Setup | 3 | - |
| 2 | User | 4 | ~30 |
| 3 | Content | 4 | ~25 |
| 4 | Scripture | 2 | ~8 |
| 5 | Reference | 4 | ~15 |
| 6 | Community | 2 | ~8 |
| **Total** | | **19 files** | **~86 tests** |

Plus existing:
- `test/regression/` - 42 tests
- `test/services/AuthService.test.ts` - 11 tests

**Grand total: ~139 tests**
