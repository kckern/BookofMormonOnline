import { Sequelize, QueryTypes } from 'sequelize';
import {Op} from '../resolvers/_common';
import fs from 'fs';
import { applySandboxGuards } from '../library/sandboxMode';

import BomCapsulation from '../database/models/bom_capsulation';
import BomDataBible from '../database/models/bom_bible';
import BomConnection from '../database/models/bom_connection';
import BomDivision from '../database/models/bom_division';
import BomIndex from '../database/models/bom_index';
import BomLabel from '../database/models/bom_label';
import BomLog from '../database/models/bom_log';
import BomLookup from '../database/models/bom_lookup';
import BomXtrasFax from '../database/models/bom_xtras_fax';
import BomXtrasFaxIndex from '../database/models/bom_xtras_fax_index';
import BomMapMove from '../database/models/bom_map_move';
import BomMapStory from '../database/models/bom_map_story';
import BomMapMovePeople from '../database/models/bom_map_move_people';
import BomMapMoveCoords from '../database/models/bom_map_move_coords';
import BomMap from '../database/models/bom_map';
import BomNarration from '../database/models/bom_narration';
import BomMarkdown from '../database/models/bom_markdown';
import BomPage from '../database/models/bom_page';
import BomPeopleRels from '../database/models/bom_people_rels';
import BomPeople from '../database/models/bom_people';
import BomPlacesCoords from '../database/models/bom_places_coords';
import BomPlaces from '../database/models/bom_places';
import BomObjects from '../database/models/bom_objects';
import BomXrels from '../database/models/bom_xrels';
import BomQuote from '../database/models/bom_quote';
import BomReferences from '../database/models/bom_references';
import BomSection from '../database/models/bom_section';
import BomSectionrow from '../database/models/bom_sectionrow';
import BomShortlinks from '../database/models/bom_shortlinks';
import BomSlug from '../database/models/bom_slug';
import BomText from '../database/models/bom_text';
import BomTimeline from '../database/models/bom_timeline';
import BomTranslationLocked from '../database/models/bom_translation_locked';
import BomTranslation from '../database/models/bom_translation';
import BomXtrasHistory from '../database/models/bom_xtras_history';
import BomUserSocial from '../database/models/bom_user_social';
import BomUserToken from '../database/models/bom_user_token';
import BomUser from '../database/models/bom_user';
import BomXtrasSaractorsSim from '../database/models/bom_xtras_caractors_sim';
import BomXtrasCaractors from '../database/models/bom_xtras_caractors';
import BomXtrasCommentary from '../database/models/bom_xtras_commentary';
import BomXtrasChiasmus from '../database/models/bom_xtras_chiasmus';
import BomXtrasImage from '../database/models/bom_xtras_image';
import BomXtrasSource from '../database/models/bom_xtras_source';
import BomXtrasStats from '../database/models/bom_xtras_stats';
import LdsScripturesBooks from '../database/models/lds_scriptures_books';
import LdsScripturesFootnotes from '../database/models/lds_scriptures_footnotes';
import LdsScripturesTranslations from '../database/models/lds_scriptures_translations';
import LdsScripturesLines from '../database/models/lds_scriptures_lines';
import LdsScripturesMeta from '../database/models/lds_scriptures_meta';

import LdsScripturesVerses from '../database/models/lds_scriptures_verses';
import LdsScripturesVolumes from '../database/models/lds_scriptures_volumes';
import SocialPosts from '../database/models/social_posts';

// Messenger models (Sendbird replacement - Phase 1)
import MessengerUser from '../database/models/messenger_users';
import MessengerChannel from '../database/models/messenger_channels';
import MessengerMember from '../database/models/messenger_members';
import MessengerMessage from '../database/models/messenger_messages';
import MessengerHighlight from '../database/models/messenger_highlights';
import MessengerReaction from '../database/models/messenger_reactions';
import MessengerFile from '../database/models/messenger_files';

import { Models } from '../database/typings/Models';

const {
  MYSQL_DB,
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_HOST,
  DB_POOL_ACQUIRE,
  DB_POOL_IDLE,
  DB_POOL_MAX_CONN,
  DB_POOL_MIN_CONN,
  DB_LOG_LEVEL
} = process.env;

/**
 * The same database user is used to access the different tenants / schema
 * This decision is made because
 *  1. User can only access the wrong schema if the data is corrupted or hacked.
 *     The hacker can access all tenants information if the app is compromised
 *  2. Having different connection to the same database is overkilled
 */
export const sequelize = new Sequelize(MYSQL_DB, MYSQL_USER, MYSQL_PASSWORD, {
  dialect: 'mysql',
  logging: () => {},
  host: MYSQL_HOST,
  pool: {
    acquire: +DB_POOL_ACQUIRE || 60000,
    idle: +DB_POOL_IDLE || 30000, // Keep connections alive longer (30 seconds)
    max: +DB_POOL_MAX_CONN || 8,  // Slightly reduce max connections
    min: +DB_POOL_MIN_CONN || 4,  // Increase min to handle concurrent GraphQL resolvers
    evict: 10000 // Check for idle connections every 10 seconds
  },
  port: +process.env.MYSQL_PORT,
  define: {
    paranoid: true
  },
  benchmark: true, // <-- Enables executionTime in logging
  retry: {
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /ESOCKETTIMEDOUT/,
      /EHOSTUNREACH/,
      /EPIPE/,
      /EAI_AGAIN/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/
    ],
    max: 3
  }
});

// Apply sandbox-mode write guards if enabled (silently no-ops INSERT/UPDATE/DELETE
// when the backend is pointed at a read-only DB user). See library/sandboxMode.ts.
applySandboxGuards();

// Add connection monitoring and error handling
sequelize.authenticate()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed:', err));

// Pool monitoring - only logs warnings when pool is stressed
// Disabled during tests (JEST_WORKER_ID is set)
if (!process.env.JEST_WORKER_ID) {
  setInterval(() => {
    const pool = (sequelize.connectionManager as any).pool;
    if (pool) {
      const maxConn = +process.env.DB_POOL_MAX_CONN || 8;
      // Only log when pool usage is high (>75% of max)
      if (pool.size > maxConn * 0.75) {
        console.warn(`⚠️  Pool pressure: Size: ${pool.size}/${maxConn}, Available: ${pool.available}, Used: ${pool.size - pool.available}`);
      }
      // Critical warning at max capacity
      if (pool.size >= maxConn && pool.available === 0) {
        console.error(`🚨 CRITICAL: Connection pool exhausted! Size: ${pool.size}, Pending: ${pool.pending}`);
      }
    }
  }, 60000); // Check every 60 seconds
}

// Connection event listeners disabled for cleaner logs
// Can be re-enabled for debugging connection issues
/*
sequelize.addHook('beforeConnect', () => {
  console.log('🔗 Creating new database connection...');
});

sequelize.addHook('afterConnect', () => {
  console.log('✅ Database connection established');
});

sequelize.addHook('beforeDisconnect', () => {
  console.log('🔌 Closing database connection...');
});
*/

// Graceful shutdown handler
let isShuttingDown = false;

process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('🛑 SIGINT received. Closing database connections...');
  try {
    await sequelize.close();
    console.log('✅ Database connections closed successfully');
  } catch (err) {
    console.error('❌ Error closing database connections:', err);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('🛑 SIGTERM received. Closing database connections...');
  try {
    await sequelize.close();
    console.log('✅ Database connections closed successfully');
  } catch (err) {
    console.error('❌ Error closing database connections:', err);
  }
  process.exit(0);
});

export const SQLQueryTypes = QueryTypes;

export const models: Models = {

  BomCapsulation: BomCapsulation.initModel(sequelize),
  BoMDataBible: BomDataBible.initModel(sequelize),
  BomConnection: BomConnection.initModel(sequelize),
  BomDivision: BomDivision.initModel(sequelize),
  BomIndex: BomIndex.initModel(sequelize),
  BomLabel: BomLabel.initModel(sequelize),
  BomLog: BomLog.initModel(sequelize),
  BomLookup: BomLookup.initModel(sequelize),
  BomMap: BomMap.initModel(sequelize),
  BomMapStory: BomMapStory.initModel(sequelize),
  BomMapMovePeople: BomMapMovePeople.initModel(sequelize),
  BomMapMoveCoords: BomMapMoveCoords.initModel(sequelize),
  BomMapMove: BomMapMove.initModel(sequelize),
  BomNarration: BomNarration.initModel(sequelize),
  BomMarkdown: BomMarkdown.initModel(sequelize),
  BomPage: BomPage.initModel(sequelize),
  BomPeopleRels: BomPeopleRels.initModel(sequelize),
  BomPeople: BomPeople.initModel(sequelize),
  BomPlacesCoords: BomPlacesCoords.initModel(sequelize),
  BomPlaces: BomPlaces.initModel(sequelize),
  BomObjects: BomObjects.initModel(sequelize),
  BomXrels: BomXrels.initModel(sequelize),
  BomQuote: BomQuote.initModel(sequelize),
  BomReferences: BomReferences.initModel(sequelize),
  BomSection: BomSection.initModel(sequelize),
  BomSectionrow: BomSectionrow.initModel(sequelize),
  BomShortlinks: BomShortlinks.initModel(sequelize),
  BomSlug: BomSlug.initModel(sequelize),
  BomText: BomText.initModel(sequelize),
  BomTimeline: BomTimeline.initModel(sequelize),
  BomTranslationLocked: BomTranslationLocked.initModel(sequelize),
  BomTranslation: BomTranslation.initModel(sequelize),
  BomXtrasHistory: BomXtrasHistory.initModel(sequelize),
  BomXtrasChiasmus: BomXtrasChiasmus.initModel(sequelize),
  BomUserSocial: BomUserSocial.initModel(sequelize),
  BomUserToken: BomUserToken.initModel(sequelize),
  BomUser: BomUser.initModel(sequelize),
  BomXtrasSaractorsSim: BomXtrasSaractorsSim.initModel(sequelize),
  BomXtrasCaractors: BomXtrasCaractors.initModel(sequelize),
  BomXtrasCommentary: BomXtrasCommentary.initModel(sequelize),
  BomXtrasFax: BomXtrasFax.initModel(sequelize),
  BomXtrasFaxIndex: BomXtrasFaxIndex.initModel(sequelize),
  BomXtrasImage: BomXtrasImage.initModel(sequelize),
  BomXtrasSource: BomXtrasSource.initModel(sequelize),
  BomXtrasStats: BomXtrasStats.initModel(sequelize),
  LdsScripturesBooks: LdsScripturesBooks.initModel(sequelize),
  LdsScripturesFootnotes: LdsScripturesFootnotes.initModel(sequelize),
  LdsScripturesTranslations: LdsScripturesTranslations.initModel(sequelize),
  LdsScripturesLines: LdsScripturesLines.initModel(sequelize),
  LdsScripturesMeta: LdsScripturesMeta.initModel(sequelize),
  LdsScripturesVerses: LdsScripturesVerses.initModel(sequelize),
  LdsScripturesVolumes: LdsScripturesVolumes.initModel(sequelize),
  SocialPosts: SocialPosts.initModel(sequelize),
  
  // Messenger models (Sendbird replacement - Phase 1)
  MessengerUser: MessengerUser.initModel(sequelize),
  MessengerChannel: MessengerChannel.initModel(sequelize),
  MessengerMember: MessengerMember.initModel(sequelize),
  MessengerMessage: MessengerMessage.initModel(sequelize),
  MessengerHighlight: MessengerHighlight.initModel(sequelize),
  MessengerReaction: MessengerReaction.initModel(sequelize),
  MessengerFile: MessengerFile.initModel(sequelize)
};

Object.keys(models).forEach((key: string) => {
  const model = models[key];

  model.associate(models);
});



//SLUG LINKS

models.BomDivision.hasOne(models.BomSlug, {
  foreignKey: {
    name: 'link'
  },
  sourceKey: 'page',
  as: 'divSlug'
});

models.BomText.hasOne(models.BomSlug, {
  foreignKey: {
    name: 'link'
  },
  sourceKey: 'page',
  as: 'textSlug'
});


models.BomPage.hasOne(models.BomSlug, {
  foreignKey: {
    name: 'link'
  },
  sourceKey: 'guid',
  as: 'pageSlug'
});


models.BomSection.belongsTo(models.BomSlug, {
  foreignKey: 'guid',
  targetKey: 'link',
  as: "sectionSlug"
});

// END SLUGS


models.BomLookup.belongsTo(models.BomText, {
  foreignKey: 'text_guid',
  targetKey: 'guid',
  as:"text"
});

//now opposite
models.BomText.hasMany(models.BomLookup, {
  foreignKey: 'text_guid',
  sourceKey: 'guid',
  as:"lookup"
});


models.BomLookup.belongsTo(models.LdsScripturesVerses, {
  foreignKey: 'verse_id',
  targetKey: 'verse_id',
  as:"verse"
});

models.BomLookup.belongsTo(models.LdsScripturesTranslations, {
  foreignKey: 'verse_id',
  targetKey: 'verse_id',
  as:"verse_translation"
});

//Main Page Chain

models.BomDivision.hasMany(models.BomPage, {
  foreignKey: {
    name: 'parent'
  },
  sourceKey: 'guid',
  as: 'pages'
});

models.BomDivision.belongsTo(models.BomPage, {
  foreignKey: 'page',
  targetKey: 'guid',
  as: 'titlepage'
});

models.BomPage.hasMany(models.BomText, {
  foreignKey: 'page',
});

models.BomSection.hasMany(models.BomText, {
  foreignKey: 'section',
  as: "sectionText"
});



models.BomPage.hasMany(models.BomSection, {
  foreignKey: {
    name: 'parent'
  },
  as: 'sections'
});

//inverse
models.BomSection.belongsTo(models.BomPage, {
  foreignKey: 'parent',
  targetKey: 'guid',
  as: 'page'
});


models.BomSection.hasMany(models.BomSectionrow, {
  foreignKey: {
    name: 'parent'
  },
  as: 'rows'
});

models.BomSectionrow.hasOne(models.BomNarration, {
  foreignKey: {
    name: 'parent'
  },
  as: 'narration'
});

models.BomSectionrow.hasOne(models.BomConnection, {
  foreignKey: {
    name: 'parent'
  },
  as: 'connection'
});

models.BomSectionrow.hasOne(models.BomCapsulation, {
  foreignKey: {
    name: 'parent'
  },
  as: 'capsulation'
});

models.BomNarration.hasOne(models.BomTimeline, {
  foreignKey: {
    name: 'narr'
  },
  as: 'timeline'
});

models.BomNarration.hasOne(models.BomText, {
  foreignKey: {
    name: 'parent'
  },
  as: 'text'
});

// TEXT LINKS

models.BomText.belongsToMany(models.BomText, {
  through: models.BomQuote,
  otherKey: 'guid',
  targetKey: 'parent',
  foreignKey: 'parent',
  as: 'quotes'
});

models.BomQuote.belongsTo(models.BomText, {
  foreignKey: 'parent',
  targetKey: 'guid',
  as: 'textParent'
});


models.BomText.belongsTo(models.BomPage, {
  as: "parent_page",
  foreignKey: 'page',
  targetKey: 'guid'
});
models.BomText.belongsTo(models.BomSection, {
  as: "parent_section",
  foreignKey: 'section',
  targetKey: 'guid'
});
models.BomText.belongsTo(models.BomNarration, {
  as: "narration",
  foreignKey: 'parent',
  targetKey: 'guid'
});



// TRANSLATION

models.BomLabel.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});
models.BomDivision.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});

models.BomPage.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});
models.BomMap.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'translation'
});
models.BomSection.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});


models.BomIndex.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
//  sourceKey: 'guid',
  as: 'translation'
});

models.BomMarkdown.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});
models.BomNarration.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});
models.BomText.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});
models.BomConnection.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});
models.BomCapsulation.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});

models.BomXtrasFax.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'slug',
  as: 'translation'
});

//for image
models.BomXtrasImage.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'id',
  as: 'translation'
});


models.BomXtrasHistory.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'id',
  as: 'translation'
});

//chiasmus
models.BomXtrasChiasmus.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'translation'
});

models.BomMapMove.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'translation'
});
models.BomMapStory.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'translation'
});

models.BomMapStory.hasMany(models.BomMapMove, {
  foreignKey: {
    name: 'parent'
  },
  sourceKey: 'guid',
  as: 'moves'
});


models.BomTimeline.hasOne(models.BomText, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'reference',
  as: 'text'
});




// PEOPLE & EXTRAS

models.BomPeople.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  as: 'translation'
});


models.BomPeople.hasMany(models.BomIndex, {
  foreignKey: {
    name: 'slug'
  },
  as: 'index'
});


models.BomPeopleRels.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'uid',
  as: 'translation'
});

models.BomIndex.hasOne(models.BomLookup, {
  sourceKey: 'verse_id',
  foreignKey: 'verse_id',
  as: 'text_guid',
});

models.BomLookup.belongsTo(models.BomIndex, {
  foreignKey: 'verse_id',
  targetKey: 'verse_id',
  as: 'bomIndexReference'
});

models.BomPeople.hasMany(models.BomPeopleRels, {
  sourceKey: 'slug',
  foreignKey: 'src',
  as: 'relationSrc',
})

models.BomPeople.hasMany(models.BomPeopleRels, {
  sourceKey: 'slug',
  foreignKey: 'dst',
  as: 'relationDst',
})

models.BomPeopleRels.hasOne(models.BomPeople, {
  foreignKey: 'slug',
  sourceKey: 'src',
  as: 'personSrc'
})

models.BomPeopleRels.hasOne(models.BomPeople, {
  foreignKey: 'slug',
  sourceKey: 'dst',
  as: 'personDst'
})

models.BomPlaces.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'translation'
});

models.BomPlaces.hasMany(models.BomIndex, {
  foreignKey: {
    name: 'slug'
  },
  sourceKey: 'slug',
  as: 'index'
});

models.BomPlaces.hasMany(models.BomPlacesCoords, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'coords'
});

models.BomObjects.hasMany(models.BomTranslation, {
  foreignKey: {
    name: 'guid'
  },
  sourceKey: 'guid',
  as: 'translation'
});

models.BomObjects.hasMany(models.BomIndex, {
  foreignKey: {
    name: 'slug'
  },
  sourceKey: 'slug',
  as: 'index'
});

models.BomPlaces.belongsToMany(models.BomMap, {
  through: models.BomPlacesCoords,
  foreignKey: 'guid',
  otherKey: 'map',
  targetKey: 'slug',
  as: 'maps'
});


models.BomMap.belongsToMany(models.BomPlaces, {
  through: models.BomPlacesCoords,
  otherKey: 'guid',
  foreignKey: 'map',
  sourceKey: 'slug',
  targetKey: 'guid',
  as: 'places'
});




models.BomXtrasCommentary.hasOne(models.BomXtrasSource, {
  sourceKey: 'source',
  foreignKey: 'source_id',
  as: 'publication'
});


models.BomXtrasCommentary.hasOne(models.BomText, {
  sourceKey: 'location_guid',
  foreignKey: 'guid',
  as: 'location'
});

models.BomXtrasImage.hasOne(models.BomText, {
  sourceKey: 'location_guid',
  foreignKey: 'guid',
  as: 'location'
});



//USER


models.BomUser.hasMany(models.BomUserSocial, {
  foreignKey: 'user',
  as: "networks"
});



models.BomUser.belongsTo(models.BomUserToken, {
  foreignKey: 'user',
  targetKey: 'user'
});


models.BomUser.belongsTo(models.BomLog, {
  foreignKey: 'user',
  targetKey: 'user'
});




//TEXT TO LOG
models.BomText.hasMany(models.BomLog, {
  foreignKey: 'value',
  sourceKey: 'guid'
});



models.BomLog.belongsTo(models.BomText, {
  as: "logText",
  foreignKey: 'value',
  targetKey: 'guid'
});


models.BomMapMove.belongsTo(models.BomMapStory, {
  foreignKey: 'parent',
  targetKey: 'guid',
  as: 'story'
});

models.BomMapMove.hasOne(models.BomPlaces, {
  foreignKey: 'slug',
  sourceKey: 'start',
  as: 'startPlace'
});

models.BomMapMove.hasOne(models.BomPlaces, {
  foreignKey: 'slug',
  sourceKey: 'end',
  as: 'endPlace'
});


models.BomMapMove.belongsToMany(models.BomPeople, {
  through: models.BomMapMovePeople,
  foreignKey: 'segment_guid',
  otherKey: 'people_slug',
  as: 'people'
});


models.BomMapMove.hasMany(models.BomMapMoveCoords, {
  //mapMapMove has guid
  //matche bomMapMoveCoords on segment_guid
  foreignKey: 'segment_guid',
  as: 'coords'
});


// =====================================
// MESSENGER ASSOCIATIONS (Phase 1)
// Sendbird replacement infrastructure
// =====================================

// User <-> Channel (Many-to-Many through Member)
models.MessengerUser.belongsToMany(models.MessengerChannel, {
  through: models.MessengerMember,
  foreignKey: 'user_id',
  otherKey: 'channel_url',
  as: 'channels'
});

models.MessengerChannel.belongsToMany(models.MessengerUser, {
  through: models.MessengerMember,
  foreignKey: 'channel_url',
  otherKey: 'user_id',
  as: 'users'
});

// Member belongs to User and Channel
models.MessengerMember.belongsTo(models.MessengerUser, {
  foreignKey: 'user_id',
  as: 'user'
});

models.MessengerMember.belongsTo(models.MessengerChannel, {
  foreignKey: 'channel_url',
  as: 'channel'
});

// Channel has many Members
models.MessengerChannel.hasMany(models.MessengerMember, {
  foreignKey: 'channel_url',
  as: 'members'
});

// User has many Members (memberships)
models.MessengerUser.hasMany(models.MessengerMember, {
  foreignKey: 'user_id',
  as: 'memberships'
});

// Message belongs to User and Channel
models.MessengerMessage.belongsTo(models.MessengerUser, {
  foreignKey: 'user_id',
  as: 'sender'
});

models.MessengerMessage.belongsTo(models.MessengerChannel, {
  foreignKey: 'channel_url',
  as: 'channel'
});

// Channel has many Messages
models.MessengerChannel.hasMany(models.MessengerMessage, {
  foreignKey: 'channel_url',
  as: 'messages'
});

// User has many Messages
models.MessengerUser.hasMany(models.MessengerMessage, {
  foreignKey: 'user_id',
  as: 'messages'
});

// Message self-reference for replies (threads)
models.MessengerMessage.belongsTo(models.MessengerMessage, {
  as: 'parent',
  foreignKey: 'parent_message_id'
});

models.MessengerMessage.hasMany(models.MessengerMessage, {
  as: 'replies',
  foreignKey: 'parent_message_id'
});

// Message has many Highlights
models.MessengerMessage.hasMany(models.MessengerHighlight, {
  foreignKey: 'message_id',
  as: 'highlights'
});

models.MessengerHighlight.belongsTo(models.MessengerMessage, {
  foreignKey: 'message_id',
  as: 'message'
});

// Message has many Reactions
models.MessengerMessage.hasMany(models.MessengerReaction, {
  foreignKey: 'message_id',
  as: 'reactions'
});

models.MessengerReaction.belongsTo(models.MessengerMessage, {
  foreignKey: 'message_id',
  as: 'message'
});

// Reaction belongs to User
models.MessengerReaction.belongsTo(models.MessengerUser, {
  foreignKey: 'user_id',
  as: 'user'
});

// File relationships
models.MessengerFile.belongsTo(models.MessengerMessage, {
  foreignKey: 'message_id',
  as: 'message'
});

models.MessengerFile.belongsTo(models.MessengerUser, {
  foreignKey: 'user_id',
  as: 'uploader'
});

models.MessengerMessage.hasMany(models.MessengerFile, {
  foreignKey: 'message_id',
  as: 'files'
});

models.MessengerUser.hasMany(models.MessengerFile, {
  foreignKey: 'user_id',
  as: 'uploadedFiles'
});

// Link MessengerUser to BomUser (optional, for non-bot users)
models.MessengerUser.belongsTo(models.BomUser, {
  foreignKey: 'bom_user_id',
  targetKey: 'user',
  as: 'bomUser'
});