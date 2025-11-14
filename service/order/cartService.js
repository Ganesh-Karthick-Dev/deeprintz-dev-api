const _ = require("lodash");

module.exports.addtocart = async (props) => {
  const {
    tenantid,
    tenantproductid,
    quantity,
    productcost,
    //charges,
    //taxamount,
    taxpercent,
    //totalamount,
    printingTypeId
  } = props;

  try {

        var tenantproduct = await global.dbConnection('tenantproducts')
                            .select(
                              'productcost',
                              'othercost'
                            ).where('tenantproductid' , tenantproductid)

        
        var cost = tenantproduct[0].othercost;
        var charges = cost;
        var taxamount = (Number(taxpercent) / Number(100)) * (Number(productcost));
        var totalamount = (Number(productcost) + Number(taxamount) + Number(charges)) * quantity;

 
        const response = await global.dbConnection('carts').
        insert({
          tenantid,
          tenantproductid,
          quantity,
          productcost,
          charges,
          taxamount,
          taxpercent,
          totalamount,
          printingTypeId
        })
            return !_.isEmpty(response) ? response : null
     
  }
  catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.removefromcart = async (props) => {
     const {cartid} = props
  try {
      
         const response = await global.dbConnection('carts').del().where({cartid})

         return response >= 1 ? response : null
         
  }
  catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.getcartitemsbytenantid = async (props) => {
   const {tenantid} = props

  try {

    var shipcharge = await global.dbConnection('ordercharges').
      select(
        'chargevalue',
        'chargeamount',
        'chargegst',
      ).where('chargetype','shipping').andWhere('chargename' , 'surface_mode')

    var weight = shipcharge[0].chargevalue;
    var price = shipcharge[0].chargeamount;
    var shipgst = shipcharge[0].chargegst;

    var priceperkg = price / weight;
    //var shipprice = priceperkg + shipgst;

    const response = await global.dbConnection('carts')
            .leftJoin('tenantproducts','tenantproducts.tenantproductid','carts.tenantproductid')
            .leftJoin('app_types' , 'app_types.apptypeid' , 'carts.printingtypeid')
            .leftJoin('products' , 'products.productid' , 'tenantproducts.productid')
            .leftJoin('productvariants' , 'productvariants.variantid' , 'tenantproducts.variantid')
            .select(
              'carts.tenantid',
              'carts.cartid',
              'carts.tenantproductid',
              'carts.quantity',
              'carts.charges',
              'carts.printingtypeid',
              'carts.productcost',
              'carts.taxamount',
              'carts.taxpercent',
              'carts.totalamount',
              'carts.created',
              'tenantproducts.productsku',
              'tenantproducts.plain',
              'app_types.typename as printingtype',
              'productvariants.weight',
              'products.productname'
              ).where('carts.tenantid',tenantid).groupBy('carts.cartid')

              await Promise.all(response.map(async product => {
                const specs = await global.dbConnection('tenantproductspecs').
                  leftJoin('app_types', 'app_types.apptypeid', 'tenantproductspecs.placementid')
                  .select(
                   'tenantproductspecs.specid',
                   'tenantproductspecs.placementid',
                   'app_types.typename',
                   'tenantproductspecs.width',
                   'tenantproductspecs.height',
                   'tenantproductspecs.design_name',
                   'tenantproductspecs.hpsvalue',
                   'tenantproductspecs.imageurl',
                   'tenantproductspecs.designurl'
                  ).where('tenantproductspecs.tenantproductid', product.tenantproductid)
                  
          
                product.specs = specs
                
              }))  

            const result = {
                shippingCharge: priceperkg,
                products: response                
            };
              
              //await Promise.all(response.map(async))
              
    
    return !_.isEmpty(result) ? result : null
  }
  catch (err) {
    console.log("error", err)
  }
  return null
}



module.exports.getProductByCartid = async (props) => {
   const {cartid} = props

  try {

    const response = await global.dbConnection('carts')
            .leftJoin('tenantproducts','tenantproducts.tenantproductid','carts.tenantproductid')
              .select(
          'carts.tenantid',
          'carts.cartid',
          'carts.tenantproductid',
          'carts.quantity',
          'carts.charges',
          'carts.productcost',
          'carts.taxamount',
          'carts.taxpercent',
          'carts.totalamount',
          'tenantproducts.productsku',
          'tenantproducts.plain',
              ).where('carts.cartid',cartid)
         
            const tenantproductid = response[0].tenantproductid
             
                const specs = await global.dbConnection('tenantproductspecs').
                  leftJoin('app_types', 'app_types.apptypeid', 'tenantproductspecs.placementid')
                  .select(
                   'tenantproductspecs.specid',
                   'tenantproductspecs.placementid',
                   'app_types.typename',
                   'tenantproductspecs.width',
                   'tenantproductspecs.height',
                   'tenantproductspecs.design_name',
                   'tenantproductspecs.imageurl'
                  ).where('tenantproductspecs.tenantproductid', tenantproductid)     

        const result = {product:response,specs: specs}
    return !_.isEmpty(result) ? result : null
  }
  catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.addWishlist = async (userId, productId) => {
  try {
    const existingEntry = await global.dbConnection('wishlists')
      .where('userId', userId)
      .andWhere('productId', productId)
      .first();

    if (existingEntry) {
      return { status: false, message: "Item already in wishlist." };
    }
    const response = await global.dbConnection('wishlists').insert({
      userId: userId,
      productId: productId,
    });

    return response.length >= 1
      ? { status: true, message: "Item added to wishlist." }
      : { status: false, message: "Failed to add item to wishlist." };
  } catch (err) {
    console.log("error", err);
    return { status: false, message: "An error occurred." };
  }
};


module.exports.removeWishlist = async (userId, productId) => {
  try {
    // Attempt to delete the entry
    const response = await global.dbConnection('wishlists')
      .where('userId', userId) // Adjusted column name to 'user_id'
      .andWhere('productId', productId) // Adjusted column name to 'product_id'
      .del();

    // Check the response to determine if a record was deleted
    if (response >= 1) {
      return { status: true, message: "Item removed from wishlist." };
    } else {
      return { status: false, message: "Item not found in wishlist." };
    }
  } catch (err) {
    console.error("Error:", err);
    return { status: false, message: "An error occurred while removing the item from the wishlist." };
  }
};

module.exports.getWishlist = async (userId) => {
 try {

  const result = await global.dbConnection('wishlists')
  .leftJoin('products', 'products.productid', 'wishlists.productId')
  .select(
    'products.productid',
    'products.slug',
    'products.productname',
    'products.displayFrontImage',
    'products.baseprice',
    'wishlists.createdAt',
  ) // Select all columns
  .where('userId', userId);

   return !_.isEmpty(result) ? result : null
 }
 catch (err) {
   console.log("error", err)
 }
 return null
}