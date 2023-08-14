import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_lookup extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_lookup {
    this.init(
      {
        text_guid: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        verse_id: {
          type: DataTypes.STRING(50),
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_lookup',
      timestamps: false,
      indexes: [
        {
          name: "idx_name",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "text_guid" },
            { name: "verse_id" },
          ]
        },
        {
          name: "verse_id",
          using: "BTREE",
          fields: [
            { name: "verse_id" },
          ]
        },
        {
          name: "text_guid",
          using: "BTREE",
          fields: [
            { name: "text_guid" },
          ]
        },
      ]
    });
    return this;
  }
}
