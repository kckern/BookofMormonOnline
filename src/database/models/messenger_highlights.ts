import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerHighlight Model
 * Stores scripture highlights associated with messages
 * PK: id (11-char nanoid)
 * Constraint: Unique (message_id, ordinal)
 */
export default class MessengerHighlight extends ModelBase {
  // Model attributes
  public id!: string;
  public message_id!: string;
  public ordinal!: number;
  public text!: string;

  public static initModel(sequelize: Sequelize): typeof MessengerHighlight {
    this.init(
      {
        id: {
          type: DataTypes.STRING(11),
          primaryKey: true,
          allowNull: false,
          comment: 'nanoid'
        },
        message_id: {
          type: DataTypes.STRING(11),
          allowNull: false
        },
        ordinal: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          defaultValue: 0,
          comment: 'Order of highlight within message'
        },
        text: {
          type: DataTypes.STRING(1024),
          allowNull: false,
          comment: 'Scripture reference or highlight text'
        }
      },
      {
        sequelize,
        tableName: 'messenger_highlights',
        timestamps: false,
        paranoid: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'id' }]
          },
          {
            name: 'idx_message_id',
            using: 'BTREE',
            fields: [{ name: 'message_id' }]
          },
          {
            name: 'uk_message_ordinal',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'message_id' }, { name: 'ordinal' }]
          }
        ]
      }
    );
    return this;
  }
}
