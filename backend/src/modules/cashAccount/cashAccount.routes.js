// Master Kas & Bank - data uang, dibatasi finance & manager (beda dari Supplier/Category yang GET-nya terbuka).

const { Router } = require('express');
const controller = require('./cashAccount.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.FINANCE, ROLES.MANAGER));

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.deleteCashAccount);

module.exports = router;
