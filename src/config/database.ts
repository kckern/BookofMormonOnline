import { Sequelize, QueryTypes } from 'sequelize';
import {Op} from '../resolvers/_common';
import fs from 'fs';

import BomCapsulation from '../database/models/bom_capsulation';
import BomConnection from '../database/models/bom_connection';
import BomDivision from '../database/models/bom_division';
import BomIndex from '../database/models/bom_index';
import BomLabel from '../database/models/bom_label';
import BomLog from '../database/models/bom_log';
import BomLookup from '../database/models/bom_lookup';
import BomXtrasFax from '../database/models/bom_xtras_fax';
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
import BomXtrasImage from '../database/models/bom_xtras_image';
import BomXtrasSource from '../database/models/bom_xtras_source';
import BomXtrasStats from '../database/models/bom_xtras_stats';
import LdsScripturesBooks from '../database/models/lds_scriptures_books';
import LdsScripturesFootnotes from '../database/models/lds_scriptures_footnotes';
import LdsScripturesTranslations from '../database/models/lds_scriptures_translations';
import LdsScripturesVerses from '../database/models/lds_scriptures_verses';
import LdsScripturesVolumes from '../database/models/lds_scriptures_volumes';
import SocialPosts from '../database/models/social_posts';
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
  logging: (query) => {
    return false;
    query = query.replace("Executing (default): ", "");
    const now = new Date();
    const oneLineQuery = query.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    fs.appendFile('log.sql', `-- ${now.toISOString()}\n${oneLineQuery}\n\n`, (err) => {
      if (err) {
        console.error(err);
      }
    } );
  },
  host: MYSQL_HOST,
  pool: {
    acquire: +DB_POOL_ACQUIRE,
    idle: +DB_POOL_IDLE,
    max: +DB_POOL_MAX_CONN,
    min: +DB_POOL_MIN_CONN
  },
  port: +process.env.MYSQL_PORT,
  define: {
    paranoid: true
  }
});

export const SQLQueryTypes = QueryTypes;

export const models: Models = {
  BomCapsulation: BomCapsulation.initModel(sequelize),
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
  BomUserSocial: BomUserSocial.initModel(sequelize),
  BomUserToken: BomUserToken.initModel(sequelize),
  BomUser: BomUser.initModel(sequelize),
  BomXtrasSaractorsSim: BomXtrasSaractorsSim.initModel(sequelize),
  BomXtrasCaractors: BomXtrasCaractors.initModel(sequelize),
  BomXtrasCommentary: BomXtrasCommentary.initModel(sequelize),
  BomXtrasFax: BomXtrasFax.initModel(sequelize),
  BomXtrasImage: BomXtrasImage.initModel(sequelize),
  BomXtrasSource: BomXtrasSource.initModel(sequelize),
  BomXtrasStats: BomXtrasStats.initModel(sequelize),
  LdsScripturesBooks: LdsScripturesBooks.initModel(sequelize),
  LdsScripturesFootnotes: LdsScripturesFootnotes.initModel(sequelize),
  LdsScripturesTranslations: LdsScripturesTranslations.initModel(sequelize),
  LdsScripturesVerses: LdsScripturesVerses.initModel(sequelize),
  LdsScripturesVolumes: LdsScripturesVolumes.initModel(sequelize),
  SocialPosts: SocialPosts.initModel(sequelize)
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