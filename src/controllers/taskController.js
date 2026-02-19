const { getPool, sql } = require('../config/database');

// Obtener todas las tareas del usuario
const getTasks = async (req, res, next) => {
  try {
    const { status, priority, sortBy = 'createdAt', order = 'DESC' } = req.query;
    const pool = await getPool();

    let query = 'SELECT * FROM Tasks WHERE userId = @userId';
    const request = pool.request().input('userId', sql.Int, req.user.userId);

    // Filtros opcionales
    if (status) {
      query += ' AND status = @status';
      request.input('status', sql.NVarChar, status);
    }

    if (priority) {
      query += ' AND priority = @priority';
      request.input('priority', sql.NVarChar, priority);
    }

    // Ordenamiento
    const validSortFields = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY ${sortField} ${sortOrder}`;

    const result = await request.query(query);

    res.json({
      count: result.recordset.length,
      tasks: result.recordset
    });
  } catch (error) {
    next(error);
  }
};

// Obtener una tarea por ID
const getTaskById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT * FROM Tasks WHERE id = @id AND userId = @userId');

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }

    res.json({
      task: result.recordset[0]
    });
  } catch (error) {
    next(error);
  }
};

// Crear nueva tarea
const createTask = async (req, res, next) => {
  try {
    const { title, description, status = 'pending', priority = 'medium', dueDate } = req.body;

    // Validación
    if (!title) {
      return res.status(400).json({
        error: 'El título es requerido'
      });
    }

    // Validar status
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido. Debe ser: pending, in_progress, completed, o cancelled'
      });
    }

    // Validar priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Prioridad inválida. Debe ser: low, medium, high, o urgent'
      });
    }

    const pool = await getPool();

    const result = await pool
      .request()
      .input('title', sql.NVarChar, title)
      .input('description', sql.NVarChar, description || null)
      .input('status', sql.NVarChar, status)
      .input('priority', sql.NVarChar, priority)
      .input('userId', sql.Int, req.user.userId)
      .input('dueDate', sql.DateTime, dueDate || null)
      .query(`
        INSERT INTO Tasks (title, description, status, priority, userId, dueDate)
        OUTPUT INSERTED.*
        VALUES (@title, @description, @status, @priority, @userId, @dueDate)
      `);

    res.status(201).json({
      message: 'Tarea creada exitosamente',
      task: result.recordset[0]
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar tarea
const updateTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, dueDate } = req.body;

    const pool = await getPool();

    // Verificar que la tarea existe y pertenece al usuario
    const existingTask = await pool
      .request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT * FROM Tasks WHERE id = @id AND userId = @userId');

    if (existingTask.recordset.length === 0) {
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }

    // Construir query de actualización
    let updateQuery = 'UPDATE Tasks SET updatedAt = GETDATE()';
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, req.user.userId);

    if (title) {
      updateQuery += ', title = @title';
      request.input('title', sql.NVarChar, title);
    }

    if (description !== undefined) {
      updateQuery += ', description = @description';
      request.input('description', sql.NVarChar, description);
    }

    if (status) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Status inválido'
        });
      }
      updateQuery += ', status = @status';
      request.input('status', sql.NVarChar, status);
    }

    if (priority) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          error: 'Prioridad inválida'
        });
      }
      updateQuery += ', priority = @priority';
      request.input('priority', sql.NVarChar, priority);
    }

    if (dueDate !== undefined) {
      updateQuery += ', dueDate = @dueDate';
      request.input('dueDate', sql.DateTime, dueDate);
    }

    updateQuery += ' OUTPUT INSERTED.* WHERE id = @id AND userId = @userId';

    const result = await request.query(updateQuery);

    res.json({
      message: 'Tarea actualizada exitosamente',
      task: result.recordset[0]
    });
  } catch (error) {
    next(error);
  }
};

// Eliminar tarea
const deleteTask = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, req.user.userId)
      .query('DELETE FROM Tasks WHERE id = @id AND userId = @userId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        error: 'Tarea no encontrada'
      });
    }

    res.json({
      message: 'Tarea eliminada exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

// Obtener estadísticas
const getStats = async (req, res, next) => {
  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent,
          SUM(CASE WHEN dueDate < GETDATE() AND status != 'completed' THEN 1 ELSE 0 END) as overdue
        FROM Tasks
        WHERE userId = @userId
      `);

    res.json({
      stats: result.recordset[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getStats
};