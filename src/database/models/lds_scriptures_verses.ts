import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _lds_scriptures_verses extends ModelBase {
  verse_scripture: any;
  verse_id: any;
  public static initModel(sequelize: Sequelize): typeof _lds_scriptures_verses {
    this.init(
      {
        verse_id: {
          autoIncrement: true,
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true
        },
        volume_id: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        book_id: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        chapter: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        verse: {
          type: DataTypes.TINYINT.UNSIGNED,
          allowNull: false,
          defaultValue: 0
        },
        pilcrow: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: 0
        },
        verse_scripture: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        verse_title: {
          type: DataTypes.STRING(36),
          allowNull: false,
          defaultValue: "",
          unique: "verses_verse_title"
        },
        verse_title_short: {
          type: DataTypes.STRING(36),
          allowNull: false,
          defaultValue: "",
          unique: "verses_verse_title_short"
        }
      }, {
      sequelize,
      tableName: 'lds_scriptures_verses',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "verse_id" },
          ]
        },
        {
          name: "verses_verse_title",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "verse_title" },
          ]
        },
        {
          name: "verses_verse_title_short",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "verse_title_short" },
          ]
        },
        {
          name: "verses_volume_id",
          using: "BTREE",
          fields: [
            { name: "volume_id" },
          ]
        },
        {
          name: "verses_book_id",
          using: "BTREE",
          fields: [
            { name: "book_id" },
          ]
        },
        {
          name: "verses_chapter_verse",
          using: "BTREE",
          fields: [
            { name: "chapter" },
            { name: "verse" },
          ]
        },
        {
          name: "chapter",
          using: "BTREE",
          fields: [
            { name: "chapter" },
          ]
        },
      ]
    });
    return this;
  }
}
