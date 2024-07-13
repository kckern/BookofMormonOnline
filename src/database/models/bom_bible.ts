import exp from 'constants';
import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';
export default class _bom_data_bible extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_data_bible {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        src: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        bom_verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        bible_verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        quote: {
          type: DataTypes.TINYINT,
          allowNull: true
        },
        plus: {
          type: DataTypes.TINYINT,
          allowNull: true
        },
        bom_highlight: {
          type: DataTypes.JSON,
          allowNull: true
        },
        bible_highlight: {
          type: DataTypes.JSON,
          allowNull: true
        },
        bom_ref: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        bible_ref: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        similarity: {
          type: DataTypes.FLOAT,
          allowNull: true
        },
        seq: {
          type: DataTypes.INTEGER,
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_data_bible',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "guid" },
          ]
        },
      ]
    });
    return this;
  }
}