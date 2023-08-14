import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_map_event extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_map_event {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true
        },
        story: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        sequence: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        image: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        zoom: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        link: {
          type: DataTypes.STRING(255),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_map_event',
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
