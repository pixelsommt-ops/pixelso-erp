process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://pixelso:pixelso123@127.0.0.1:3306/pixelso_erp_test';
process.env.JWT_SECRET = 'test_secret_do_not_use_in_prod';
process.env.JWT_EXPIRES_IN = '8h';
process.env.CORS_ORIGIN = '*';
