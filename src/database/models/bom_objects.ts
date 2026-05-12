import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_objects extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_objects {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(50),
          allowNull: false,
          primaryKey: true
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        slug: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        subtitle: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        category: {
          type: DataTypes.STRING(30),
          allowNull: false
        },
        specificity: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        usage: {
          type: DataTypes.STRING(20),
          allowNull: false,
          field: 'usage'
        },
        era: {
          type: DataTypes.STRING(30),
          allowNull: false
        },
        provenance: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        aliases: {
          type: DataTypes.STRING(500),
          allowNull: true
        },
        tags: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_objects',
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
          name: "slug",
          unique: true,
          using: "BTREE",
          fields: [{ name: "slug" }]
        }
      ]
    });
    return this;
  }
}
