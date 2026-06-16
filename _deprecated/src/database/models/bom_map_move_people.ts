import { Model, DataTypes, Sequelize } from 'sequelize';
import ModelBase from './ModelBase';

export default class BomMapMovePeople extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof BomMapMovePeople {
    this.init({
      segment_guid: {
        type: DataTypes.STRING(50),
        allowNull: false,
        primaryKey: true, // Treat as part of composite primary key in absence of a singular PK
      },
      people_slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        primaryKey: true, // Treat as part of composite primary key in absence of a singular PK
      },
    }, {
      sequelize,
      tableName: 'bom_map_move_people',
      timestamps: false,
      charset: 'utf8mb3',
      indexes: [
        {
          name: 'segment_people_unique',
          unique: true,
          using: 'BTREE',
          fields: [
            { name: 'segment_guid' },
            { name: 'people_slug' },
          ],
        },
      ],
    });
    
    return this;
  }
}