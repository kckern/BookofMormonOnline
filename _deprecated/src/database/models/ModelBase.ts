import { Model, Sequelize } from 'sequelize';
import { Models } from '../typings/Models';

export default abstract class ModelBase extends Model {
  // Default associate behavior is do nothing
  // eslint-disable-next-line
  public static associate(models: Models): void {}

  // Default associate behavior is do nothing
  // eslint-disable-next-line
  public static initModel(sequelize: Sequelize): void {}
}
