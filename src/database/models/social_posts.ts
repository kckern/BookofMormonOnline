import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _social_posts extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _social_posts {
    this.init(
      {
        id: {
          type: DataTypes.FLOAT(65, 0),
          allowNull: false,
          primaryKey: true
        },
        link: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        type: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        facebook: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        twitter: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        parent: {
          type: DataTypes.STRING(255),
          allowNull: false,
          defaultValue: ""
        }
      }, {
      sequelize,
      tableName: 'social_posts',
      timestamps: false,
      indexes: [
        {
          name: "id",
          using: "BTREE",
          fields: [
            { name: "id" },
            { name: "link" },
            { name: "type" },
          ]
        },
      ]
    });
    return this;
  }
}
