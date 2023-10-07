import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_page extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_page {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        title: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        ref: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_page',
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