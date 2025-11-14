const _ = require("lodash");

module.exports.addDesign = async (props) => {
    const {tenantid,design_name,design_placement_id,design_code,drive_link,mock_up_link,design_width,design_height} = props;

    try{
        const response = await global.dbConnection('productdesigns').
        insert({
            designname: design_name, 
            designcode: design_code, 
            designplacementid: design_placement_id,
            designwidth: design_width,
            designheight: design_height,
            drivelink: drive_link,
            mockuplink: mock_up_link,
            tenantid
        })

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.updateDesign = async (props) => {
    const {designid,design_name,design_placement_id,design_code,drive_link,mock_up_link,design_width,design_height} = props;

    try{
        const response = await global.dbConnection('productdesigns').
        update({
            designname: design_name, 
            designcode: design_code, 
            designplacementid: design_placement_id,
            designwidth: design_width,
            designheight: design_height,
            drivelink: drive_link,
            mockuplink: mock_up_link
        }).where({designid})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getDesignsBytenantId = async (props) => {
    const {tenantid} = props;

    try{
        const response = await global.dbConnection('productdesigns').select('*').where({tenantid})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getDesignsByName = async (props) => {
    const {tenantid,name,offset,limit} = props;
    

    try{
        const response = await global.dbConnection('productdesigns').select('*').
        where(global.dbConnection.raw(`designname LIKE '%${name}%'`)).
        andWhere({tenantid}).limit(limit).offset(offset)
    
        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.deleteDesign = async (props) => {
    const {designid} = props;

    try{
        const response = await global.dbConnection('productdesigns').del().where({designid})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}