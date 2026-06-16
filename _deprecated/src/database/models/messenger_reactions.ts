import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerReaction Model
 * Stores emoji reactions on messages
 * PK: Composite (message_id, user_id, reaction_key)
 */
export default class MessengerReaction extends ModelBase {
  // Model attributes
  public message_id!: string;
  public user_id!: string;
  public reaction_key!: string;
  public readonly created_at!: Date;

  public static initModel(sequelize: Sequelize): typeof MessengerReaction {
    this.init(
      {
        message_id: {
          type: DataTypes.STRING(11),
          primaryKey: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.STRING(32),
          primaryKey: true,
          allowNull: false
        },
        reaction_key: {
          type: DataTypes.STRING(50),
          primaryKey: true,
          allowNull: false,
          comment: 'Emoji or reaction identifier'
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      },
      {
        sequelize,
        tableName: 'messenger_reactions',
        timestamps: true,
        paranoid: false,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'message_id' }, { name: 'user_id' }, { name: 'reaction_key' }]
          },
          {
            name: 'idx_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }]
          },
          {
            name: 'idx_reaction_key',
            using: 'BTREE',
            fields: [{ name: 'reaction_key' }]
          }
        ]
      }
    );
    return this;
  }
}
