import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_map_story extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_map_story {
    this.init(
      {

        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        slug: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: "slug"
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        link: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        image: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        zoom: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        mideast: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        compound: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        substories: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        override: {
          type: DataTypes.TEXT,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_map_story',
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
          name: "slug",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "slug" },
          ]
        },
      ]
    });
    return this;
  }
}