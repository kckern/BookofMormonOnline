import { models } from '../config/database';
import { hashPassword, verifyPassword, needsRehash } from '../library/auth/password';
import { validate, SigninSchema, SignupSchema } from '../library/validation';
import { logInfo, logWarn } from '../library/utils/logger';
import { Op } from 'sequelize';

// Error classes available for future use when needed:
// import { AuthenticationError, ValidationError, NotFoundError } from '../library/errors';

export interface AuthResult {
  success: boolean;
  message: string;
  user: UserDTO | null;
}

export interface UserDTO {
  id: string;
  username: string;
  email: string;
  name: string;
  token: string;
}

export class AuthService {
  async signin(username: string, password: string, token: string): Promise<AuthResult> {
    // Validate input
    const input = validate(SigninSchema, { username, password, token });

    // Find user
    const user = await models.BomUser.findOne({
      where: {
        [Op.or]: { user: input.username, email: input.username }
      }
    });

    if (!user) {
      logWarn('Signin failed - user not found', { username: input.username });
      return { success: false, message: 'Invalid credentials', user: null };
    }

    // Verify password
    const storedHash = user.getDataValue('pass');
    const isValid = await verifyPassword(input.password, storedHash);

    if (!isValid) {
      logWarn('Signin failed - invalid password', { username: input.username });
      return { success: false, message: 'Invalid credentials', user: null };
    }

    // Rehash if using legacy MD5
    if (needsRehash(storedHash)) {
      const newHash = await hashPassword(input.password);
      await user.update({ pass: newHash });
      logInfo('Password rehashed for user', { username: input.username });
    }

    logInfo('User signed in', { username: input.username });

    return {
      success: true,
      message: 'Login successful',
      user: this.toUserDTO(user)
    };
  }

  async signup(username: string, email: string, password: string, token: string): Promise<AuthResult> {
    // Validate input
    const input = validate(SignupSchema, { username, email, password, token });

    // Check if username or email exists
    const existing = await models.BomUser.findOne({
      where: {
        [Op.or]: { user: input.username, email: input.email }
      }
    });

    if (existing) {
      const field = existing.getDataValue('user') === input.username ? 'username' : 'email';
      return { success: false, message: `${field} already exists`, user: null };
    }

    // Hash password and create user
    const passwordHash = await hashPassword(input.password);

    const user = await models.BomUser.create({
      user: input.username,
      email: input.email,
      pass: passwordHash,
      name: input.username
    });

    logInfo('User created', { username: input.username });

    return {
      success: true,
      message: 'Account created',
      user: this.toUserDTO(user)
    };
  }

  private toUserDTO(user: any): UserDTO {
    return {
      id: user.getDataValue('id'),
      username: user.getDataValue('user'),
      email: user.getDataValue('email'),
      name: user.getDataValue('name'),
      token: user.getDataValue('token') || ''
    };
  }
}

export const authService = new AuthService();
