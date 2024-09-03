import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_translation extends ModelBase {
  text: any;
  value: any;
  public static initModel(sequelize: Sequelize): typeof _bom_translation {
    this.init(
      {
        id: {
          autoIncrement: true,
          type: DataTypes.BIGINT,
          allowNull: false,
          primaryKey: true
        },
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: ""
        },
        lang: {
          type: DataTypes.STRING(3),
          allowNull: false,
          defaultValue: ""
        },
        refkey: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: ""
        },
        value: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        contributor: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: ""
        },
        auditor: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: ""
        },
        time: {
          type: DataTypes.DATE,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_translation',
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
          name: "guid",
          using: "BTREE",
          fields: [
            { name: "guid" },
          ]
        },
        {
          name: "lang",
          using: "BTREE",
          fields: [
            { name: "lang" },
          ]
        },
        {
          name: "refkey",
          using: "BTREE",
          fields: [
            { name: "refkey" },
          ]
        },
        {
          name: "auditor",
          using: "BTREE",
          fields: [
            { name: "auditor" },
          ]
        },
        {
          name: "contributor",
          using: "BTREE",
          fields: [
            { name: "contributor" },
          ]
        },
        {
          name: "contributor2",
          using: "BTREE",
          fields: [
            { name: "contributor" },
          ]
        },
      ]
    });
    return this;
  }
}
