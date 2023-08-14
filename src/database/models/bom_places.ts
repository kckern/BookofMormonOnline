import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_places extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_places {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        slug: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        aka: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        info: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        occupants: {
          type: DataTypes.STRING(10),
          allowNull: false
        },
        type: {
          type: DataTypes.STRING(10),
          allowNull: false
        },
        location: {
          type: DataTypes.STRING(10),
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        w: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        h: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        ax: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        ay: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_places',
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
      ]
    });
    return this;
  }
}
