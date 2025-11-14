

module.exports.saveShopifyProduct = async (props) => {
    try {
        const knex = global.dbConnection;
        let printingcharge = 0;
        let othercost = 0;

        // Calculate printing charges if specs are provided
        if (props?.plain == "no" && props?.specs && props?.specs.length > 0) {
            console.log('🖨️ Calculating printing charges for customized product...');
            
            for (let i = 0; i < props.specs.length; i++) {
                const spec = props.specs[i];
                const designwidth = spec?.width;
                const designheight = spec?.height;
                const quantity = props?.quantity || 1;
                const colorid = props?.colorid;
                const printingtypeid = props?.printingtypeid;

                if (!designwidth || !designheight || !colorid || !printingtypeid) {
                    console.log('⚠️ Missing required fields for printing charge calculation');
                    continue;
                }

                const dimension = Number(designwidth) * Number(designheight);

                // Get color information
                const color = await knex('app_types')
                    .select('typename')
                    .where('apptypeid', colorid)
                    .first();

                if (!color) {
                    console.log('⚠️ Color not found for colorid:', colorid);
                    continue;
                }

                let specPrintingCharge = 0;

                if (color.typename === "White") {
                    // White garment calculation
                    const multiplyWidthAndHeight = (Number(designwidth)).toFixed(1) * (Number(designheight)).toFixed(1);
                    const multiplyWithWhiteGarment = multiplyWidthAndHeight * 0.7;
                    const gst = (multiplyWithWhiteGarment * 5) / 100;
                    const addingGst = multiplyWithWhiteGarment + gst;
                    const addingHandlingCharge = addingGst + 20;
                    const multiplyWithQuantity = addingHandlingCharge * Number(quantity);
                    specPrintingCharge = multiplyWithQuantity < 80 ? 105 : multiplyWithQuantity;

                    console.log(`🖨️ White garment calculation:`, {
                        multiplyWidthAndHeight,
                        multiplyWithWhiteGarment,
                        gst,
                        addingGst,
                        addingHandlingCharge,
                        multiplyWithQuantity,
                        specPrintingCharge
                    });
                } else {
                    // Colored garment calculation
                    const multiplyWidthAndHeight = (Number(designwidth)).toFixed(1) * (Number(designheight)).toFixed(1);
                    const multiplyWithColorGarment = multiplyWidthAndHeight * 1.2;
                    const gst = (multiplyWithColorGarment * 5) / 100;
                    const addingGst = multiplyWithColorGarment + gst;
                    const addingHandlingCharge = addingGst + 20;
                    const multiplyWithQuantity = addingHandlingCharge * Number(quantity);
                    specPrintingCharge = multiplyWithQuantity < 100 ? 126 : multiplyWithQuantity;

                    console.log(`🖨️ Colored garment calculation:`, {
                        multiplyWidthAndHeight,
                        multiplyWithColorGarment,
                        gst,
                        addingGst,
                        addingHandlingCharge,
                        multiplyWithQuantity,
                        specPrintingCharge
                    });
                }

                printingcharge += Number(specPrintingCharge);
                console.log(`💰 Printing charge for spec ${i + 1}: ${specPrintingCharge}, Total printing charge: ${printingcharge}`);
            }
        } else if (props?.plain == "yes") {
            // For plain products, set a basic handling charge as othercost
            const quantity = props?.quantity || 1;
            othercost = 20 * Number(quantity);
            console.log(`📦 Plain product handling charge (othercost): ${othercost}`);
        }

        if (props?.plain == "no") {
            const insertData = props?.specs?.map((data) => {
                return {
                    productid: Number(props?.productid),
                    tenantid: props?.tenantid,
                    productcost: props?.productcost,
                    plain: props?.plain,
                    position: data?.design_name,
                    width: data?.width,
                    height: data?.height,
                    designurl: data?.designurl,
                    productname: props?.productname,
                    printingcharge: printingcharge, // Store printing charge separately
                    othercost: othercost // Store other cost separately
                }
            })

            const insertLibraryData = await global.dbConnection('shopify_products')
                .insert(insertData)

            console.log(`✅ Saved customized product - Printing charge: ${printingcharge}, Other cost: ${othercost}`);
            return !!insertLibraryData
        }
        else {
            const insertData = {
                productid: Number(props?.productid),
                tenantid: props?.tenantid,
                productcost: props?.productcost,
                plain: props?.plain,
                position: props?.placement,
                designurl: props?.plainImage,
                productname: props?.productname,
                printingcharge: printingcharge, // Store printing charge separately
                othercost: othercost // Store other cost separately
            }

            const insertLibraryData = await global.dbConnection('shopify_products')
                .insert(insertData)

            console.log(`✅ Saved plain product - Printing charge: ${printingcharge}, Other cost: ${othercost}`);
            return !!insertLibraryData
        }

    } catch (error) {
        console.log(`error in saveShopifyProduct service - `, error);
        return false;
    }
}

module.exports.updateUserProduct = async (props) => {
    try {
        const {
            shopifyProductId,
            shopifyProductName,
            shopifydesc,
            variants,
        } = props;

        // 🔹 Update query
        const updatedCount = await global.dbConnection("shopify_products")
            .where("id", shopifyProductId)
            .update({
                productname: shopifyProductName,
                productdesc: shopifydesc,
                variants: JSON.stringify(variants),
            });

        // 🔹 Knex returns number of rows updated
        if (updatedCount === 0) {
            return {
                status: false,
                message: "No product found with the given ID",
            };
        }

        // 🔹 Fetch updated product and return
        const updatedProduct = await global.dbConnection("shopify_products")
            .where("id", shopifyProductId)
            .first();

        return {
            status: true,
            message: "Product updated successfully",
            data: updatedProduct,
        };
    } catch (error) {
        console.log("❌ error in updateUserProduct service - ", error);
        return {
            status: false,
            message: "Internal server error",
            error: error.message,
        };
    }
};


module.exports.getShopifyProducts = async (props) => {
    try {

        let shopifyProducts = await global.dbConnection('shopify_products')
            .leftJoin('products', 'products.productid', 'shopify_products.productid')
            .leftJoin('productcategories', 'productcategories.categoryid', 'products.productcategoryid')
            .leftJoin('woocommerce_products_sync', 'woocommerce_products_sync.local_product_id', 'shopify_products.id')
            .leftJoin('app_types', global.dbConnection.raw(`FIND_IN_SET(app_types.apptypeid, products.producttypeid)`))
            .leftJoin('app_types as designPlacement', global.dbConnection.raw(`FIND_IN_SET(designPlacement.apptypeid, products.designplacement)`))
            .select(
                'shopify_products.id as shopify_product_id',
                'shopify_products.tenantid',
                'shopify_products.productcost as shopify_product_cost',
                'shopify_products.plain',
                'shopify_products.position',
                'shopify_products.width',
                'shopify_products.height',
                'shopify_products.designurl as shopify_design_url',
                'shopify_products.productname as shopify_product_name',
                'shopify_products.productdesc as shopify_product_desc',
                'shopify_products.variants as shopify_variants',
                'shopify_products.printingcharge as shopify_printing_charge',
                'shopify_products.othercost as shopify_other_cost',
                'products.productid',
                'products.productcategoryid',
                'productcategories.categoryname',
                'products.productname',
                'products.productdesc',
                'products.productstock',
                'products.productcost',
                'products.othercost',
                'products.handlingcost',
                'products.retailprice',
                'products.productsku',
                'products.baseprice',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT app_types.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT app_types.apptypeid) as printingtypeid'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT designPlacement.typename) as placements'),
                'products.slug',
                'products.displayFrontImage',
                'products.productstatus',
                'woocommerce_products_sync.woo_product_id as woocommerce_product_id',
                'woocommerce_products_sync.isDeleted'
            )
            .groupBy(
                'shopify_products.id',
                'shopify_products.tenantid',
                'shopify_products.productcost',
                'shopify_products.plain',
                'shopify_products.position',
                'shopify_products.width',
                'shopify_products.height',
                'shopify_products.designurl',
                'shopify_products.productname',
                'shopify_products.printingcharge',
                'shopify_products.othercost',
                'products.productid',
                'products.productcategoryid',
                'products.productname',
                'products.productdesc',
                'products.productstock',
                'products.productcost',
                'products.othercost',
                'products.handlingcost',
                'products.retailprice',
                'products.productsku',
                'products.baseprice',
                'products.slug',
                'products.displayFrontImage',
                'products.productstatus'
            )
            .where('shopify_products.tenantid', props?.tenantid)

        // Get variants for each product
        await Promise.all(shopifyProducts.map(async product => {
            // Normalize shopify_variants
            if (product.shopify_variants && product.shopify_variants.trim() !== "") {
                try {
                    product.shopify_variants = JSON.parse(product.shopify_variants);
                } catch (e) {
                    product.shopify_variants = []; // fallback if JSON is invalid
                }
            } else {
                product.shopify_variants = [];
            }
        
            if (product.productid) {
                // get variants
                const variants = await global.dbConnection('productvariants')
                    .leftJoin('app_types', 'app_types.apptypeid', 'productvariants.varianttype1')
                    .leftJoin('app_types as app_types2', 'app_types2.apptypeid', 'productvariants.varianttype2')
                    .leftJoin('app_types as app_types3', 'app_types3.apptypeid', 'productvariants.varianttype')
                    .select(
                        "productvariants.productid",
                        "productvariants.variantid",
                        "app_types.typename as color",
                        "app_types.apptypeid as colorid",
                        "app_types.code as colorcode",
                        "app_types2.typename as size",
                        "app_types2.apptypeid as sizeid",
                        "app_types2.sku as sizesku",
                        "app_types3.typename as printingtype",
                        "app_types3.apptypeid as printingtypeid",
                        "productvariants.variantsku",
                        "productvariants.weight",
                        "productvariants.unit",
                        "productvariants.price",
                        "productvariants.status",
                        "productvariants.quantity",
                        "productvariants.tax"
                    )
                    .where('productid', product.productid);
        
                product.variants = variants;
        
                // product images
                const images = await global.dbConnection('productimages')
                    .join('app_types', 'app_types.apptypeid', 'productimages.colorid')
                    .join('app_types as app_types2', 'app_types2.apptypeid', 'productimages.apptypeid1')
                    .select(
                        "productid",
                        "productimages.productimageid",
                        'app_types.typename as color',
                        'app_types.apptypeid as colorid',
                        'app_types.code as code',
                        'app_types2.typename as placement',
                        'app_types2.apptypeid as placementid',
                        'imageurl'
                    )
                    .where('productid', product.productid);
        
                product.images = images;
        
                // display images
                const displayimages = await global.dbConnection('productimages')
                    .select("productid", "imageurl")
                    .where('productid', product.productid)
                    .andWhere('apptypeid1', null);
        
                product.displayimages = displayimages;
            } else {
                product.variants = [];
                product.images = [];
                product.displayimages = [];
            }
        }));
        
        

        return shopifyProducts ? shopifyProducts : false


    } catch (error) {
        console.log(`error in getShopifyProducts service - `, error);
    }
}

module.exports.getShopifyProductById = async (productId) => {
    try {
      let shopifyProducts = await global.dbConnection('shopify_products')
        .select(
          'shopify_products.id as shopifyProductId',
          'shopify_products.productid as deeprintzProductId',
          'shopify_products.productcost as shopifyProductCost',
          'shopify_products.productname',
          'shopify_products.productdesc',
          'shopify_products.variants',
          'shopify_products.position',
          'shopify_products.width',
          'shopify_products.height',
          'shopify_products.designurl'
        )
        .where('shopify_products.id', productId)
        .first(); // since productId is unique
  
      if (!shopifyProducts) return false;
  
      // Parse variants if stored as JSON string
      if (shopifyProducts.variants) {
        try {
          shopifyProducts.variants = JSON.parse(shopifyProducts.variants);
        } catch (e) {
          console.error("Error parsing variants JSON:", e);
          shopifyProducts.variants = [];
        }
      }
  
      return shopifyProducts;
  
    } catch (error) {
      console.log(`error in getShopifyProducts service - `, error);
      return false;
    }
};
  

module.exports.deleteShopifyProducts = async (props) => {
    try {

        const { id } = props

        const data = await global.dbConnection('shopify_products')
            .del()
            .where('shopify_products.id', id)

        return !!data

    } catch (error) {
        console.log(`error in deleteShopifyProducts service - `, error);
    }
}





module.exports.checkShopifyConnected = async (props) => {
    try {

        const { userid } = props

        const checkStoreConnected = await global.dbConnection('app_users')
            .select('userid', 'store_url', 'store_access_token')
            .where('app_users.userid', userid)
            .first()

        return checkStoreConnected ? checkStoreConnected : false

    } catch (error) {
        console.log(`error in checkShopifyConnected service - `, error);
    }
} 