import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_timeline extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_timeline {
    this.init(
      {
        id: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        date: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        slug: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        file: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        x: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        y: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        w: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        h: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        o: {
          type: DataTypes.FLOAT,
          allowNull: false
        },
        z: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 4
        },
        p: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        reference: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        narr: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        html: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        heading: {
          type: DataTypes.STRING(255),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_timeline',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "id" },
          ]
        },
      ]
    });
    return this;
  }
}
