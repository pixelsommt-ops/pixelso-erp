const { Router } = require('express');
const controller = require('./expense.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.FINANCE, ROLES.MANAGER));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.deleteExpense);

module.exports = router;
