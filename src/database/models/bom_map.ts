import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_map extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_map {
    this.init(
      {
        priority: {
          type: DataTypes.TINYINT,
          allowNull: false
        },
        slug: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        desc: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        minzoom: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        maxzoom: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        centerx: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        centery: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        zoom: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        tiles: {
          type: DataTypes.TINYINT,
          allowNull: false,
          defaultValue: 1
        }
      }, {
      sequelize,
      tableName: 'bom_map',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
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
