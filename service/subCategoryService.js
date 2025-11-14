const userService =  require("../service/categoryService")
const _ = require("lodash");

module.exports.addSubCategory = async (props) => {
    const {
         categoryid,
         subcatname,
        //  image,
         sku
        } = props;

    try{
        const slug =  userService.generateSlug(subcatname)
       
        const response = await global.dbConnection('productsubcategories').insert({categoryid,subcatname,sku,slug})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getSubCategoriesByCatId = async (props) => {
    const {id} = props
  try{
        const response = await global.dbConnection('productsubcategories').select("*",global.dbConnection.raw(`CONCAT('https://webnox.io/', image) as imageurl`)).where("categoryid",id)

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getSubCategoriesById = async (props) => {
    const {id} = props
  try{
        const response = await global.dbConnection('productsubcategories').select("*",global.dbConnection.raw(`CONCAT('https://webnox.io/', image) as imageurl`)).where("subcatid",id)

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.updateSubCategory = async(props) => {
    const {categoryid,subcatname,image,sku,id} = props;
    try{
        const slug =  userService.generateSlug(subcatname)
        console.log("slug",slug)
       const updateCategory = await global.dbConnection('productsubcategories').update({categoryid,subcatname,sku,slug}).where('subcatid',id)

       return (updateCategory == 1) ? updateCategory : null
    }catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getAllSubCategories = async() => {
        
    try {
        const response = await global.dbConnection('productsubcategories').
        join('productcategories','productsubcategories.categoryid',"productcategories.categoryid").
        select('*','productsubcategories.sku as subcategory_sku', global.dbConnection.raw(`CONCAT('https://webnox.io/', productsubcategories.image) as imageurl`))

        return !_.isEmpty(response) ? response : null;
      } catch (err) {
        console.log("error",err)
      }
      return null
}
module.exports.getSubcategoryBySlug = async(props) => {
    const {slug} = props;
    try{
        const response = await global.dbConnection('productsubcategories')
                                .where({slug})
                                .select('*',global.dbConnection.raw(`CONCAT('https://webnox.io/', image) as imageurl`));
        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.isEditSubCategoryNameExists = async(props) => {
    const {subcatname,id} = props;
    try{
       console.log("props",props) 
        const response = await global.dbConnection('productsubcategories').
                                 whereNot({subcatid: id}).
                                 where({ subcatname }).
                                 select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isSubCategoryNameExists = async(props) => {
    const {subcatname} = props;
    try{
        const response = await global.dbConnection('productsubcategories').
                                 where({ subcatname }).
                                 select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
