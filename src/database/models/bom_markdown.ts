import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_markdown extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_markdown {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        slug: {
          type: DataTypes.STRING(200),
          allowNull: false
        },
        markdown: {
          type: DataTypes.TEXT,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_markdown',
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
        {
          name: "parent",
          using: "BTREE",
          fields: [
            { name: "slug" },
          ]
        },
      ]
    });
    return this;
  }
}