'use strict';

/**
 * Migration: Create Messenger Tables
 * Phase 1 of Sendbird Migration
 * 
 * Creates 7 tables for the new messaging system:
 * - messenger_users
 * - messenger_channels
 * - messenger_members
 * - messenger_messages
 * - messenger_highlights
 * - messenger_reactions
 * - messenger_files
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // 1. messenger_users - Messaging-specific user profile data
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_users (
          user_id VARCHAR(32) NOT NULL PRIMARY KEY COMMENT 'MD5 hash of bom_user.user',
          bom_user_id VARCHAR(256) NULL COMMENT 'Link to bom_user.user (nullable for bots)',
          nickname VARCHAR(100) NOT NULL,
          profile_url VARCHAR(512) DEFAULT '',
          metadata JSON DEFAULT NULL,
          is_bot BOOLEAN DEFAULT FALSE,
          is_online BOOLEAN DEFAULT FALSE,
          last_seen_at DATETIME DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_bom_user_id (bom_user_id),
          INDEX idx_is_online (is_online),
          CONSTRAINT fk_messenger_users_bom_user 
            FOREIGN KEY (bom_user_id) REFERENCES bom_user(user) 
            ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      // 2. messenger_channels - Chat groups/channels
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_channels (
          channel_url VARCHAR(255) NOT NULL PRIMARY KEY COMMENT 'UUID or custom string',
          name VARCHAR(255) NOT NULL,
          cover_url VARCHAR(512) DEFAULT '',
          custom_type ENUM('private', 'public', 'open', 'solo', 'DM') NOT NULL DEFAULT 'private',
          description TEXT DEFAULT NULL,
          metadata JSON DEFAULT NULL,
          lang VARCHAR(10) DEFAULT 'en',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_custom_type (custom_type),
          INDEX idx_lang (lang),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      // 3. messenger_members - Junction table for User-Channel membership
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_members (
          channel_url VARCHAR(255) NOT NULL,
          user_id VARCHAR(32) NOT NULL,
          role ENUM('operator', 'member') NOT NULL DEFAULT 'member',
          state ENUM('joined', 'invited', 'requested') NOT NULL DEFAULT 'joined',
          is_muted BOOLEAN DEFAULT FALSE,
          last_read_at DATETIME DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (channel_url, user_id),
          INDEX idx_user_id (user_id),
          INDEX idx_state (state),
          INDEX idx_last_read_at (last_read_at),
          CONSTRAINT fk_messenger_members_channel 
            FOREIGN KEY (channel_url) REFERENCES messenger_channels(channel_url) 
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_messenger_members_user 
            FOREIGN KEY (user_id) REFERENCES messenger_users(user_id) 
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      // 4. messenger_messages - All message content
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_messages (
          message_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          channel_url VARCHAR(255) NOT NULL,
          user_id VARCHAR(32) NOT NULL,
          message_type ENUM('MESG', 'FILE', 'ADMN') NOT NULL DEFAULT 'MESG',
          message TEXT NOT NULL,
          custom_type VARCHAR(100) DEFAULT '',
          link_type VARCHAR(50) DEFAULT NULL COMMENT 'Type of linked content (scripture, person, place, etc)',
          link_target VARCHAR(255) DEFAULT NULL COMMENT 'Target identifier for linked content',
          link_aux VARCHAR(255) DEFAULT NULL COMMENT 'Auxiliary data for linked content',
          parent_message_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'For threaded replies',
          is_deleted BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_channel_url (channel_url),
          INDEX idx_user_id (user_id),
          INDEX idx_created_at (created_at),
          INDEX idx_message_type (message_type),
          INDEX idx_custom_type (custom_type),
          INDEX idx_parent_message_id (parent_message_id),
          INDEX idx_channel_created (channel_url, created_at),
          CONSTRAINT fk_messenger_messages_channel 
            FOREIGN KEY (channel_url) REFERENCES messenger_channels(channel_url) 
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_messenger_messages_user 
            FOREIGN KEY (user_id) REFERENCES messenger_users(user_id) 
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_messenger_messages_parent 
            FOREIGN KEY (parent_message_id) REFERENCES messenger_messages(message_id) 
            ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      // 5. messenger_highlights - Scripture highlights associated with messages
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_highlights (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          message_id BIGINT UNSIGNED NOT NULL,
          ordinal INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Order of highlight within message',
          text VARCHAR(1024) NOT NULL COMMENT 'Scripture reference or highlight text',
          INDEX idx_message_id (message_id),
          UNIQUE KEY uk_message_ordinal (message_id, ordinal),
          CONSTRAINT fk_messenger_highlights_message 
            FOREIGN KEY (message_id) REFERENCES messenger_messages(message_id) 
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      // 6. messenger_reactions - Emoji reactions
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_reactions (
          message_id BIGINT UNSIGNED NOT NULL,
          user_id VARCHAR(32) NOT NULL,
          reaction_key VARCHAR(50) NOT NULL COMMENT 'Emoji or reaction identifier',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (message_id, user_id, reaction_key),
          INDEX idx_user_id (user_id),
          INDEX idx_reaction_key (reaction_key),
          CONSTRAINT fk_messenger_reactions_message 
            FOREIGN KEY (message_id) REFERENCES messenger_messages(message_id) 
            ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT fk_messenger_reactions_user 
            FOREIGN KEY (user_id) REFERENCES messenger_users(user_id) 
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      // 7. messenger_files - Metadata for uploaded assets
      await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS messenger_files (
          file_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          message_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Associated message, if any',
          user_id VARCHAR(32) NOT NULL COMMENT 'Uploader',
          file_url VARCHAR(1024) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_type VARCHAR(100) DEFAULT NULL COMMENT 'MIME type',
          file_size BIGINT UNSIGNED DEFAULT NULL COMMENT 'Size in bytes',
          thumbnail_url VARCHAR(1024) DEFAULT NULL,
          metadata JSON DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_message_id (message_id),
          INDEX idx_user_id (user_id),
          INDEX idx_created_at (created_at),
          CONSTRAINT fk_messenger_files_message 
            FOREIGN KEY (message_id) REFERENCES messenger_messages(message_id) 
            ON DELETE SET NULL ON UPDATE CASCADE,
          CONSTRAINT fk_messenger_files_user 
            FOREIGN KEY (user_id) REFERENCES messenger_users(user_id) 
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `, { transaction });

      await transaction.commit();
      console.log('✅ Messenger tables created successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Drop tables in reverse order due to foreign key constraints
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_files;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_reactions;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_highlights;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_messages;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_members;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_channels;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE IF EXISTS messenger_users;', { transaction });
      
      await transaction.commit();
      console.log('✅ Messenger tables dropped successfully');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }
};
