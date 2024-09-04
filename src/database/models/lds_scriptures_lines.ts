import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _lds_scriptures_lines extends ModelBase {
  verse_id: any;
  person_slug: any;
  voice: any;
  text: any;
  format: any;
  line_scripture: any;
  guid: any;
  line_num: any;
  public static initModel(sequelize: Sequelize): typeof _lds_scriptures_lines {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true,
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        line_num: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        person_slug: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        voice: {
          type: DataTypes.STRING(1024),
          allowNull: true,
        },
        text: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        format: {
          type: DataTypes.STRING(100),
          allowNull: true,
        }
      },
      {
        sequelize,
        tableName: 'lds_scriptures_lines',
        timestamps: false,
        indexes: [
          {
            name: "PRIMARY",
            unique: true,
            using: "BTREE",
            fields: [{ name: "guid" }],
          },
          {
            name: "verse_id_line_num",
            unique: true,
            using: "BTREE",
            fields: [{ name: "verse_id" }, { name: "line_num" }],
          },
          {
            name: "verse_id",
            using: "BTREE",
            fields: [{ name: "verse_id" }],
          },
          {
            name: "line_num",
            using: "BTREE",
            fields: [{ name: "line_num" }],
          },
        ],
      }
    );
    return this;
  }
}