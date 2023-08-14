import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_references extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_references {
    this.init(
      {

        ref: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        page: {
          type: DataTypes.STRING(5),
          allowNull: false
        },
        block: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_references',
      timestamps: false,
      indexes: [
        {
          name: "ref",
          using: "BTREE",
          fields: [
            { name: "ref" },
          ]
        },
      ]
    });
    return this;
  }
}
