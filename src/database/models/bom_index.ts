import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_index extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_index {
    this.init(
      {
        pkey: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        type: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        slug: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        ref: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        verse_id: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        verse_id_end: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        text: {
          type: DataTypes.TEXT,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_index',
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
        {
          name: "type",
          using: "BTREE",
          fields: [
            { name: "type" },
            { name: "verse_id" },
            { name: "slug" },
          ]
        },
      ]
    });
    return this;
  }
}
