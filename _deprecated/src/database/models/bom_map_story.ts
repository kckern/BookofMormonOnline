
import { Model, DataTypes, Sequelize } from 'sequelize';
import ModelBase from './ModelBase';

export default class BomMapStory extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof BomMapStory {
    this.init({
      guid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true,
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      prev: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
      next: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
    }, {
      sequelize,
      tableName: 'bom_map_story',
      timestamps: false,
      charset: 'utf8mb3',
      indexes: [
        {
          name: 'PRIMARY',
          unique: true,
          using: 'BTREE',
          fields: [{ name: 'guid' }],
        },
      ],
    });

    return this;
  }
}