const knex = require("knex");
const config = require("../../utils/knexfile");
const db = require("./dbconnection");

const establishConnection = async (dbConfig, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt}/${retries}`);
      const connection = await knex(dbConfig);
      
      // Test the connection with a simple query
      await connection.raw('SELECT 1 as test');
      console.log('Database connection established successfully!');
      
      // Set up connection error handling
      connection.on('error', (error) => {
        console.error('Database connection error:', error);
      });
      
      return connection;
    } catch (error) {
      console.error(`Database connection attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        console.error('All database connection attempts failed');
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const dbCheck = async (req, res, next) => {
  try {
    if (req.originalUrl.includes('/api/deeprintz/dev')) {
      const connection = await establishConnection(config.deeprintzDev);
      await db.setDbConnection(connection);
      console.log('MySQL deeprintz dev connected');
    } else if (req.originalUrl.includes('/api/deeprintz/live')) {
      const connection = await establishConnection(config.deeprintzLive);
      await db.setDbConnection(connection);
      console.log('MySQL deeprintz live connected');
    }
    
    next();
  } catch (error) {
    console.error('Database connection middleware error:', error);
    return res.status(500).json({
      status: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
};

module.exports = { dbCheck };











 



























