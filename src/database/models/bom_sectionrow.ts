import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_sectionrow extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_sectionrow {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        type: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_sectionrow',
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
