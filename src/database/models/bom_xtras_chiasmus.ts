import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_xtras_chiasmus extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_xtras_chiasmus {
    this.init(
      {
        guid: {
          type: DataTypes.STRING(255),
          allowNull: false,
          primaryKey: true

        },
        chiasmus_id: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        i: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        verse_id: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        verses: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        line_key: {
          type: DataTypes.STRING(16),
          allowNull: true
        },
        line_text: {
          type: DataTypes.TEXT('long'),
          allowNull: false
        },
        highlights: {
          type: DataTypes.TEXT('long'),
          allowNull: false
        },
        label: {
          type: DataTypes.STRING(255),
          allowNull: true
        }
      }, {
      sequelize,
      tableName: 'bom_xtras_chiasmus',
      timestamps: false
    });
    return this;
  }
}