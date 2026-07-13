module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  // Test-test berbagi satu database fisik (pixelso_erp_test), jadi dijalankan serial
  // untuk menghindari race condition antar file (bukan diisolasi per-transaction).
  maxWorkers: 1,
  testTimeout: 20000,
};
