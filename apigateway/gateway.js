const {dbCheck} = require("../middleware/connection/dbCheck")
const knex = require("knex")
const config = require("../utils/knexfile")
const _ = require("lodash")

const getimages = (req,res) => {
   try{
      const {path} = req.params;
      return res.sendfile(path, {root: 'uploads//images//'})
   }catch(err){
    console.log("error",err)
   }
   return res.send({
    status: false,
    message: "image not found"
   })
}




module.exports = app => {
                  
    app.use('/api/deeprintz/dev',(req, res, next) => dbCheck(req, res, next), require('../routes/router'));
    
    app.use('/api/deeprintz/live',(req, res, next) => dbCheck(req, res, next), require('../routes/router'));

    app.get('/', (req,res) => res.send("Deeprintz server running ....*******"));

    app.get('/', (req,res) => {
      const { shop, hmac, timestamp } = req.query || {};
      if (shop && hmac && timestamp && /\.myshopify\.com$/.test(shop)) {
        const qs = new URLSearchParams(req.query).toString();
        return res.redirect(`/api/deeprintz/live/install?${qs}`);
      }
      return res.send("Deeprintz server running ....*******");
	  });
      
}

