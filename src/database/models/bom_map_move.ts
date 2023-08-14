import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_map_move extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_map_move {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        event: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        avatar: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        label: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        start: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        finish: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        zindex: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 0
        },
        speed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 5
        },
        vanish: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        sequence: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        plot: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 1
        },
        override: {
          type: DataTypes.STRING(255),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_map_move',
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
          name: "start",
          using: "BTREE",
          fields: [
            { name: "start" },
          ]
        },
        {
          name: "finish",
          using: "BTREE",
          fields: [
            { name: "finish" },
          ]
        },
        {
          name: "event_guid",
          using: "BTREE",
          fields: [
            { name: "event" },
          ]
        },
        {
          name: "avatar",
          using: "BTREE",
          fields: [
            { name: "avatar" },
          ]
        },
      ]
    });
    return this;
  }
}
