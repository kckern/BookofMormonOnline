import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_fax_index extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_fax_index {
    this.init({
      uid: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      version: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      verse_id: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      page: {
        type: DataTypes.INTEGER.UNSIGNED.ZEROFILL,
        allowNull: false
      },
      pageWidth: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      pageScale: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      X: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      Y: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      W: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      H: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      TLW: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      TLH: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      BRW: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      BRH: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
    }, {
      sequelize,
      tableName: 'bom_xtras_fax_index',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "uid" },
          ]
        },
        {
          name: "version",
          using: "BTREE",
          fields: [
            { name: "version" },
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
          name: "page",
          using: "BTREE",
          fields: [
            { name: "page" },
          ]
        },
      ]
    });
    return this;
  }
}
