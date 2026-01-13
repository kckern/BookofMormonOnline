import { AuthService } from '../../src/services/AuthService';
import { models } from '../../src/config/database';
import { hashPassword } from '../../src/library/auth/password';

// Mock the database models
jest.mock('../../src/config/database', () => ({
  models: {
    BomUser: {
      findOne: jest.fn(),
      create: jest.fn()
    }
  },
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock the logger to avoid noise in test output
jest.mock('../../src/library/utils/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
    jest.clearAllMocks();
  });

  describe('signin', () => {
    it('should return failure for invalid credentials', async () => {
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(null);

      const result = await authService.signin('unknown', 'password', 'token');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should return success for valid credentials', async () => {
      const passwordHash = await hashPassword('password123');
      const mockUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '1',
            user: 'testuser',
            email: 'test@example.com',
            name: 'Test User',
            pass: passwordHash,
            token: ''
          };
          return data[field];
        }),
        update: jest.fn()
      };

      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signin('testuser', 'password123', 'token');

      expect(result.success).toBe(true);
      expect(result.user).toBeTruthy();
      expect(result.user?.username).toBe('testuser');
    });

    it('should return failure for wrong password', async () => {
      const passwordHash = await hashPassword('correctpassword');
      const mockUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '1',
            user: 'testuser',
            email: 'test@example.com',
            name: 'Test User',
            pass: passwordHash,
            token: ''
          };
          return data[field];
        }),
        update: jest.fn()
      };

      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signin('testuser', 'wrongpassword', 'token');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should rehash legacy MD5 passwords', async () => {
      // Simulate a legacy MD5 hash (32 hex characters)
      const legacyMd5Hash = '5f4dcc3b5aa765d61d8327deb882cf99'; // MD5 of 'password'
      const mockUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '1',
            user: 'testuser',
            email: 'test@example.com',
            name: 'Test User',
            pass: legacyMd5Hash,
            token: ''
          };
          return data[field];
        }),
        update: jest.fn().mockResolvedValue(undefined)
      };

      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signin('testuser', 'password', 'token');

      expect(result.success).toBe(true);
      expect(mockUser.update).toHaveBeenCalled();
      // Verify the new hash is a bcrypt hash (starts with $2)
      const updateCall = mockUser.update.mock.calls[0][0];
      expect(updateCall.pass).toMatch(/^\$2[ab]\$/);
    });
  });

  describe('signup', () => {
    it('should fail for duplicate username', async () => {
      const mockUser = {
        getDataValue: jest.fn((field: string) => {
          if (field === 'user') return 'existinguser';
          return 'other';
        })
      };
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signup(
        'existinguser',
        'new@example.com',
        'password123',
        'token'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should fail for duplicate email', async () => {
      const mockUser = {
        getDataValue: jest.fn((field: string) => {
          if (field === 'user') return 'differentuser';
          if (field === 'email') return 'existing@example.com';
          return 'other';
        })
      };
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.signup(
        'newuser',
        'existing@example.com',
        'password123',
        'token'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should create user for valid input', async () => {
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(null);

      const mockCreatedUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '2',
            user: 'newuser',
            email: 'new@example.com',
            name: 'newuser',
            token: ''
          };
          return data[field];
        })
      };
      (models.BomUser.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await authService.signup(
        'newuser',
        'new@example.com',
        'password123',
        'token'
      );

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('newuser');
      expect(result.user?.email).toBe('new@example.com');
    });

    it('should hash password before storing', async () => {
      (models.BomUser.findOne as jest.Mock).mockResolvedValue(null);

      const mockCreatedUser = {
        getDataValue: jest.fn((field: string) => {
          const data: Record<string, string> = {
            id: '2',
            user: 'newuser',
            email: 'new@example.com',
            name: 'newuser',
            token: ''
          };
          return data[field];
        })
      };
      (models.BomUser.create as jest.Mock).mockResolvedValue(mockCreatedUser);

      await authService.signup(
        'newuser',
        'new@example.com',
        'password123',
        'token'
      );

      // Verify create was called with a bcrypt hash, not plaintext
      const createCall = (models.BomUser.create as jest.Mock).mock.calls[0][0];
      expect(createCall.pass).not.toBe('password123');
      expect(createCall.pass).toMatch(/^\$2[ab]\$/); // bcrypt hash pattern
    });

    it('should reject invalid email format', async () => {
      await expect(
        authService.signup('newuser', 'invalid-email', 'password123', 'token')
      ).rejects.toThrow();
    });

    it('should reject short passwords', async () => {
      await expect(
        authService.signup('newuser', 'new@example.com', 'short', 'token')
      ).rejects.toThrow();
    });

    it('should reject short usernames', async () => {
      await expect(
        authService.signup('ab', 'new@example.com', 'password123', 'token')
      ).rejects.toThrow();
    });
  });
});
