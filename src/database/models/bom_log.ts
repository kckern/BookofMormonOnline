import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_log extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_log {
    this.init(
      {
        timestamp: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        user: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        ip: {
          type: DataTypes.STRING(30),
          allowNull: false
        },
        type: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        value: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        credit: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        flag: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_log',
      timestamps: false,
      indexes: [
        {
          name: "ip",
          using: "BTREE",
          fields: [
            { name: "ip" },
          ]
        },
        {
          name: "type",
          using: "BTREE",
          fields: [
            { name: "type" },
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
          name: "timestamp",
          using: "BTREE",
          fields: [
            { name: "timestamp" },
          ]
        },
        {
          name: "value",
          using: "BTREE",
          fields: [
            { name: "value", length: 255 },
          ]
        },
      ]
    });
    return this;
  }
}
