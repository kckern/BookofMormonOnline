import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _lds_scriptures_translations extends ModelBase {
  text: any;
  public static initModel(sequelize: Sequelize): typeof _lds_scriptures_translations {
    this.init(
      {
        lang: {
          type: DataTypes.STRING(5),
          allowNull: false
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        book: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        chapter: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        verse: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        text: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        book_id: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'lds_scriptures_translations',
      timestamps: false,
      indexes: [
        {
          name: "verse_id",
          using: "BTREE",
          fields: [
            { name: "verse_id" },
          ]
        },
        {
          name: "chapter",
          using: "BTREE",
          fields: [
            { name: "chapter" },
          ]
        },
        {
          name: "verse",
          using: "BTREE",
          fields: [
            { name: "verse" },
          ]
        },
      ]
    });
    return this;
  }
}