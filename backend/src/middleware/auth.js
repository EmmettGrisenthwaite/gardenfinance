import { User } from '../models/User.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.' 
      });
    }

    const decoded = User.verifyToken(token);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Invalid token. User not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      error: 'Invalid token.' 
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = User.verifyToken(token);
      const user = await User.findById(decoded.id);
      req.user = user;
    }
    
    next();
  } catch (error) {
    // For optional auth, continue without user if token is invalid
    next();
  }
};