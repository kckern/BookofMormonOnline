import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_people_rels extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_people_rels {
    this.init(
      {
        uid: {
          autoIncrement: true,
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        src: {
          type: DataTypes.STRING(25),
          allowNull: true
        },
        srcweight: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 50
        },
        srcrel: {
          type: DataTypes.STRING(30),
          allowNull: true
        },
        dstweight: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 50
        },
        dstrel: {
          type: DataTypes.STRING(20),
          allowNull: true
        },
        dst: {
          type: DataTypes.STRING(23),
          allowNull: true
        },
        strokewidth: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: 1
        }
      }, {
      sequelize,
      tableName: 'bom_people_rels',
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
          name: "src",
          using: "BTREE",
          fields: [
            { name: "src" },
          ]
        },
        {
          name: "dst",
          using: "BTREE",
          fields: [
            { name: "dst" },
          ]
        },
      ]
    });
    return this;
  }
}
