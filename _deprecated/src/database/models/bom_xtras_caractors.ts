import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_caractors extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_caractors {
    this.init(
      {
        id: {
          type: DataTypes.STRING(11),
          allowNull: false,
          primaryKey: true
        },
        row: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        char: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        match: {
          type: DataTypes.STRING(32),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_caractors',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "id" },
          ]
        },
      ]
    });
    return this;
  }
}
