import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _lds_scriptures_footnotes extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _lds_scriptures_footnotes {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        volume: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        book: {
          type: DataTypes.STRING(10),
          allowNull: false
        },
        chapter: {
          type: DataTypes.STRING(3),
          allowNull: false
        },
        verse: {
          type: DataTypes.STRING(3),
          allowNull: false
        },
        note: {
          type: DataTypes.STRING(1),
          allowNull: false
        },
        reference: {
          type: DataTypes.STRING(200),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'lds_scriptures_footnotes',
      timestamps: false,
      indexes: [
        {
          name: "reference",
          using: "BTREE",
          fields: [
            { name: "reference" },
          ]
        },
        {
          name: "guid",
          using: "BTREE",
          fields: [
            { name: "guid" },
          ]
        },
        {
          name: "volume",
          using: "BTREE",
          fields: [
            { name: "volume" },
          ]
        },
        {
          name: "book",
          using: "BTREE",
          fields: [
            { name: "book" },
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
        {
          name: "note",
          using: "BTREE",
          fields: [
            { name: "note" },
          ]
        },
      ]
    });
    return this;
  }
}
