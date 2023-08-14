import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_image extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_image {
    this.init(
      {
        id: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        file: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        title: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        artist: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        link: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        width: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        height: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        location_guid: {
          type: DataTypes.STRING(255),
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_image',
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
