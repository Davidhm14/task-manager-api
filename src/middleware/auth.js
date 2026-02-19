const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Token no proporcionado'
      });
    }

    // Verificar formato: "Bearer TOKEN"
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Formato de token inválido. Use: Bearer <token>'
      });
    }

    const token = parts[1];

    // Verificar y decodificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret-key'
    );

    // Agregar información del usuario al request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token inválido'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expirado'
      });
    }

    return res.status(500).json({
      error: 'Error al verificar token'
    });
  }
};

module.exports = authMiddleware;