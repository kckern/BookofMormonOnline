import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xrels extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xrels {
    this.init(
      {
        uid: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        src_type: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        src_slug: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        rel: {
          type: DataTypes.STRING(50),
          allowNull: false
        },
        srcweight: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 50
        },
        dst_type: {
          type: DataTypes.STRING(20),
          allowNull: false
        },
        dst_slug: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        note: {
          type: DataTypes.STRING(500),
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_xrels',
      timestamps: false,
      indexes: [
        {
          name: "PRIMARY",
          unique: true,
          using: "BTREE",
          fields: [{ name: "uid" }]
        },
        {
          name: "src",
          using: "BTREE",
          fields: [{ name: "src_type" }, { name: "src_slug" }]
        },
        {
          name: "dst",
          using: "BTREE",
          fields: [{ name: "dst_type" }, { name: "dst_slug" }]
        },
        {
          name: "rel",
          using: "BTREE",
          fields: [{ name: "rel" }]
        }
      ]
    });
    return this;
  }
}
