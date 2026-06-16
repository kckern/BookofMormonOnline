import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _lds_scriptures_books extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _lds_scriptures_books {
    this.init(
      {
        book_id: {
          autoIncrement: true,
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          primaryKey: true
        },
        volume_id: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        book_title: {
          type: DataTypes.STRING(22),
          allowNull: false,
          defaultValue: ""
        },
        book_title_long: {
          type: DataTypes.STRING(59),
          allowNull: false,
          defaultValue: ""
        },
        book_title_short: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: ""
        },
        book_title_jst: {
          type: DataTypes.STRING(27),
          allowNull: false,
          defaultValue: ""
        },
        book_subtitle: {
          type: DataTypes.STRING(80),
          allowNull: false,
          defaultValue: ""
        },
        lds_org: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: "",
          unique: "lds_org"
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
      tableName: 'lds_scriptures_books',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "book_id" },
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
        {
          name: "volume_id",
          using: "BTREE",
          fields: [
            { name: "volume_id" },
          ]
        },
      ]
    });
    return this;
  }
}

