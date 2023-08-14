import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_places_coords extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_places_coords {
    this.init(
      {
        pkey: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        map: {
          type: DataTypes.STRING(10),
          allowNull: false
        },
        lat: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        lng: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        zoom: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        min: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        max: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_places_coords',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "pkey" },
          ]
        },
      ]
    });
    return this;
  }
}
