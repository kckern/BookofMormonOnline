import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_shortlinks extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_shortlinks {
    this.init(
      {
        hash: {
          type: DataTypes.STRING(32),
          allowNull: false,
          defaultValue: "",
          primaryKey: true
        },
        string: {
          type: DataTypes.STRING(255),
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_shortlinks',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "hash" },
          ]
        },
        {
          name: "string",
          using: "BTREE",
          fields: [
            { name: "string" },
          ]
        },
      ]
    });
    return this;
  }
}
