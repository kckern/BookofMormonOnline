import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_division extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_division {
    this.init(
      {
        page: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_division',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "page" },
          ]
        },
      ]
    });
    return this;
  }
}
