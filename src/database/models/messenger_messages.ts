import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerMessage Model
 * Stores all message content
 * PK: message_id (11-char nanoid, YouTube-style)
 */
export default class MessengerMessage extends ModelBase {
  // Model attributes
  public message_id!: string;
  public channel_url!: string;
  public user_id!: string;
  public message_type!: 'MESG' | 'FILE' | 'ADMN';
  public message!: string;
  public custom_type!: string;
  public link_type!: string | null;
  public link_target!: string | null;
  public link_aux!: string | null;
  public metadata!: any;
  public parent_message_id!: string | null;
  public is_deleted!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static initModel(sequelize: Sequelize): typeof MessengerMessage {
    this.init(
      {
        message_id: {
          type: DataTypes.STRING(11),
          primaryKey: true,
          allowNull: false,
          comment: 'nanoid - YouTube-style ID'
        },
        channel_url: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        user_id: {
          type: DataTypes.STRING(32),
          allowNull: false
        },
        message_type: {
          type: DataTypes.ENUM('MESG', 'FILE', 'ADMN'),
          allowNull: false,
          defaultValue: 'MESG'
        },
        message: {
          type: DataTypes.TEXT,
          allowNull: false
        },
        custom_type: {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: ''
        },
        link_type: {
          type: DataTypes.STRING(50),
          allowNull: true,
          defaultValue: null,
          comment: 'Type of linked content (scripture, person, place, etc)'
        },
        link_target: {
          type: DataTypes.STRING(255),
          allowNull: true,
          defaultValue: null,
          comment: 'Target identifier for linked content'
        },
        link_aux: {
          type: DataTypes.STRING(255),
          allowNull: true,
          defaultValue: null,
          comment: 'Auxiliary data for linked content'
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null,
          comment: 'Arbitrary JSON for future extensibility (og:data, previews, etc)'
        },
        parent_message_id: {
          type: DataTypes.STRING(11),
          allowNull: true,
          defaultValue: null,
          comment: 'For threaded replies'
        },
        is_deleted: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      },
      {
        sequelize,
        tableName: 'messenger_messages',
        timestamps: true,
        paranoid: false,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'message_id' }]
          },
          {
            name: 'idx_channel_url',
            using: 'BTREE',
            fields: [{ name: 'channel_url' }]
          },
          {
            name: 'idx_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }]
          },
          {
            name: 'idx_created_at',
            using: 'BTREE',
            fields: [{ name: 'created_at' }]
          },
          {
            name: 'idx_message_type',
            using: 'BTREE',
            fields: [{ name: 'message_type' }]
          },
          {
            name: 'idx_custom_type',
            using: 'BTREE',
            fields: [{ name: 'custom_type' }]
          },
          {
            name: 'idx_parent_message_id',
            using: 'BTREE',
            fields: [{ name: 'parent_message_id' }]
          },
          {
            name: 'idx_channel_created',
            using: 'BTREE',
            fields: [{ name: 'channel_url' }, { name: 'created_at' }]
          }
        ]
      }
    );
    return this;
  }
}
