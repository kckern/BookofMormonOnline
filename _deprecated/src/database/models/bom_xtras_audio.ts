import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_audio extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_audio {
    this.init(
      {
        id: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        placed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        title: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        caption: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        file: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        artist: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        album: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        link: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        lyrics: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        ref: {
          type: DataTypes.TEXT,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_audio',
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