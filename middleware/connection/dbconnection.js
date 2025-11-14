
global.dbConnection = null;

Object.defineProperty(global, 'dbConnection', {
  get: function() {
    return this._dbConnection;
  },
  set: function(value) {
   
    this._dbConnection = value;
  },
  enumerable: true,
  configurable: true

})

module.exports = {
  setDbConnection: async (connection) => {
    global.dbConnection = await connection;
  },
};