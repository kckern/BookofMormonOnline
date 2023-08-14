import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_translation_locked extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_translation_locked {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        time: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        user: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        lang: {
          type: DataTypes.STRING(10),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_translation_locked',
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
