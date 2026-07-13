const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config');
const { notFound, errorHandler } = require('./common/middlewares/errorHandler');

// Modul mengikuti PRD 3.2 (M01-M12)
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const customersRoutes = require('./modules/customers/customers.routes');
const productsRoutes = require('./modules/products/products.routes');
const productionOrdersRoutes = require('./modules/production-orders/production-orders.routes');
const posRoutes = require('./modules/pos/pos.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const productionRoutes = require('./modules/production/production.routes');
const qcDeliveryRoutes = require('./modules/qc-delivery/qc-delivery.routes');
const financeRoutes = require('./modules/finance/finance.routes');
const marketingRoutes = require('./modules/marketing/marketing.routes');
const hrdRoutes = require('./modules/hrd/hrd.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
}

app.get('/health', (req, res) => res.json({ success: true, status: 'ok' }));

// M01
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
// M02
app.use('/api/customers', customersRoutes);
// Master Produk (katalog item cetak, referensi poDetails)
app.use('/api/products', productsRoutes);
// M03
app.use('/api/production-orders', productionOrdersRoutes);
// M04
app.use('/api/pos', posRoutes);
// M05
app.use('/api/inventory', inventoryRoutes);
// M06
app.use('/api/production', productionRoutes);
// M07
app.use('/api/qc-delivery', qcDeliveryRoutes);
// M08
app.use('/api/finance', financeRoutes);
// M09
app.use('/api/marketing', marketingRoutes);
// M10
app.use('/api/hrd', hrdRoutes);
// M11
app.use('/api/dashboard', dashboardRoutes);
// M12
app.use('/api/notifications', notificationsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
