import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_history extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_history {
    this.init({
      seq: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true
      },
      id: {
        type: DataTypes.STRING(6),
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: "slug"
      },
      year: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      pages: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      date: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      link: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      type: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      source: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      author: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      document: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      citation: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      teaser: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      transcript: {
        type: DataTypes.TEXT,
        allowNull: true
      }, //aspect FLOAT
      aspect: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      guid: {
        type: DataTypes.CHAR(10),
        allowNull: true
      },
      archive: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      event_year: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      event_date: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      repository: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      archive_id: {
        type: DataTypes.STRING(128),
        allowNull: true
      },
      principal: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      language: {
        type: DataTypes.CHAR(8),
        allowNull: true,
        defaultValue: 'en'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true
      },
    }, {
      sequelize,
      tableName: 'bom_xtras_history',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "seq" },
          ]
        },
        {
          name: "slug",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "slug" },
          ]
        },
        {
          name: "date",
          using: "BTREE",
          fields: [
            { name: "date" },
          ]
        },
        {
          name: "year",
          using: "BTREE",
          fields: [
            { name: "year" },
          ]
        },
        {
          name: "transcript",
          type: "FULLTEXT",
          fields: [
            { name: "transcript" },
          ]
        },
        {
          name: "idx_archive",
          using: "BTREE",
          fields: [{ name: "archive" }]
        },
        {
          name: "idx_event_year",
          using: "BTREE",
          fields: [{ name: "event_year" }]
        },
      ]
    });
    return this;
  }
}



