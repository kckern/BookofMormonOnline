import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_commentary extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_commentary {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        old_id: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        verse_range: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        location_guid: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        is_note: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        text: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        length: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_commentary',
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
        {
          name: "location_guid",
          using: "BTREE",
          fields: [
            { name: "location_guid" },
          ]
        },
        {
          name: "length",
          using: "BTREE",
          fields: [
            { name: "length" },
          ]
        },
      ]
    });
    return this;
  }
}
