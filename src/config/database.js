const sql = require('mssql');

console.log('🔍 DEBUG INFO:');
console.log('DB_PASSWORD desde .env:', process.env.DB_PASSWORD);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_SERVER:', process.env.DB_SERVER);

// Configuración base
const baseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

let poolPromise;

// Función para conectar a la base de datos
const connectDB = async () => {
  try {
    console.log('📊 Paso 1: Conectando a master...');
    
    // Primero conectar a master
    const masterConfig = {
      ...baseConfig,
      database: 'master'
    };
    
    const masterPool = await sql.connect(masterConfig);
    console.log('✅ Conectado a master');
    
    // Crear base de datos si no existe
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'TaskManagerDB')
      BEGIN
        CREATE DATABASE TaskManagerDB;
        PRINT 'Base de datos TaskManagerDB creada';
      END
      ELSE
      BEGIN
        PRINT 'Base de datos TaskManagerDB ya existe';
      END
    `);
    
    await masterPool.close();
    console.log('✅ Base de datos TaskManagerDB lista');
    
    // Ahora conectar a TaskManagerDB
    console.log('📊 Paso 2: Conectando a TaskManagerDB...');
    
    const config = {
      ...baseConfig,
      database: 'TaskManagerDB',
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      }
    };
    
    poolPromise = sql.connect(config);
    const pool = await poolPromise;
    console.log('✅ Conectado a TaskManagerDB');
    
    // Crear tablas
    await createTables(pool);
    
    return pool;
  } catch (error) {
    console.error('❌ Error en connectDB:', error.message);
    throw error;
  }
};

// Crear tablas
const createTables = async (pool) => {
  try {
    console.log('📊 Creando tablas...');
    
    // Tabla Users
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
      BEGIN
        CREATE TABLE Users (
          id INT PRIMARY KEY IDENTITY(1,1),
          username NVARCHAR(50) UNIQUE NOT NULL,
          email NVARCHAR(100) UNIQUE NOT NULL,
          password NVARCHAR(255) NOT NULL,
          createdAt DATETIME DEFAULT GETDATE(),
          updatedAt DATETIME DEFAULT GETDATE()
        );
      END
    `);

    // Tabla Tasks
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tasks')
      BEGIN
        CREATE TABLE Tasks (
          id INT PRIMARY KEY IDENTITY(1,1),
          title NVARCHAR(200) NOT NULL,
          description NVARCHAR(MAX),
          status NVARCHAR(20) DEFAULT 'pending',
          priority NVARCHAR(10) DEFAULT 'medium',
          userId INT NOT NULL,
          dueDate DATETIME,
          createdAt DATETIME DEFAULT GETDATE(),
          updatedAt DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
        );
      END
    `);

    console.log('✅ Tablas verificadas/creadas');
  } catch (error) {
    console.error('Error creando tablas:', error.message);
  }
};

// Obtener pool de conexiones
const getPool = async () => {
  if (!poolPromise) {
    await connectDB();
  }
  return poolPromise;
};

module.exports = {
  connectDB,
  getPool,
  sql
};