import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_connection extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_connection {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        text: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        type: {
          type: DataTypes.STRING(50),
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
      tableName: 'bom_connection',
      timestamps: false
    });
    return this;
  }
}
