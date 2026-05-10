import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerFile Model
 * Stores metadata for uploaded assets
 * PK: file_id (11-char nanoid)
 */
export default class MessengerFile extends ModelBase {
  // Model attributes
  public file_id!: string;
  public message_id!: string | null;
  public user_id!: string;
  public file_url!: string;
  public file_name!: string;
  public file_type!: string | null;
  public file_size!: number | null;
  public thumbnail_url!: string | null;
  public metadata!: any;
  public readonly created_at!: Date;

  public static initModel(sequelize: Sequelize): typeof MessengerFile {
    this.init(
      {
        file_id: {
          type: DataTypes.STRING(11),
          primaryKey: true,
          allowNull: false,
          comment: 'nanoid'
        },
        message_id: {
          type: DataTypes.STRING(11),
          allowNull: true,
          defaultValue: null,
          comment: 'Associated message, if any'
        },
        user_id: {
          type: DataTypes.STRING(32),
          allowNull: false,
          comment: 'Uploader'
        },
        file_url: {
          type: DataTypes.STRING(1024),
          allowNull: false
        },
        file_name: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        file_type: {
          type: DataTypes.STRING(100),
          allowNull: true,
          defaultValue: null,
          comment: 'MIME type'
        },
        file_size: {
          type: DataTypes.BIGINT.UNSIGNED,
          allowNull: true,
          defaultValue: null,
          comment: 'Size in bytes'
        },
        thumbnail_url: {
          type: DataTypes.STRING(1024),
          allowNull: true,
          defaultValue: null
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW
        }
      },
      {
        sequelize,
        tableName: 'messenger_files',
        timestamps: true,
        paranoid: false,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'file_id' }]
          },
          {
            name: 'idx_message_id',
            using: 'BTREE',
            fields: [{ name: 'message_id' }]
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
          }
        ]
      }
    );
    return this;
  }
}
