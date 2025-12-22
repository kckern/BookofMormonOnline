import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerChannel Model
 * Stores chat groups/channels
 * PK: channel_url (UUID or custom string)
 */
export default class MessengerChannel extends ModelBase {
  // Model attributes
  public channel_url!: string;
  public name!: string;
  public cover_url!: string;
  public custom_type!: 'private' | 'public' | 'open' | 'solo' | 'DM';
  public description!: string | null;
  public metadata!: any;
  public lang!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static initModel(sequelize: Sequelize): typeof MessengerChannel {
    this.init(
      {
        channel_url: {
          type: DataTypes.STRING(255),
          primaryKey: true,
          allowNull: false,
          comment: 'UUID or custom string'
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        cover_url: {
          type: DataTypes.STRING(512),
          allowNull: true,
          defaultValue: ''
        },
        custom_type: {
          type: DataTypes.ENUM('private', 'public', 'open', 'solo', 'DM'),
          allowNull: false,
          defaultValue: 'private'
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null
        },
        lang: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: 'en'
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
        tableName: 'messenger_channels',
        timestamps: true,
        paranoid: false,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'channel_url' }]
          },
          {
            name: 'idx_custom_type',
            using: 'BTREE',
            fields: [{ name: 'custom_type' }]
          },
          {
            name: 'idx_lang',
            using: 'BTREE',
            fields: [{ name: 'lang' }]
          },
          {
            name: 'idx_created_at',
            using: 'BTREE',
            fields: [{ name: 'created_at' }]
          }
        ]
      }
    );
    return this;
  }
}
