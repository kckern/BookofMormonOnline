import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_slug extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_slug {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey:true
        },
        slug: {
          type: DataTypes.STRING(500),
          allowNull: false
        },
        type: {
          type: DataTypes.STRING(4),
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
      tableName: 'bom_slug',
      timestamps: false
    });
    return this;
  }
}
