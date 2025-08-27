import ModelBase from './ModelBase';
import {
  DataTypes,
  Sequelize,
} from 'sequelize';

export default class _bom_user_history extends ModelBase {
  public static initModel(sequelize: Sequelize): typeof _bom_user_history {
    this.init(
      {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        user: {
          type: DataTypes.STRING(256),
          allowNull: true
        },
        action: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: true
        },
        data: {
          type: DataTypes.TEXT,
          allowNull: true
        }
      },
      {
        sequelize,
        tableName: 'bom_user_history',
        schema: 'public',
        timestamps: false,
        indexes: [
          {
            name: "bom_user_history_pkey",
            unique: true,
            fields: [
              { name: "id" },
            ]
          },
        ]
      }
    );
    return this;
  }
}
