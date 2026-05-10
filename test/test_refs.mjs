import { ApolloServer } from 'apollo-server-express';
import { buildFederatedSchema } from '@apollo/federation';
import typeDefs from '../src/typeDefs/index.js';
import resolvers from '../src/resolvers/index.js';
import { models } from '../src/config/database.js';

const schema = buildFederatedSchema([{ typeDefs, resolvers }]);
const server = new ApolloServer({ schema });

async function testPassageNotesRefs() {
  console.log('Testing passagenotes refs...');
  
  const query = `
    query {
      passagenotes(verse_ids: [23650, 23651, 23652]) {
        refs {
          verse_id
          ref
          type
          significant
        }
      }
    }
  `;

  try {
    const result = await server.executeOperation({
      query,
    });
    
    console.log('Query result:', JSON.stringify(result, null, 2));
    
    if (result.data?.passagenotes?.refs) {
      console.log('✅ Refs found:', result.data.passagenotes.refs.length, 'references');
      result.data.passagenotes.refs.slice(0, 3).forEach((ref, i) => {
        console.log(`  ${i+1}. verse_id: ${ref.verse_id}, ref: ${ref.ref}, type: ${ref.type}, significant: ${ref.significant}`);
      });
    } else {
      console.log('❌ No refs found or error occurred');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testPassageNotesRefs();
