const multer = require("multer");


// img storage config
var imgconfig = multer.diskStorage({
 
  destination: (req, file, cb) => {
    // Get the type of file
  
    
    const ext = file.mimetype.split("/")[0];
    if (ext === "image") {
        // if type is image then store in images folder
      cb(null, "uploads/images");
    } else {
        // In case of not an image store in others
      cb(null, "uploads/others");
    }
  },
  filename: (req, file, callback) => {
    callback(null, `image-${Date.now()}.${file.originalname}`);
  },
});

var upload = multer({
  storage: imgconfig,
});


module.exports = upload