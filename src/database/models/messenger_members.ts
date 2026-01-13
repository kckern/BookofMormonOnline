import ModelBase from './ModelBase';
import { DataTypes, Sequelize } from 'sequelize';

/**
 * MessengerMember Model
 * Junction table for User-Channel membership
 * PK: Composite (channel_url, user_id)
 */
export default class MessengerMember extends ModelBase {
  // Model attributes
  public channel_url!: string;
  public user_id!: string;
  public role!: 'operator' | 'member';
  public state!: 'joined' | 'invited' | 'requested';
  public is_muted!: boolean;
  public last_read_at!: Date | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  public static initModel(sequelize: Sequelize): typeof MessengerMember {
    this.init(
      {
        channel_url: {
          type: DataTypes.STRING(255),
          primaryKey: true,
          allowNull: false
        },
        user_id: {
          type: DataTypes.STRING(32),
          primaryKey: true,
          allowNull: false
        },
        role: {
          type: DataTypes.ENUM('operator', 'member'),
          allowNull: false,
          defaultValue: 'member'
        },
        state: {
          type: DataTypes.ENUM('joined', 'invited', 'requested'),
          allowNull: false,
          defaultValue: 'joined'
        },
        is_muted: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        last_read_at: {
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
        tableName: 'messenger_members',
        timestamps: true,
        paranoid: false,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
          {
            name: 'PRIMARY',
            unique: true,
            using: 'BTREE',
            fields: [{ name: 'channel_url' }, { name: 'user_id' }]
          },
          {
            name: 'idx_user_id',
            using: 'BTREE',
            fields: [{ name: 'user_id' }]
          },
          {
            name: 'idx_state',
            using: 'BTREE',
            fields: [{ name: 'state' }]
          },
          {
            name: 'idx_last_read_at',
            using: 'BTREE',
            fields: [{ name: 'last_read_at' }]
          }
        ]
      }
    );
    return this;
  }
}
