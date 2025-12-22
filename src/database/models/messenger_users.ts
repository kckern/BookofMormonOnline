import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerUser Model
 * Stores messaging-specific user profile data
 * PK: user_id (MD5 hash of bom_user.user, matches Sendbird ID)
 */
export default class MessengerUser extends ModelBase {
  // Model attributes
  public user_id!: string;
  public bom_user_id!: string | null;
  public nickname!: string;
  public profile_url!: string;
  public metadata!: any;
  public is_bot!: boolean;
  public is_online!: boolean;
  public last_seen_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static initModel(sequelize: Sequelize): typeof MessengerUser {
    this.init(
      {
        user_id: {
          type: DataTypes.STRING(32),
          primaryKey: true,
          allowNull: false,
          comment: 'MD5 hash of bom_user.user'
        },
        bom_user_id: {
          type: DataTypes.STRING(256),
          allowNull: true,
          comment: 'Link to bom_user.user (nullable for bots)'
        },
        nickname: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        profile_url: {
          type: DataTypes.STRING(512),
          allowNull: true,
          defaultValue: ''
        },
        metadata: {
          type: DataTypes.JSON,
          allowNull: true,
          defaultValue: null
        },
        is_bot: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        is_online: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        last_seen_at: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null
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
        tableName: 'messenger_users',
        timestamps: true,
        paranoid: false,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'user_id' }]
          },
          {
            name: 'idx_bom_user_id',
            using: 'BTREE',
            fields: [{ name: 'bom_user_id' }]
          },
          {
            name: 'idx_is_online',
            using: 'BTREE',
            fields: [{ name: 'is_online' }]
          }
        ]
      }
    );
    return this;
  }
}
