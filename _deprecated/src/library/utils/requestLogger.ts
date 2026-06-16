import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { nanoid } from 'nanoid';

export interface RequestWithId extends Request {
  requestId: string;
}

export const requestIdMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  (req as RequestWithId).requestId = req.headers['x-request-id'] as string || nanoid(12);
  next();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = (req as RequestWithId).requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });

  next();
};
