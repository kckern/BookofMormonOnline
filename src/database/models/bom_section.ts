import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_section extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_section {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        title: {
          type: DataTypes.STRING(200),
          allowNull: false
        },
        badge: {
          type: DataTypes.STRING(200),
          allowNull: false
        },
        ref: {
          type: DataTypes.STRING(200),
          allowNull: false
        },

        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        ambient: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
      }, {
      sequelize,
      tableName: 'bom_section',
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
          name: "parent",
          using: "BTREE",
          fields: [
            { name: "parent" },
          ]
        },
      ]
    });
    return this;
  }
}