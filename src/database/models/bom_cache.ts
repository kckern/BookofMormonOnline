import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_cache extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_cache {
    this.init(
      {
        key: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        hash: {
          type: DataTypes.STRING(32),
          allowNull: false
        },
        timestamp: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        content: {
          type: DataTypes.JSON,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_cache',
      timestamps: false,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "key" },
          ]
        },
        {
          name: "hash",
          using: "BTREE",
          fields: [
            { name: "hash" },
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
