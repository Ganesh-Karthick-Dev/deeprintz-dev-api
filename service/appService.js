const _ = require("lodash")

module.exports.getAllCountries = async (props) => {
    try{
          const response = await global.dbConnection('app_countries').select('countryid','countryname')
  
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }