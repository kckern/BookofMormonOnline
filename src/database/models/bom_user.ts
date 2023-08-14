import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_user extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_user {
    this.init(
      {
        user: {
          type: DataTypes.STRING(256),
          allowNull: false,
          primaryKey: true
        },
        pass: {
          type: DataTypes.STRING(32),
          allowNull: false
        },
        email: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        zip: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        complete: {
          type: DataTypes.DECIMAL(4, 1),
          allowNull: false,
          defaultValue: 0.0
        },
        started: {
          type: DataTypes.DECIMAL(3, 1),
          allowNull: false,
          defaultValue: 0.0
        },
        time: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        finished: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        lang: {
          type: DataTypes.STRING(3),
          allowNull: true
        },
        last_active: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
      }, {
      sequelize,
      tableName: 'bom_user',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "user", length: 255 },
          ]
        },
        {
          name: "complete",
          using: "BTREE",
          fields: [
            { name: "complete" },
          ]
        },
        {
          name: "started",
          using: "BTREE",
          fields: [
            { name: "started" },
          ]
        },
        {
          name: "time",
          using: "BTREE",
          fields: [
            { name: "time" },
          ]
        },
        {
          name: "finished",
          using: "BTREE",
          fields: [
            { name: "finished" },
          ]
        },
      ]
    });
    return this;
  }
}
