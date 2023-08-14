import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_capsulation extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_capsulation {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        description: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        reference: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        link: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_capsulation',
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
      ]
    });
    return this;
  }
}
