import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_caractors_sim extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_caractors_sim {
    this.init(
      {
        sim: {
          type: DataTypes.STRING(32),
          allowNull: false
        },
        match: {
          type: DataTypes.STRING(32),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_caractors_sim',
      timestamps: false,
      indexes: [
        {
          name: "base",
          using: "BTREE",
          fields: [
            { name: "sim" },
          ]
        },
        {
          name: "match",
          using: "BTREE",
          fields: [
            { name: "match" },
          ]
        },
      ]
    });
    return this;
  }
}
