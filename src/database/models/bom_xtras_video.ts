import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_video extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_video {
    this.init(
      {
        id: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        file: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        title: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        owner: {
          type: DataTypes.STRING(200),
          allowNull: false
        },
        link: {
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
        ref: {
          type: DataTypes.STRING(200),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_video',
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
