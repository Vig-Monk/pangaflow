import { User } from './models';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      orgId?: string;
      role?: 'owner' | 'admin' | 'staff';
      requestId?: string;
    }
  }
}