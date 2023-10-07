import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_text extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_text {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        heading: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        ref: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        content: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        chrono: {
          type: DataTypes.STRING(300),
          allowNull: false
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        link: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        duration: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        parentLink: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        section: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        page: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        queue_weight: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        index_code: {
          type: DataTypes.STRING(2),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_text',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "guid" },
          ]
        },
        {
          name: "parent",
          using: "BTREE",
          fields: [
            { name: "parent" },
          ]
        },
        {
          name: "section",
          using: "BTREE",
          fields: [
            { name: "section" },
          ]
        },
        {
          name: "page",
          using: "BTREE",
          fields: [
            { name: "page" },
          ]
        },
        {
          name: "queue_weight",
          using: "BTREE",
          fields: [
            { name: "queue_weight" },
          ]
        },
        {
          name: "duration",
          using: "BTREE",
          fields: [
            { name: "duration" },
          ]
        },
      ]
    });
    return this;
  }
}