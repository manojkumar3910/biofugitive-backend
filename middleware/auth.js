const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { ROLES, ROLE_PERMISSIONS } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'biofugitive-secret-key-change-in-production';

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findOne({ user_id: decoded.user_id, isActive: true });
      
      if (!user) {
        return res.status(401).json({ 
          message: 'User not found or inactive',
          code: 'USER_NOT_FOUND'
        });
      }

      req.user = user;
      req.userId = user.user_id;
      req.userRole = user.role;
      next();
    } catch (jwtError) {
      return res.status(401).json({ 
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

// Optional authentication - doesn't fail if no token, but attaches user if present
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findOne({ user_id: decoded.user_id, isActive: true });
        if (user) {
          req.user = user;
          req.userId = user.user_id;
          req.userRole = user.role;
        }
      } catch (e) {
        // Token invalid, continue without user
      }
    }
    next();
  } catch (error) {
    next();
  }
};

// ============================================
// AUTHORIZATION MIDDLEWARE
// ============================================

// Check if user has required role(s)
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.',
        code: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Check if user has permission for a resource and action
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.hasPermission(resource, action)) {
      return res.status(403).json({ 
        message: `Access denied. You don't have ${action} permission for ${resource}.`,
        code: 'FORBIDDEN',
        resource,
        action,
        userRole: req.user.role
      });
    }

    next();
  };
};

// Check if officer can access a specific case
const requireCaseAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  const caseId = req.params.id || req.params.caseId || req.body.caseId;
  
  if (!caseId) {
    return next(); // No case ID in request, let route handler deal with it
  }

  // Admin has full access
  if (req.user.role === ROLES.admin) {
    return next();
  }

  // Analyst and Forensic have read-only access to all cases
  if (req.user.role === ROLES.analyst) {
    if (req.method !== 'GET') {
      return res.status(403).json({ 
        message: 'Analysts have read-only access',
        code: 'FORBIDDEN'
      });
    }
    return next();
  }

  // Forensic can only access evidence-related endpoints
  if (req.user.role === ROLES.forensic) {
    const isEvidenceEndpoint = req.path.includes('/evidence') || 
                               req.path.includes('/fingerprint') ||
                               req.path.includes('/forensic');
    if (!isEvidenceEndpoint && req.method !== 'GET') {
      return res.status(403).json({ 
        message: 'Forensic role can only modify evidence',
        code: 'FORBIDDEN'
      });
    }
    return next();
  }

  // Officer can only access assigned cases
  if (req.user.role === ROLES.officer) {
    if (!req.user.canAccessCase(caseId)) {
      return res.status(403).json({ 
        message: 'You are not assigned to this case',
        code: 'FORBIDDEN',
        caseId
      });
    }
  }

  next();
};

// ============================================
// ROLE-BASED ROUTE HELPERS
// ============================================

// Shorthand middleware combinations
const adminOnly = [authenticate, requireRole(ROLES.admin)];
const adminOrOfficer = [authenticate, requireRole(ROLES.admin, ROLES.officer)];
const adminOrForensic = [authenticate, requireRole(ROLES.admin, ROLES.forensic)];
const allAuthenticated = [authenticate];
const readOnly = [authenticate, requireRole(ROLES.admin, ROLES.officer, ROLES.forensic, ROLES.analyst)];

// ============================================
// TOKEN GENERATION
// ============================================

const generateToken = (user) => {
  return jwt.sign(
    { 
      user_id: user.user_id,
      role: user.role,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requirePermission,
  requireCaseAccess,
  generateToken,
  verifyToken,
  adminOnly,
  adminOrOfficer,
  adminOrForensic,
  allAuthenticated,
  readOnly,
  ROLES,
  ROLE_PERMISSIONS,
  JWT_SECRET
};
