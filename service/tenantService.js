const _ = require("lodash");

module.exports.updateProfileDetails = async (props) => {
   
    const {
        tenantid,userid,status,tenantname,primarycontact,companyname,websiteurl,
        brandname,address,city,state,postcode,countryid,brandsticker,companylogo , gstno
    } = props;

    try{
        if(!_.isNull(status) && !_.isUndefined(status)){
            const app_users = await global.dbConnection('app_users').
                              update({
                                status
                              }).where('userid',userid)
           
            if(app_users == 1){                  
            const response = await global.dbConnection('tenants').
            update({
                tenantname,primarycontact,companyname,brandname,websiteurl,address,city,state,postcode,countryid,brandsticker,companylogo , gstno
            }).where({tenantid})
    
            return (response == 1) ? response : null;
            }
        }else{

            const response = await global.dbConnection('tenants').
            update({
                tenantname,primarycontact,companyname,brandname,websiteurl,address,city,state,postcode,countryid,brandsticker,companylogo , gstno
            }).where({tenantid})
    
            return (response == 1) ? response : null;
        }
   
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
module.exports.getAllTenants = async (props = {}) => {
    const { 
        page = 1, 
        limit = 10, 
        search = '', 
        status = '', 
        sortBy = 'tenantname', 
        sortOrder = 'asc' 
    } = props;

    try{
        // Build the base query
        let query = global.dbConnection('app_users').
                      leftJoin('tenants','app_users.userid','tenants.user_id').
                      leftJoin('app_countries','app_countries.countryid','tenants.countryid').
                      select('app_users.userid',
                      'app_users.email',
                      'app_users.status',
                      'tenants.tenantname',
                      'tenants.companyname',
                       'tenants.primarycontact',
                       'tenants.tenantid',
                       'tenants.websiteurl',
                       'tenants.address',
                       'tenants.state',
                       'tenants.city',
                       'tenants.postcode',
                       'tenants.countryid',
                       'tenants.handlingcharge',
                       'app_countries.countryname',
                       'tenants.brandname',
                       'tenants.brandsticker',
                       'tenants.companylogo',
                       'tenants.wallet'
                      ).
                      where('roleid',2);

        // Add search functionality
        if (search && search.trim() !== '') {
            const searchTerm = `%${search.trim()}%`;
            query = query.where(function() {
                this.where('tenants.tenantname', 'like', searchTerm)
                    .orWhere('tenants.companyname', 'like', searchTerm)
                    .orWhere('app_users.email', 'like', searchTerm)
                    .orWhere('tenants.primarycontact', 'like', searchTerm)
                    .orWhere('tenants.brandname', 'like', searchTerm)
                    .orWhere('app_countries.countryname', 'like', searchTerm);
            });
        }

        // Add status filter
        if (status && status.trim() !== '') {
            query = query.where('app_users.status', status);
        }

        // Get total count for pagination
        const countQuery = query.clone().count('* as total');
        const countResult = await countQuery;
        const totalRecords = countResult[0].total;

        // Add sorting
        const validSortFields = ['tenantname', 'companyname', 'email', 'status', 'primarycontact', 'brandname', 'countryname'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'tenantname';
        const order = sortOrder.toLowerCase() === 'desc' ? 'desc' : 'asc';
        
        query = query.orderBy(sortField, order);

        // Add pagination
        const offset = (page - 1) * limit;
        query = query.limit(limit).offset(offset);

        const response = await query;

        // Calculate pagination info
        const totalPages = Math.ceil(totalRecords / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return {
            data: !_.isEmpty(response) ? response : [],
            pagination: {
                currentPage: parseInt(page),
                totalPages: totalPages,
                totalRecords: parseInt(totalRecords),
                limit: parseInt(limit),
                hasNextPage: hasNextPage,
                hasPrevPage: hasPrevPage
            },
            filters: {
                search: search,
                status: status,
                sortBy: sortField,
                sortOrder: order
            }
        };
    }
    catch(err){
        console.log("error",err)
    }
    return {
        data: [],
        pagination: {
            currentPage: 1,
            totalPages: 0,
            totalRecords: 0,
            limit: parseInt(limit),
            hasNextPage: false,
            hasPrevPage: false
        },
        filters: {
            search: search,
            status: status,
            sortBy: sortBy,
            sortOrder: sortOrder
        }
    }
}
module.exports.getTenantsByStatus = async (props) => {
    const {status} = props
    try{
        const response = await global.dbConnection('app_users').
                                      leftJoin('tenants','app_users.userid','tenants.user_id').
                                      leftJoin('app_countries','app_countries.countryid','tenants.countryid').
                                      select(
                                      'app_users.userid',
                                      'app_users.email',
                                      'app_users.status',
                                      'tenants.tenantname',
                                      'tenants.companyname',
                                       'tenants.primarycontact',
                                       'tenants.tenantid',
                                       'tenants.websiteurl',
                                       'tenants.address',
                                       'tenants.state',
                                       'tenants.city',
                                       'tenants.postcode',
                                       'tenants.countryid',
                                       'app_countries.countryname',
                                       'tenants.brandname',
                                       'tenants.brandsticker',
                                       'tenants.companylogo'
                                      ).
                                      where('app_users.status', status)

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getTenantProfileDetailsById = async (props) => {
    const {tenantid} = props;
     
    try{
        const response = await global.dbConnection('tenants').
        join('app_users','app_users.userid','tenants.user_id').
        leftJoin('app_countries','app_countries.countryid','tenants.countryid')
        .select(
            "app_users.userid",
            "tenants.tenantid",
            "tenants.tenanttype",
            "tenants.tenantname",
            "tenants.companyname",
            "app_users.email",
            "app_users.status",
            "tenants.primarycontact",
            "tenants.websiteurl",
            "tenants.address",
            "tenants.state",
            "tenants.city",
            "tenants.postcode",
            "tenants.countryid",
            'app_countries.countryname',
            "tenants.brandname",
            "tenants.brandsticker",
            "tenants.companylogo",
            "tenants.wallet",
            "tenants.accountname",
            "tenants.accountno",
            "tenants.ifsccode",
            "tenants.bankname",
            "tenants.folderid",
            "tenants.gstno"
            ).where('tenants.tenantid',tenantid)

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.addBankDetails = async (props) => {
    const {accountname,accountno,ifsccode,bankname,tenantid} = props;

    try{
        const response = await global.dbConnection('tenants').
        update({
           accountname,accountno,ifsccode,bankname
        }).where({tenantid})

        return  !_.isNull(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.updateFolderId = async (props) => {
    const {folderid,tenantid,handlingcharge} = props;
    
    try{
        let response = null;
        if(folderid){
                response = await global.dbConnection('tenants').
            update({
                folderid
            }).where({tenantid})
        }
        if(handlingcharge){
            response = await global.dbConnection('tenants').
            update({
                handlingcharge
            }).where({tenantid})
        }
                
        return response !== null ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}