const userService = require("../service/tenantService")
const _ = require("lodash");

module.exports.updateProfileDetails =  async (req,res) => {
    try{
        const response = await userService.updateProfileDetails(req.body)
        if(response ==1){
            return res.send({
                status: true,
                message: "Tenant details added successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add tenant details"
    })
}
module.exports.getTenantProfileDetailsById =  async (req,res) => {
    
    try{
       const response = await userService.getTenantProfileDetailsById(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved tenant details by Id",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve tenant details",
        response: []
    })
}
module.exports.getAllTenants =  async (req,res) => {
    
    try{
        // Extract query parameters for pagination and search
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = '', 
            sortBy = 'tenantname', 
            sortOrder = 'asc' 
        } = req.query;

        // Validate pagination parameters
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10)); // Max 100 records per page

        const params = {
            page: pageNum,
            limit: limitNum,
            search: search.toString().trim(),
            status: status.toString().trim(),
            sortBy: sortBy.toString().trim(),
            sortOrder: sortOrder.toString().trim()
        };

        const response = await userService.getAllTenants(params);
        
        if(response && response.data){
            return res.send({
                status: true,
                message: "Successfully retrieved tenants with pagination",
                data: response.data,
                pagination: response.pagination,
                filters: response.filters
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve tenants",
        data: [],
        pagination: {
            currentPage: 1,
            totalPages: 0,
            totalRecords: 0,
            limit: 10,
            hasNextPage: false,
            hasPrevPage: false
        },
        filters: {
            search: '',
            status: '',
            sortBy: 'tenantname',
            sortOrder: 'asc'
        }
    })
}
module.exports.getTenantsByStatus =  async (req,res) => {
    
    try{
       const response = await userService.getTenantsByStatus(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved tenants by status",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve tenants by status",
        response: []
    })
}
module.exports.addBankDetails =  async (req,res) => {
    try{
        const response = await userService.addBankDetails(req.body)
        if(!_.isNull(response)){
            return res.send({
                status: true,
                message: "Bank details added successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add Bank details"
    })
}
module.exports.updateFolderId =  async (req,res) => {
    
    try{
        const response = await userService.updateFolderId(req.body)
        if(response > 0){
            return res.send({
                status: true,
                message: "Success!"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed!"
    })
}