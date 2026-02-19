const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * @route   GET /api/tasks
 * @desc    Obtener todas las tareas del usuario
 * @access  Private
 * @query   status, priority, sortBy, order
 */
router.get('/', taskController.getTasks);

/**
 * @route   GET /api/tasks/stats
 * @desc    Obtener estadísticas de tareas
 * @access  Private
 */
router.get('/stats', taskController.getStats);

/**
 * @route   GET /api/tasks/:id
 * @desc    Obtener una tarea por ID
 * @access  Private
 */
router.get('/:id', taskController.getTaskById);

/**
 * @route   POST /api/tasks
 * @desc    Crear nueva tarea
 * @access  Private
 */
router.post('/', taskController.createTask);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Actualizar tarea
 * @access  Private
 */
router.put('/:id', taskController.updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Eliminar tarea
 * @access  Private
 */
router.delete('/:id', taskController.deleteTask);

module.exports = router;