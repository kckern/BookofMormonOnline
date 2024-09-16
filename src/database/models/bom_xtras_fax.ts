import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_fax extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_fax {
    this.init({
      hide: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      fax: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      slug: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "0",
        primaryKey: true
      },
      code: {
        type: DataTypes.STRING(40),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      pages: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      pgoffset: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      pgfirstVerse: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      info: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      com: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0
      },
      format: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      indexRef: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      bgcolor: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      lang: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
    }, {
      sequelize,
      tableName: 'bom_xtras_fax',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "slug" },
          ]
        },
      ]
    });
    return this;
  }
}
