
import { Model, DataTypes, Sequelize } from 'sequelize';
import ModelBase from './ModelBase';

export default class BomMapMoveCoords extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof BomMapMoveCoords {
    this.init({
      guid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true,
      },
      segment_guid: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      map: {
        type: DataTypes.STRING(11),
        allowNull: false,
      },
      coords: {
        type: DataTypes.JSON,
        allowNull: false,
      },
    }, {
      sequelize,
      tableName: 'bom_map_move_coords',
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