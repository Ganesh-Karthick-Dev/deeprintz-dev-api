const userService = require("../service/employeeService")
const _ = require("lodash");

module.exports.getAllModules =  async (req,res) => {
    try{
        const response = await userService.getAllModules(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all modules",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive modules",
        response: []
    })
}
module.exports.getAllRoles =  async (req,res) => {
    try{
        const response = await userService.getAllRoles(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all roles",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive roles",
        response: []
    })
}
module.exports.getRoleById =  async (req,res) => {
    try{
        const response = await userService.getRoleById(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all roles",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive roles",
        response: []
    })
}
module.exports.getAllEmployees =  async (req,res) => {
    try{
        const response = await userService.getAllEmployees(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all employees",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive employees",
        response: []
    })
}
module.exports.getEmployeeById =  async (req,res) => {
    try{
        const response = await userService.getEmployeeById(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved  employee by ID",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive employee",
        response: []
    })
}
module.exports.addRoles =  async (req,res) => {
    try{
        const isRoleExists = await userService.isRoleExists(req.body)

        if(isRoleExists){
            return res.send({
                status: false,
                message: "Role Already exists"
            })
        }else{
        const response = await userService.addRoles(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "New role added successfully"
            })
        }
      }

    }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add new role!"
    })
}

module.exports.updateRole = async(req,res) => {
    try{
        const isUpdateRoleExists = await userService.isUpdateRoleExists(req.body)
        
        if(isUpdateRoleExists){
            return res.send({
                status: false,
                message: "Role Name Already exists"
            })
        }else{

        const response = await userService.updateRole(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Role updated successfully!",
            })
        }
     }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update role"
    })
}
module.exports.deleteRole = async(req,res) => {
    try{
        const response = await userService.deleteRole(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Role deleted successfully!",
            })
        }
     
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to delete role"
    })
}
module.exports.activateRole = async(req,res) => {
    try{
        const response = await userService.activateRole(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Role activated successfully!",
            })
        }
     
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to activate role"
    })
}
module.exports.addEmployee =  async (req,res) => {
    try{
    const isUserNameAndEmailAlreadyExists = await userService.isUserNameAndEmailAlreadyExists(req.body);

     if(isUserNameAndEmailAlreadyExists){
       return res.send({
        status: false,
        message: "Username / Email Already Exists!"
       })
     }
     else {
      const response =  await userService.addEmployee(req.body);
      if(!_.isEmpty(response)){
      return res.send({
        status: true,
        message: "Employee added Successfully!",
        response: response
      })
       }
     }
   }
   catch(err){
    console.log("error",err);   
   }
   return res.send({
    status: false,
    message: "failed to add employee!"
   })
}
module.exports.updateEmployee =  async (req,res) => {
    try{
    const isUpdateUserNameAndEmailExists = await userService.isUpdateUserNameAndEmailExists(req.body);
  
     if(isUpdateUserNameAndEmailExists){
       return res.send({
        status: false,
        message: "Username / Email Already Exists!"
       })
     }
     else {
      const response =  await userService.updateEmployee(req.body);


      if(response == 1){
      return res.send({
        status: true,
        message: "Employee updated Successfully!",
        response: response
      })
       }
     }
   }
   catch(err){
    console.log("error",err);   
   }
   return res.send({
    status: false,
    message: "failed to update employee!"
   })
}
