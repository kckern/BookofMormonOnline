import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_label extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_label {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        type: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        label_id: {
          type: DataTypes.STRING(255),
          allowNull: false,
          unique: "label"
        },
        label_text: {
          type: DataTypes.STRING(255),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_label',
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
        {
          name: "label",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "label_id" },
          ]
        },
      ]
    });
    return this;
  }
}
