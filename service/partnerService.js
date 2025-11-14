const _  = require("lodash");

module.exports.addPartnerInfo = async(props) => {
     const {partnertype,companyname,weight,unit,price} = props
    
    try{
        const slug = `${companyname}-${price}.RS per${weight} ${unit}`
        
        const response = await global.dbConnection('partnerinfo').insert({partnertype,companyname,weight,unit,price,slug})

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.addPartnerLocations = async(props) => {
     const {partnerid,postcode} = props
    
    try{
        const response = await global.dbConnection('partnerlocation').insert({partnerid,postcode})

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.updatePartnerLocations = async(props) => {
     const {partnerlocationid,partnerid,postcode} = props
    
    try{
        const response = await global.dbConnection('partnerlocation').update({partnerid,postcode}).where({partnerlocationid})

        return (response==1) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.updatePartnerInfo = async(props) => {
     const {partnertype,companyname,weight,unit,price,partnerid} = props
    
    try{
        const response = await global.dbConnection('partnerinfo').
        update({partnertype,companyname,weight,unit,price,}).
        where({partnerid})
  
        return (response==1) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.addPartnerLocations = async(props) => {
     const {partnerid,postcode} = props
    
    try{
        const response = await global.dbConnection('partnerlocation').insert({partnerid,postcode})

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getPartnerlocationsbyId = async(props) => {
     const {id} = props
    
    try{
        const response = await global.dbConnection('partnerlocation').select('*').where({partnerid:id})

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getPartnersByPostcode = async(props) => {
     const {postcode} = props
    
    try{
        const response = await global.dbConnection('partnerlocation').
        join('partnerinfo','partnerinfo.partnerid','partnerlocation.partnerid')
        .select('partnerlocation.partnerlocationid',
        'partnerlocation.partnerid',
        'partnerlocation.city',
        'partnerlocation.state',
        'partnerinfo.companyname',
        'partnerinfo.weight',
        'partnerinfo.unit',
        'partnerinfo.price'
        ).where('partnerlocation.postcode',postcode)

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getPartnersById = async(props) => {
     const {id} = props
    
    try{
        const response = await global.dbConnection('partnerinfo').select('*').where({partnerid: id})

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAllPartners = async() => {

    try{
        const response = await global.dbConnection('partnerinfo').select('*')

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAllPartnerLocations = async() => {

    try{
        const response = await global.dbConnection('partnerlocation').select('*')

        return !_.isEmpty(response) ? response : null
    }catch(err){
        console.log("error",err)
    }
    return null
}

//validations

module.exports.isPartnerNameExist = async(props) => {
    const {companyname} = props
    try{
        const response = await global.dbConnection('partnerinfo').select('*').where({companyname})

        return !_.isEmpty(response) ? true : false
    }catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isUpdatePartnerNameExist = async(props) => {
    const {partnerid,companyname} = props
    try{
        const response = await global.dbConnection('partnerinfo').select('*').where({companyname}).whereNot({partnerid})

        return !_.isEmpty(response) ? true : false
    }catch(err){
        console.log("error",err)
    }
    return false
}