import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_source extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_source {
    this.init(
      {
        source_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        source_rating: {
          type: DataTypes.STRING(1),
          allowNull: false
        },
        source_title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source_name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source_publisher: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source_year: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        source_short: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source_slug: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source_url: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        source_description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        excerpt: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 0
        },
        item_count: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 0
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_source',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [
            { name: "source_id" },
          ]
        },
      ]
    });
    return this;
  }
}
