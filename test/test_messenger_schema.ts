/**
 * Messenger Schema Test
 * Phase 1 Validation - Sendbird Migration
 * 
 * Run with: npx ts-node test/test_messenger_schema.ts
 * 
 * This script verifies:
 * 1. All messenger tables exist
 * 2. Sequelize models initialize correctly
 * 3. Basic CRUD operations work
 * 4. Associations are properly configured
 */

import { models, sequelize } from '../src/config/database';

const TEST_USER_ID = 'test_user_schema_001';
const TEST_CHANNEL_URL = 'test_channel_schema_001';

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete in reverse order of dependencies
    await models.MessengerFile.destroy({ where: { user_id: TEST_USER_ID }, force: true });
    await models.MessengerReaction.destroy({ where: { user_id: TEST_USER_ID }, force: true });
    await models.MessengerHighlight.destroy({ 
      where: { 
        message_id: { 
          [require('sequelize').Op.in]: sequelize.literal(
            `(SELECT message_id FROM messenger_messages WHERE user_id = '${TEST_USER_ID}')`
          )
        } 
      }, 
      force: true 
    });
    await models.MessengerMessage.destroy({ where: { user_id: TEST_USER_ID }, force: true });
    await models.MessengerMember.destroy({ where: { user_id: TEST_USER_ID }, force: true });
    await models.MessengerChannel.destroy({ where: { channel_url: TEST_CHANNEL_URL }, force: true });
    await models.MessengerUser.destroy({ where: { user_id: TEST_USER_ID }, force: true });
    
    console.log('✅ Cleanup complete');
  } catch (error) {
    console.log('⚠️  Cleanup warning (tables may not exist yet):', (error as Error).message);
  }
}

async function testTableExistence() {
  console.log('\n📋 Testing table existence...');
  
  const tables = [
    'messenger_users',
    'messenger_channels', 
    'messenger_members',
    'messenger_messages',
    'messenger_highlights',
    'messenger_reactions',
    'messenger_files'
  ];
  
  const [results] = await sequelize.query("SHOW TABLES LIKE 'messenger_%'");
  const existingTables = (results as any[]).map(r => Object.values(r)[0]);
  
  for (const table of tables) {
    if (existingTables.includes(table)) {
      console.log(`  ✅ ${table}`);
    } else {
      console.log(`  ❌ ${table} - MISSING`);
      throw new Error(`Table ${table} does not exist`);
    }
  }
}

async function testUserCreation() {
  console.log('\n👤 Testing MessengerUser creation...');
  
  const user = await models.MessengerUser.create({
    user_id: TEST_USER_ID,
    nickname: 'Test User',
    profile_url: 'https://example.com/avatar.png',
    is_bot: false,
    is_online: true
  });
  
  console.log(`  ✅ User created: ${user.user_id} (${user.nickname})`);
  return user;
}

async function testChannelCreation() {
  console.log('\n📺 Testing MessengerChannel creation...');
  
  const channel = await models.MessengerChannel.create({
    channel_url: TEST_CHANNEL_URL,
    name: 'Test Channel',
    custom_type: 'private',
    description: 'A test channel for schema validation',
    lang: 'en'
  });
  
  console.log(`  ✅ Channel created: ${channel.channel_url} (${channel.name})`);
  return channel;
}

async function testMemberCreation(user: any, channel: any) {
  console.log('\n🤝 Testing MessengerMember creation...');
  
  const member = await models.MessengerMember.create({
    channel_url: channel.channel_url,
    user_id: user.user_id,
    role: 'operator',
    state: 'joined'
  });
  
  console.log(`  ✅ Member added: ${member.user_id} to ${member.channel_url} as ${member.role}`);
  return member;
}

async function testMessageCreation(user: any, channel: any) {
  console.log('\n💬 Testing MessengerMessage creation...');
  
  const message = await models.MessengerMessage.create({
    channel_url: channel.channel_url,
    user_id: user.user_id,
    message_type: 'MESG',
    message: 'Hello, this is a test message!',
    custom_type: 'text',
    link_type: 'scripture',
    link_target: '1-nephi-1:1',
    link_aux: null
  });
  
  console.log(`  ✅ Message created: ID ${message.message_id}`);
  return message;
}

async function testHighlightCreation(message: any) {
  console.log('\n🖍️  Testing MessengerHighlight creation...');
  
  const highlight = await models.MessengerHighlight.create({
    message_id: message.message_id,
    ordinal: 0,
    text: '1 Nephi 1:1'
  });
  
  console.log(`  ✅ Highlight created: ID ${highlight.id} for message ${highlight.message_id}`);
  return highlight;
}

async function testReactionCreation(message: any, user: any) {
  console.log('\n😊 Testing MessengerReaction creation...');
  
  const reaction = await models.MessengerReaction.create({
    message_id: message.message_id,
    user_id: user.user_id,
    reaction_key: '👍'
  });
  
  console.log(`  ✅ Reaction created: ${reaction.reaction_key} on message ${reaction.message_id}`);
  return reaction;
}

async function testFileCreation(message: any, user: any) {
  console.log('\n📁 Testing MessengerFile creation...');
  
  const file = await models.MessengerFile.create({
    message_id: message.message_id,
    user_id: user.user_id,
    file_url: 'https://example.com/test-file.pdf',
    file_name: 'test-file.pdf',
    file_type: 'application/pdf',
    file_size: 12345
  });
  
  console.log(`  ✅ File created: ID ${file.file_id} (${file.file_name})`);
  return file;
}

async function testAssociations(user: any, channel: any, message: any) {
  console.log('\n🔗 Testing associations...');
  
  // Test User -> Channels association
  const userWithChannels = await models.MessengerUser.findByPk(user.user_id, {
    include: [{ model: models.MessengerChannel, as: 'channels' }]
  });
  console.log(`  ✅ User has ${(userWithChannels as any)?.channels?.length || 0} channel(s)`);
  
  // Test Channel -> Members association
  const channelWithMembers = await models.MessengerChannel.findByPk(channel.channel_url, {
    include: [{ model: models.MessengerMember, as: 'members' }]
  });
  console.log(`  ✅ Channel has ${(channelWithMembers as any)?.members?.length || 0} member(s)`);
  
  // Test Channel -> Messages association
  const channelWithMessages = await models.MessengerChannel.findByPk(channel.channel_url, {
    include: [{ model: models.MessengerMessage, as: 'messages' }]
  });
  console.log(`  ✅ Channel has ${(channelWithMessages as any)?.messages?.length || 0} message(s)`);
  
  // Test Message -> Highlights association
  const messageWithHighlights = await models.MessengerMessage.findByPk(message.message_id, {
    include: [{ model: models.MessengerHighlight, as: 'highlights' }]
  });
  console.log(`  ✅ Message has ${(messageWithHighlights as any)?.highlights?.length || 0} highlight(s)`);
  
  // Test Message -> Reactions association
  const messageWithReactions = await models.MessengerMessage.findByPk(message.message_id, {
    include: [{ model: models.MessengerReaction, as: 'reactions' }]
  });
  console.log(`  ✅ Message has ${(messageWithReactions as any)?.reactions?.length || 0} reaction(s)`);
  
  // Test Message -> Files association
  const messageWithFiles = await models.MessengerMessage.findByPk(message.message_id, {
    include: [{ model: models.MessengerFile, as: 'files' }]
  });
  console.log(`  ✅ Message has ${(messageWithFiles as any)?.files?.length || 0} file(s)`);
}

async function testForeignKeys() {
  console.log('\n🔑 Checking foreign key constraints...');
  
  const [results] = await sequelize.query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME LIKE 'messenger_%'
    ORDER BY TABLE_NAME, CONSTRAINT_NAME
  `);
  
  const fks = results as any[];
  console.log(`  Found ${fks.length} foreign key constraint(s):`);
  
  for (const fk of fks) {
    console.log(`    • ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
  }
}

async function testIndexes() {
  console.log('\n📇 Checking indexes on messenger_messages...');
  
  const [results] = await sequelize.query('SHOW INDEX FROM messenger_messages');
  const indexes = (results as any[]).reduce((acc, idx) => {
    if (!acc[idx.Key_name]) acc[idx.Key_name] = [];
    acc[idx.Key_name].push(idx.Column_name);
    return acc;
  }, {} as Record<string, string[]>);
  
  for (const [name, columns] of Object.entries(indexes)) {
    console.log(`    • ${name}: (${columns.join(', ')})`);
  }
}

async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('  MESSENGER SCHEMA VALIDATION TEST');
  console.log('  Phase 1: Sendbird Migration');
  console.log('═══════════════════════════════════════════════');
  
  try {
    // Cleanup any existing test data
    await cleanup();
    
    // Test 1: Table existence
    await testTableExistence();
    
    // Test 2: Create entities
    const user = await testUserCreation();
    const channel = await testChannelCreation();
    await testMemberCreation(user, channel);
    const message = await testMessageCreation(user, channel);
    await testHighlightCreation(message);
    await testReactionCreation(message, user);
    await testFileCreation(message, user);
    
    // Test 3: Associations
    await testAssociations(user, channel, message);
    
    // Test 4: Foreign keys
    await testForeignKeys();
    
    // Test 5: Indexes
    await testIndexes();
    
    // Cleanup
    await cleanup();
    
    console.log('\n═══════════════════════════════════════════════');
    console.log('  ✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════════');
    console.error('  ❌ TEST FAILED');
    console.error('═══════════════════════════════════════════════');
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run if called directly
runTests();
