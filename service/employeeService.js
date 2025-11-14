const _ = require("lodash");

module.exports.getAllModules = async () => {
    try{
        const response = await global.dbConnection('app_module')
                        .leftJoin('app_submodule', 'app_submodule.moduleid', 'app_module.moduleid')                  
                        .select(
                            'app_module.moduleid',
                            'app_module.modulename',
                            'app_module.route',
                            'app_module.icon',
                            'app_module.status',
                            global.dbConnection.raw('GROUP_CONCAT(DISTINCT CONCAT(app_submodule.submoduleid, ":", app_submodule.submodulename, ":", app_submodule.route, ":", app_submodule.icon)) AS submodules')
                        )
                        .where('deleted', 0)
                        .groupBy('app_module.moduleid');

        const processedResponse = response.map(row => ({
        ...row,
        submodules: row.submodules
            ? row.submodules.split(',').map(submodule => {
                const [submoduleId, submoduleName , route , icon] = submodule.split(':');
                return { submoduleid: submoduleId, submodulename: submoduleName, submoduleroute: route, submoduleicon: icon };
            })
            : []
        }));
        
          return !_.isEmpty(processedResponse) ? processedResponse : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
module.exports.getAllRoles = async () => {
    try{     
    
          const response = await  global.dbConnection('app_userpermissions')
                                  .select('*')
                                  .groupBy('app_userpermissions.id')
                                  .where("app_userpermissions.status","Active");
          //console.log(response);

        //   .join('app_module',  global.dbConnection.raw(`FIND_IN_SET(app_module.moduleid, app_userpermissions.modules)`))
        //   .select(
        //     'app_userpermissions.id',
        //     'app_userpermissions.rolename',
        //     'app_userpermissions.modules',
        //     'app_userpermissions.status',
        //     global.dbConnection.raw('GROUP_CONCAT(app_module.modulename) as modulenames')
        //     )
        //   .groupBy('app_userpermissions.id', 'app_userpermissions.rolename', 'app_userpermissions.modules').where("app_userpermissions.status","Active")
        
  
           return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
module.exports.getRoleById = async (props) => {
     const {id} = props
    try{
        const response = await  global.dbConnection('app_userpermissions')
                        .select('*')
                        .groupBy('app_userpermissions.id')
                        .where('id',id)

        //   const response = await  global.dbConnection('app_userpermissions')
        //   .join('app_module',  global.dbConnection.raw(`FIND_IN_SET(app_module.moduleid, app_userpermissions.modules)`))
        //   .select(
        //     'app_userpermissions.id',
        //     'app_userpermissions.rolename',
        //     'app_userpermissions.modules',
        //     'app_userpermissions.status',
        //     global.dbConnection.raw('GROUP_CONCAT(app_module.modulename) as modulenames')
        //     )
        //   .groupBy('app_userpermissions.id', 'app_userpermissions.rolename', 'app_userpermissions.modules')
        //   .where('id',id)
    
          //console.log(response)
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
  
module.exports.getAllEmployees = async () => {
    try{
          const response = await  global.dbConnection('app_users')
          .join('app_userpermissions','app_userpermissions.id','app_users.roleid')
          .select(
            'app_users.userid',
            'app_userpermissions.rolename',
            'app_users.authname',
            'app_users.email',
            'app_users.contactno'
          )       
          .groupBy('app_users.userid')
          .where('app_users.roleid','>','3')
          
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
module.exports.getEmployeeById = async (props) => {
     const {id} = props

    try{
          const response = await  global.dbConnection('app_users')
          .join('app_userpermissions','app_userpermissions.id','app_users.roleid')
          .select('app_users.userid','app_users.authname','app_users.email','app_users.password','app_users.contactno','app_users.roleid','app_userpermissions.rolename',
          'app_userpermissions.modules')
          .groupBy('app_users.userid')
          .where('app_users.userid',id)
          
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
  
  module.exports.addRoles = async (props) => {
    const {rolename, moduleids} = props;

    try{
       const modules = moduleids;
       console.log("modules",modules)
        const response = await global.dbConnection('app_userpermissions').insert({rolename,modules})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
  module.exports.updateRole = async (props) => {
    const {rolename, moduleids,id} = props;

    try{
       const modules = moduleids;
       
        const response = await global.dbConnection('app_userpermissions').update({rolename,modules}).where({id})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
  module.exports.deleteRole = async (props) => {
    const {id} = props;

    try{
       
        const response = await global.dbConnection('app_userpermissions').update({status : 'Inactive' }).where({id})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
  module.exports.activateRole = async (props) => {
    const {id} = props;

    try{
       
        const response = await global.dbConnection('app_userpermissions').update({status : 'Active' }).where({id})

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
  module.exports.addEmployee = async (props) => {
    const {name,email,roleid,password} = props;

    try{
        const response = await global.dbConnection('app_users').insert({authname :name,email,roleid,password})

        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
  module.exports.updateEmployee = async (props) => {
    const {name,email,roleid,password,userid} = props;

    try{
        const response = await global.dbConnection('app_users').update({authname :name,email,roleid,password}).where('userid',userid)
        console.log("update employee response",response)

        return (response == 1) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}


module.exports.isRoleExists = async(props) => {
    const {rolename} = props;
    try{
        const response = await global.dbConnection('app_userpermissions').
                                 where({ rolename }).select('*');

        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isUpdateRoleExists = async(props) => {
    const {rolename,id} = props;
    try{
        const response = await global.dbConnection('app_userpermissions').
                                 where({ rolename }).whereNot({id}).
                                 select('*');
        console.log(response)
        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isUserNameAndEmailAlreadyExists = async (props) => {
    const { name, email } = props
    try {
      const response = await global.dbConnection('app_users').select('*').where({ email: email }).orWhere({ authname: name })
      // console.log("response",response)
  
      return !_.isEmpty(response) ? true : false
    } catch (err) {
      console.log("error", err)
    }

    return false
  }
  
module.exports.isUpdateUserNameAndEmailExists = async (props) => {
    const { name, email, userid } = props
    try {
      const response = await global.dbConnection('app_users').select('*').whereNot({ userid: userid }).andWhere({ email: email }).andWhere({ authname: name });
      
      console.log("response",response)
      return !_.isEmpty(response) ? true : false
    } catch (err) {
      console.log("error", err)
    }
    return false
  }