import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_user_social extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_user_social {
    this.init(
      {
        id: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        user: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        network: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        social_id: {
          type: DataTypes.STRING(255),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_user_social',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "id" },
          ]
        },
        {
          name: "user",
          using: "BTREE",
          fields: [
            { name: "user" },
          ]
        },
        {
          name: "network",
          using: "BTREE",
          fields: [
            { name: "network" },
          ]
        },
        {
          name: "social_id",
          using: "BTREE",
          fields: [
            { name: "social_id" },
          ]
        },
      ]
    });
    return this;
  }
}
