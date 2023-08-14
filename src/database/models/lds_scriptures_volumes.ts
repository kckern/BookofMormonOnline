import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _lds_scriptures_volumes extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _lds_scriptures_volumes {
    this.init(
      {
        volume_id: {
          autoIncrement: true,
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          primaryKey: true
        },
        volume_title: {
          type: DataTypes.STRING(22),
          allowNull: false,
          defaultValue: ""
        },
        volume_title_long: {
          type: DataTypes.STRING(26),
          allowNull: false,
          defaultValue: ""
        },
        volume_subtitle: {
          type: DataTypes.STRING(36),
          allowNull: false,
          defaultValue: ""
        },
        lds_org: {
          type: DataTypes.STRING(4),
          allowNull: false,
          defaultValue: "",
          unique: "lds_org"
        },
        num_books: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        num_chapters: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        num_verses: {
          type: DataTypes.SMALLINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        }
      }, {
      sequelize,
      tableName: 'lds_scriptures_volumes',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "volume_id" },
          ]
        },
        {
          name: "lds_org",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "lds_org" },
          ]
        },
      ]
    });
    return this;
  }
}
