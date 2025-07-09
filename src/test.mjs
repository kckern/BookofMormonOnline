// Test script for passagenotes resolver
// Shows examples of both parameter styles

const GRAPHQL_ENDPOINT = 'http://localhost:5005/graphql';

// Example 1: Using verse_ids array
const queryWithVerseIds = `
  query {
    passagenotes(verse_ids: [31103, 31104, 31105]) {
      commentary {
        id
        title
        preview
        reference
      }
      people {
        name
        slug
        title
      }
      places {
        name
        info
        slug
      }
      images {
        title
        file
        artist
      }
      chiasmus {
        title
        reference
        scheme
      }
      refs {
        verse_id
        ref
        type
        significant
      }
    }
  }
`;

// Example 2: Using start_verse_id and end_verse_id
const queryWithRange = `
  query {
    passagenotes(start_verse_id: 31103, end_verse_id: 31205) {
      commentary {
        id
        title
        preview
        reference
      }
      people {
        name
        slug
        title
      }
      places {
        name
        info
        slug
      }
      images {
        title
        file
        artist
      }
      chiasmus {
        title
        reference
        scheme
      }
      sources {
        source_title
        source_short
      }
      notes {
        id
        title
        text
      }
      fax {
        title
        slug
      }
      mapstory {
        title
        description
      }
      refs {
        verse_id
        ref
        type
        significant
      }
    }
  }
`;

// Example 3: Using just start_verse_id (single verse)
const queryWithSingleVerse = `
  query {
    passagenotes(start_verse_id: 31103) {
      commentary {
        id
        title
        preview
        reference
      }
      people {
        name
        slug
        title
      }
      refs {
        verse_id
        ref
        type
        significant
      }
    }
  }
`;

async function testQuery(query, description) {
  console.log(`\n--- ${description} ---`);
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.error('GraphQL Errors:', result.errors);
    } else {
      console.log('Success! Data keys:', Object.keys(result.data.passagenotes));
      console.log('Commentary count:', result.data.passagenotes.commentary?.length || 0);
      console.log('People count:', result.data.passagenotes.people?.length || 0);
      console.log('Places count:', result.data.passagenotes.places?.length || 0);
      console.log('Images count:', result.data.passagenotes.images?.length || 0);
      console.log('Refs count:', result.data.passagenotes.refs?.length || 0);
      if (result.data.passagenotes.refs?.length > 0) {
        console.log('First 3 refs:', result.data.passagenotes.refs.slice(0, 3).map(r => `${r.ref} (${r.type}, sig:${r.significant})`));
      }
    }
  } catch (error) {
    console.error('Network Error:', error.message);
  }
}

async function runTests() {
  console.log('Testing passagenotes resolver with different parameter styles...');
  
  await testQuery(queryWithVerseIds, 'Using verse_ids array [31103, 31104, 31105]');
  await testQuery(queryWithRange, 'Using start_verse_id: 31103, end_verse_id: 31105');
  await testQuery(queryWithSingleVerse, 'Using start_verse_id: 31103 only');
  
  console.log('\n--- Test Complete ---');
}

// Run the tests
runTests().catch(console.error);
