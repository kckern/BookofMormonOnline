import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';
import _bom_people_rels from './bom_people_rels';
import {Op} from '../../resolvers/_common'

export default class _bom_people extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_people {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        slug: {
          type: DataTypes.STRING(100),
          allowNull: false,
          primaryKey: true
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        classification: {
          type: DataTypes.STRING(5),
          allowNull: false
        },
        identification: {
          type: DataTypes.STRING(5),
          allowNull: false
        },
        unit: {
          type: DataTypes.STRING(5),
          allowNull: false
        },
        date: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        weight: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: false
        }
      }, {
      sequelize,
      tableName: 'bom_people',
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
      ],
      scopes:{
        relations:{
          include:[{
            model: _bom_people_rels,
            where:{
              [Op.or]:[
                Sequelize.where(Sequelize.col("_bom_people.slug"),
                  '=',
                  Sequelize.col("_bom_people_rels.src")),
                Sequelize.where(Sequelize.col("_bom_people.slug"),
                  '=',
                  Sequelize.col("_bom_people_rels.dst"))
              ]
            },
            // as: 'relation',
          }]
        }
      }
    });
    return this;
  }
}
