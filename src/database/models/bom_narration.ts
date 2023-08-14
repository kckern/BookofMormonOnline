import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_narration extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_narration {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        description: {
          type: DataTypes.STRING(10000),
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_narration',
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
          name: "description",
          using: "BTREE",
          fields: [
            { name: "description", length: 255 },
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
