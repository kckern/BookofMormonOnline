import DataLoader from 'dataloader';
import { models } from '../../config/database';
import { Op } from 'sequelize';

export const createUserLoader = () => new DataLoader<string, any>(
  async (userIds) => {
    const users = await models.BomUser.findAll({
      where: { user: { [Op.in]: userIds as string[] } }
    });

    const userMap = new Map(users.map(u => [u.getDataValue('user'), u]));
    return userIds.map(id => userMap.get(id) || null);
  },
  { cache: true }
);

export type UserLoader = ReturnType<typeof createUserLoader>;
