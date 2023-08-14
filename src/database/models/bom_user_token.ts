import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_user_token extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_user_token {
    this.init(
      {
        token: {
          type: DataTypes.STRING(32),
          allowNull: false,
          primaryKey: true
        },
        user: {
          type: DataTypes.STRING(256),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_user_token',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "token" },
          ]
        },
        {
          name: "user",
          using: "BTREE",
          fields: [
            { name: "user", length: 255 },
          ]
        },
      ]
    });
    return this;
  }
}
