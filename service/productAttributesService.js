const _ = require("lodash");

module.exports.addProductAttributes = async (props) => {
    const {typename,sku,tag,colorCode} = props;

    try{
        const code = colorCode || null;
        const response = await global.dbConnection('app_types').insert({typename,sku,tag,code})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getProductAttributesbyTag = async (props) => {
       const {tag} = props
    try{
          const response = await global.dbConnection('app_types').where('tag',tag).select("*")
  
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
module.exports.getProductAttributesbyId = async (props) => {
       const {id} = props
    try{
          const response = await global.dbConnection('app_types').where('apptypeid',id).select("*")
  
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }

  module.exports.updateProductAttributes = async (props) => {
    const {typename,sku,tag,id,colorCode} = props;
    try{
        const code = colorCode || null;
       const updateprint = await global.dbConnection('app_types').update({typename,sku,tag,code}).where('apptypeid',id)

       return (updateprint == 1) ? updateprint : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
