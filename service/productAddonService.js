const _ = require("lodash");

module.exports.createAddon = async (props) => {
    const {groupname,price} = props;

    try{
        const response = await global.dbConnection('productaddons').insert({groupname,price})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.updateAddon = async (props) => {
    const {addonid,groupname,price} = props;

    try{
        const response = await global.dbConnection('productaddons').update({groupname,price}).where({addonid})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAllAddons = async () => {
    try{
        const data = await global.dbConnection('productaddons').select('*');

        const countQuery = await global.dbConnection('productaddons')
                            .count('* as total')
                            .where('status', 'Active');
        var count = countQuery[0].total;

        const response = {
            data: data,
            count: count
          };       
        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAddonById = async (props) => {
    const {addonid} = props;
    
    try{
        const response = await global.dbConnection('productaddons').select('addonid','groupname','price','status').where({addonid})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.deleteAddon = async (props) => {
    const {addonid} = props;

    try{
        const response = await global.dbConnection('productaddons').update({status: 'Inactive'}).where({addonid})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.activateAddon = async (props) => {
    const {addonid , status} = props;
    
    try{
        let response;
        if(status == 1){
            response = await global.dbConnection('productaddons').update({status: 'Active'}).where({addonid})
        }else{
            response = await global.dbConnection('productaddons').update({status: 'InActive'}).where({addonid})
        }
        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.isAddonExists = async(props) => {
    const {groupname} = props;
    try{
        const response = await global.dbConnection('productaddons').
                                 where({ groupname }).
                                 select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isUpdateAddonExists = async(props) => {
    const {groupname,addonid} = props;
    try{
        const response = await global.dbConnection('productcategories').
                                 where({ groupname }).whereNot({addonid})
                                 select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
