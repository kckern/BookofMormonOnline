
import { Model, DataTypes, Sequelize } from 'sequelize';
import ModelBase from './ModelBase';

export default class BomMapMove extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof BomMapMove {
    this.init({
      guid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true,
      },
      seq: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      start: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      end: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      travelers: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      duration: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ref: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      parent: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      episode: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
    }, {
      sequelize,
      tableName: 'bom_map_move',
      timestamps: false,
      charset: 'utf8mb3',
    });

    return this;
  }
}