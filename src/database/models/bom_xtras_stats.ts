import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_stats extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_stats {
    this.init(
      {
        timestamp: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        ip: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        user: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        key: {
          type: DataTypes.STRING(1000),
          allowNull: false
        },
        value: {
          type: DataTypes.STRING(1000),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_stats',
      timestamps: false,
      indexes: [
        {
          name: "value",
          using: "BTREE",
          fields: [
            { name: "value", length: 767 },
          ]
        },
        {
          name: "key",
          using: "BTREE",
          fields: [
            { name: "key", length: 767 },
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
          name: "ip",
          using: "BTREE",
          fields: [
            { name: "ip" },
          ]
        },
        {
          name: "timestamp",
          using: "BTREE",
          fields: [
            { name: "timestamp" },
          ]
        },
      ]
    });
    return this;
  }
}
