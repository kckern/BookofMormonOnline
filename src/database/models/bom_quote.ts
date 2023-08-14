import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_quote extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_quote {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(50),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_quote',
      timestamps: false
    });
    return this;
  }
}
