const _ = require("lodash");


module.exports.addCategory = async (props) => {
    const {categoryname,sku,image} = props;
   
    try{
        console.log("category...",categoryname)
        const slug =  this.generateSlug(categoryname)
        console.log("slug",slug)
        const response = await global.dbConnection('productcategories').insert({categoryname,sku,slug})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAllCategories = async () => {
  try{
        const response = await global.dbConnection('productcategories').select("*",global.dbConnection.raw(`CONCAT('https://webnox.io/', image) as imageurl`)).where('status', "Active")

                        //  dbCheck('productcategories').select(db.raw(`CONCAT(http:localhost:8000/uploads/ ,name) as image`))


        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.updateCategory = async(props) => {
    const {categoryname,sku,id} = props;
    try{
        const slug = this.generateSlug(categoryname)

        const updateCategory = await global.dbConnection('productcategories').update({categoryname,sku,slug}).where('categoryid',id)
        
        
       return (updateCategory == 1) ? updateCategory : null
    }catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getCategoryById = async(props) => {
    const {id} = props;
    try{
        const response = await global.dbConnection('productcategories')
                                .where({ categoryid: id })
                                .select('*',global.dbConnection.raw(`CONCAT('https://webnox.io/', image) as imageurl`));
        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getCategoryBySlug = async(props) => {
    const {slug} = props;
    try{
        const response = await global.dbConnection('productcategories')
                                .where({slug})
                                .select('*',global.dbConnection.raw(`CONCAT('https://webnox.io/', image) as imageurl`));
        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.isEditCategoryNameExists = async(props) => {
    const {categoryname,id} = props;
    try{
        const response = await global.dbConnection('productcategories').
                                 whereNot({categoryid: id}).
                                 where({ categoryname }).
                                 select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isCategoryNameExists = async(props) => {
    const {categoryname,id} = props;
    try{
        console.log("categoryname..",props)
        const response = await global.dbConnection('productcategories').
                                 where({ categoryname }).
                                 select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}

module.exports.generateSlug = (name) =>{
    try{
        const pattern = /\s+/g;
        const delimiter = '-';
        
        const slug = _.replace(name, pattern, delimiter);  
        return slug;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}