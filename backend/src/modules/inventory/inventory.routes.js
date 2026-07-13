// M05: Inventory
// Fitur kunci (PRD 3.2): Bahan baku, stok minimum, reservasi bahan, mutasi, stock opname, supplier

const { Router } = require('express');
const controller = require('./inventory.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.INVENTORY, ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.INVENTORY, ROLES.MANAGER), controller.update);

module.exports = router;
