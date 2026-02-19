const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../config/database');

// Registro de usuario
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    // Validar que los campos existan
    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Todos los campos son requeridos'
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    const pool = await getPool();

    // Verificar si el usuario ya existe
    const existingUser = await pool
      .request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .query('SELECT id FROM Users WHERE username = @username OR email = @email');

    if (existingUser.recordset.length > 0) {
      return res.status(409).json({
        error: 'El usuario o email ya existe'
      });
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario
    const result = await pool
      .request()
      .input('username', sql.NVarChar, username)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .query(`
        INSERT INTO Users (username, email, password)
        OUTPUT INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.createdAt
        VALUES (@username, @email, @password)
      `);

    const user = result.recordset[0];

    res.status(201).json({
      message: 'Usuario creado exitosamente',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login de usuario
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar campos
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña son requeridos'
      });
    }

    const pool = await getPool();

    // Buscar usuario
    const result = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    const user = result.recordset[0];

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Credenciales inválidas'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener perfil del usuario autenticado
const getProfile = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT id, username, email, createdAt
        FROM Users
        WHERE id = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      user: result.recordset[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile
};