const _ = require("lodash");
const userService = require("../service/categoryService");
const { logger } = require("../config/mail");

module.exports.addProduct = async (props) => {
  const {
    variants,
    catId: productcategoryid,
    name,
    description,
    images,
    printing_type_id,
    product_sku,
    display_images,
    base_price,
    design_placement_id

  } = props;

  try {

    const slug = userService.generateSlug(name)

    const array = printing_type_id
    const delimiter = ',';

    const printing_type = _.join(array, delimiter);

    const placements = _.join(design_placement_id, delimiter);

    // Adding product
    const productresponse = await global.dbConnection('products').
      insert({
        productcategoryid: productcategoryid,
        productname: name,
        productdesc: description,
        slug,
        productsku: product_sku,
        producttypeid: printing_type,
        baseprice: base_price,
        designplacement: placements
      })

    // adding variants

    const result = variants.map(variant => {

      return {
        varianttype1: variant.colorid,
        varianttype2: variant.sizeid,
        weight: variant.weight,
        variantsku: variant.sku,
        productid: productresponse[0],
        unit: variant.unit,
        price: variant.price,
        tax: variant.tax
      }
    })

    // Adding products image

    const variantimages = _.flatMap(images, item => {
      const colorid = parseInt(item.color_id);

      return _.map(item.designs, design => {
        const productid = productresponse[0]
        const apptypeid1 = parseInt(design.design_placement_id);
        const imageurl = design.image;

        return { productid, colorid, apptypeid1, imageurl };
      });
    });
    // Adding display images

    const displayimages = _.map(display_images, img => {
      const productid = productresponse[0]
      const imageurl = img

      return { productid, imageurl }
    })

    const allimages = [variantimages, displayimages]

    const totalimages = _.flatMap(allimages, img => img)


    if (!_.isEmpty(productresponse)) {
      const variantresponse = await global.dbConnection('productvariants').insert(result)

      if (!_.isEmpty(variantresponse)) {
        const imageresponse = await global.dbConnection('productimages').insert(totalimages)

        return !_.isEmpty(imageresponse) ? productresponse : null;
      }
    }
    return null;
  }
  catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.isProductNameAlreadyExists = async (props) => {
  const { catId, name } = props

  try {
    const slug = userService.generateSlug(name)
    const response = await global.dbConnection('products').select('*').where({ productcategoryid: catId, slug: slug })
    return !_.isEmpty(response) ? true : false
  } catch (err) {
    console.log("error", err)
  }
  return false
}
module.exports.isUpdateProductNameExists = async (props) => {
  const { catId, name, product_id } = props

  try {
    const slug = userService.generateSlug(name)

    const response = await global.dbConnection('products').select('*').
      whereNot({ productid: product_id }).
      where({ productcategoryid: catId, slug: slug })
    return !_.isEmpty(response) ? true : false
  } catch (err) {
    console.log("error", err)
  }
  return false
}
module.exports.isProductVariantAlreadyExists = async (props) => {
  const { catId, name, sizeIds, colorIds } = props

  try {

    let sizeIdsArray = JSON.parse(sizeIds);
    let colorIdsArray = JSON.parse(colorIds);
    const productid = await global.dbConnection('products').select('productid').where({ productcategoryid: catId, productname: name })
    console.log("productid...", productid)
    if (!_.isEmpty(productid)) {
      const variant = await global.dbConnection('productvariants').select('varianttype1', 'varianttype2').where({ variantproductid: productid[0].productid })
      console.log("variant...", variant)
      console.log(sizeIds, colorIds)

      const result = _.flatten(await Promise.all(_.flatMap(sizeIdsArray, async (size) => {
        return await Promise.all(_.map(colorIdsArray, async (color) => {
          const sku = await this.generateSku({ catId, name: skuname, color, size }); // Generate SKU asynchronously
          return {
            variantproductid: productresponse[0],
            varianttype1: color,
            variantsku: sku,
            varianttype2: size,
            weight: weight
          };
        }));
      })));
      return !_.isEmpty(variant) ? true : false
    }
  } catch (err) {
    console.log("error", err)
  }
  return false
}



module.exports.updateProduct = async (props) => {
  const {
    product_id,
    variants,
    catId,
    name,
    description,
    images,
    printing_type_id,
    designplacement
  } = props;

  try {
    const slug = userService.generateSlug(name)

    const array = printing_type_id
    const delimiter = ',';

    const printing_type = _.join(array, delimiter);

    //updating product
    const updateproduct = await global.dbConnection('products').
      update({
        productcategoryid: catId,
        productname: name,
        productdesc: description,
        slug: slug,
        producttypeid: printing_type,
        designplacement: designplacement
      }).where('productid', product_id)

    console.log("updateproduct")
    // Deleting old variants && productimages
    if (!_.isEmpty(variants[0].delete)) {
      const deletevariant = await global.dbConnection('productvariants').del().whereIn('variantid', variants[0].delete)

      console.log("deleted variants", deletevariant)
    }

    const deleteimages = await global.dbConnection('productimages').del().where('productid', product_id)

    console.log("deleted images", deleteimages)
    // adding new product variant

    if (!_.isEmpty(variants[0].insert)) {

      const insertarray = variants[0].insert.map(variant => {

        return {
          varianttype1: variant.colorid,
          varianttype2: variant.sizeid,
          weight: variant.weight,
          variantsku: variant.sku,
          productid: product_id,
          unit: variant.unit,
          price: variant.price,
          quantity: variant.qty,
          tax: variant.tax
        }
      })
      const productvariantinsert = await global.dbConnection('productvariants').
        insert(insertarray)

      console.log(productvariantinsert)
    }

    if (updateproduct == 1) {

      //updating product variants 
      const updatearray = variants[0].update.map(variant => {
        return {
          varianttype1: variant.colorid,
          varianttype2: variant.sizeid,
          weight: variant.weight,
          variantsku: variant.sku,
          unit: variant.unit,
          price: variant.price,
          quantity: variant.qty,
          tax: variant.tax
        }
      })
      const variantIds = variants[0].update.map(variant => variant.variantid);

      const productvariantupdate = await Promise.all(_.map(_.zip(updatearray, variantIds), ([variant, variantId]) =>
        global.dbConnection('productvariants')
          .where('variantid', variantId)
          .update(variant)))


      console.log("variants update", productvariantupdate)
      console.log(!_.isNull(productvariantupdate))

      if (!_.isEmpty(productvariantupdate)) {
        // Adding products image

        const output = _.flatMap(images, item => {
          const colorid = parseInt(item.color_id);

          return _.map(item.designs, design => {
            const productid = product_id
            const apptypeid1 = parseInt(design.design_placement_id);
            const imageurl = design.image;

            return { productid, colorid, apptypeid1, imageurl };
          });
        });
        //console.log(output);
        if (!_.isEmpty(output)) {
          const imageresponse = await global.dbConnection('productimages').insert(output)
          console.log("img res", imageresponse)
          return !_.isEmpty(imageresponse) ? updateproduct : null
        } else {
          return updateproduct;
        }


      }
    }
    return null;


  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.updateProductStock = async (props) => {
  const { productid, variants } = props
  try {

    let totalQty = 0;

    variants.forEach(variant => {
      totalQty += parseInt(variant.quantity, 10);
    });
    console.log("total", totalQty)
    const productstock = await global.dbConnection('products').
      update({
        productstock: totalQty
      }).where('productid', productid)

    if (productstock == 1) {

      const variantstock = await Promise.all(_.map(variants, async (variant) => {
        const rows = await global.dbConnection('productvariants')
          .where('variantid', variant.variantid)
          .update({ quantity: variant.quantity });

        return rows
      }));

      console.log("variant stock", variantstock)
      return !_.isEmpty(variantstock) ? variantstock : null
    }
  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.generateSku = async (props) => {

  const { catId, color, size, name } = props
  try {

    const catsku = await global.dbConnection('productcategories').select('sku').where('categoryid', catId);
    const colorsku = await global.dbConnection('app_types').select('sku').where('apptypeid', color);
    const sizesku = await global.dbConnection('app_types').select('sku').where('apptypeid', size);

    if (!_.isEmpty(catsku) || !_.isEmpty(subcatsku) || !_.isEmpty(colorsku) || !_.isEmpty(sizesku)) {
      const sku = `${name}-${catsku[0].sku}-${colorsku[0].sku}-${sizesku[0].sku}`

      return (sku) ? sku : null
    }

  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.getproductsbycatId = async (props) => {
  const { id } = props;
  try {
    const response = await global.dbConnection('products').select('*').where({ productcategoryid: id, productstatus: 'Active' })

    return !_.isEmpty(response) ? response : null;
  } catch (err) {
    console.log("Error", err)
  }
  return null
}
module.exports.getproductsbycatsubcatId = async (props) => {
  const { catId } = props;
  try {
    let products = await global.dbConnection('products').
      join('productcategories', 'productcategories.categoryid', 'products.productcategoryid').
      join('app_types', global.dbConnection.raw(`FIND_IN_SET(app_types.apptypeid, products.producttypeid)`)).
      select("products.productid",
        "products.productcategoryid",
        "productcategories.categoryname",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.productcost",
        "products.othercost",
        "products.handlingcost",
        "products.retailprice",
        "products.baseprice",
        "products.productsku",
        global.dbConnection.raw('GROUP_CONCAT(app_types.typename) as printingtype'),
        global.dbConnection.raw('GROUP_CONCAT(app_types.apptypeid) as printingtypeid'),
        "products.slug",
        "products.productstatus")
      .groupBy("products.productid",
        "products.productcategoryid",
        "products.productname",
        "products.productdesc",
        "products.slug",
        "products.productstatus").where({ productcategoryid: catId })

    await Promise.all(products.map(async product => {
      const variants = await global.dbConnection('productvariants').
        leftJoin('app_types', 'app_types.apptypeid', 'productvariants.varianttype1').
        leftJoin('app_types as app_types2', 'app_types2.apptypeid', 'productvariants.varianttype2').
        leftJoin('app_types as app_types3', 'app_types3.apptypeid', 'productvariants.varianttype').
        select(
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
          "productvariants.tax",
          "productvariants.quantity"
        ).where('productid', product.productid)

      product.variants = variants

      const images = await global.dbConnection('productimages').
        join('app_types', 'app_types.apptypeid', 'productimages.colorid').
        join('app_types as app_types2', 'app_types2.apptypeid', 'productimages.apptypeid1').
        select(
          "productid",
          'app_types.typename as color',
          'app_types.apptypeid as colorid',
          'app_types2.typename as placement',
          'app_types2.apptypeid as placementid',
          'imageurl'
        ).where('productid', product.productid)

      product.images = images

      const displayimages = await global.dbConnection('productimages').
        select(
          "productid",
          'imageurl'
        ).where('productid', product.productid).andWhere('apptypeid1', null)

      product.displayimages = displayimages
    }))


    return !_.isEmpty(products) ? products : []

  } catch (err) {
    console.log("Error", err)
  }
  return null
}
module.exports.getproductsbycolor = async (props) => {
  const { id } = props;
  try {
    const response = await global.dbConnection('products').select('*').where({ colorid: id, productstatus: 'Active' })

    return !_.isEmpty(response) ? response : null;
  } catch (err) {
    console.log("Error", err)
  }
  return null
}
module.exports.getproductsbysize = async (props) => {
  const { id } = props;
  console.log("id..", id)
  try {
    const response = await global.dbConnection('products').select('*').where({ sizeid: id, productstatus: 'Active' })

    return !_.isEmpty(response) ? response : null;
  } catch (err) {
    console.log("Error", err)
  }
  return null
}
module.exports.getproductsbyname = async (props) => {
  const { name } = props;
  try {
    const response = await global.dbConnection('products').select('*').where({ productname: name, productstatus: 'Active' })

    return !_.isEmpty(response) ? response : null;
  } catch (err) {
    console.log("Error", err)
  }
  return null
}

module.exports.getAllProducts = async () => {
  try {

    let products = await global.dbConnection('products').
      join('productcategories', 'productcategories.categoryid', 'products.productcategoryid').
      join('app_types', global.dbConnection.raw(`FIND_IN_SET(app_types.apptypeid, products.producttypeid)`)).
      join('app_types as designPlacement', global.dbConnection.raw(`FIND_IN_SET(designPlacement.apptypeid, products.designplacement)`)).
      select("products.productid",
        "products.productcategoryid",
        "productcategories.categoryname",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.productcost",
        "products.othercost",
        "products.handlingcost",
        "products.baseprice",
        "products.productsku",
        "products.retailprice",
        global.dbConnection.raw('GROUP_CONCAT(DISTINCT app_types.typename) as printingtype'),
        global.dbConnection.raw('GROUP_CONCAT(DISTINCT app_types.apptypeid) as printingtypeid'),
        global.dbConnection.raw('GROUP_CONCAT(DISTINCT designPlacement.typename) as placements'),
        "products.slug",
        "products.displayFrontImage",
        "products.productstatus")
      .groupBy("products.productid",
        "products.productcategoryid",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.baseprice",
        "products.slug",
        "products.productstatus")

    await Promise.all(products.map(async product => {
      const variants = await global.dbConnection('productvariants').
        leftJoin('app_types', 'app_types.apptypeid', 'productvariants.varianttype1').
        leftJoin('app_types as app_types2', 'app_types2.apptypeid', 'productvariants.varianttype2').
        select(
          "productvariants.productid",
          "productvariants.variantid",
          "app_types.typename as color",
          "app_types.apptypeid as colorid",
          "app_types.code as colorcode",
          "app_types2.typename as size",
          "app_types2.apptypeid as sizeid",
          "app_types2.sku as sizesku",
          "productvariants.variantsku",
          "productvariants.weight",
          "productvariants.unit",
          "productvariants.price",
          "productvariants.tax",
          "productvariants.status",
          "productvariants.quantity",
        ).where('productid', product.productid)

      product.variants = variants

      const images = await global.dbConnection('productimages').
        join('app_types', 'app_types.apptypeid', 'productimages.colorid').
        join('app_types as app_types2', 'app_types2.apptypeid', 'productimages.apptypeid1').
        select(
          "productid",
          'app_types.typename as color',
          'app_types.apptypeid as colorid',
          'app_types.code as code',
          'app_types2.typename as placement',
          'app_types2.apptypeid as placementid',
          'imageurl'
        ).where('productid', product.productid)

      product.images = images

      const displayimages = await global.dbConnection('productimages').
        select(
          "productid",
          'imageurl'
        ).where('productid', product.productid).andWhere('apptypeid1', null)

      product.displayimages = displayimages
    }))


    return !_.isEmpty(products) ? products : []
  } catch (err) {
    console.log("error..", err)
  }
  return null
}
module.exports.getProductsById = async (props) => {
  const { productid } = props;
  try {
    let products = await global.dbConnection('products').
      leftJoin('productcategories', 'productcategories.categoryid', 'products.productcategoryid').
      leftJoin('app_types', global.dbConnection.raw(`FIND_IN_SET(app_types.apptypeid, products.producttypeid)`)).
      leftJoin('app_types as designPlacement', global.dbConnection.raw(`FIND_IN_SET(designPlacement.apptypeid, products.designplacement)`)).
      select("products.productid",
        "products.sizeChart",
        "products.productcategoryid",
        "productcategories.categoryname",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.productcost",
        "products.othercost",
        "products.baseprice",
        "products.productsku",
        "products.handlingcost",
        "products.retailprice",
        global.dbConnection.raw('GROUP_CONCAT(designPlacement.apptypeid) as placementId'),
        global.dbConnection.raw('GROUP_CONCAT(app_types.typename) as printingtype'),
        global.dbConnection.raw('GROUP_CONCAT(app_types.apptypeid) as printingtypeid'),
        "products.slug",
        "products.productstatus")
      .groupBy("products.productid",
        "products.productcategoryid",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.baseprice",
        "products.slug",
        "products.productstatus").where({ productid })

    await Promise.all(products.map(async product => {
      const variants = await global.dbConnection('productvariants').
        leftJoin('app_types', 'app_types.apptypeid', 'productvariants.varianttype1').
        leftJoin('app_types as app_types2', 'app_types2.apptypeid', 'productvariants.varianttype2').
        leftJoin('app_types as app_types3', 'app_types3.apptypeid', 'productvariants.varianttype').
        select(
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
          "productvariants.tax",
          "productvariants.quantity",
        ).where('productid', product.productid)

      product.variants = variants

      const images = await global.dbConnection('productimages').
        join('app_types', 'app_types.apptypeid', 'productimages.colorid').
        join('app_types as app_types2', 'app_types2.apptypeid', 'productimages.apptypeid1').
        select(
          "productimageid",
          "productid",
          'app_types.typename as color',
          'app_types.apptypeid as colorid',
          'app_types.code as code',
          'app_types2.typename as placement',
          'app_types2.apptypeid as placementid',
          'imageurl'
        ).where('productid', product.productid)

      product.images = images

      const displayimages = await global.dbConnection('productimages').
        select(
          "productid",
          'imageurl'
        ).where('productid', product.productid).andWhere('apptypeid1', null)

      product.displayimages = displayimages
    }))


    return !_.isEmpty(products) ? products : []
  } catch (err) {
    console.log("error..", err)
  }
  return null
}
module.exports.getproductsbyslug = async (props) => {
  const { slug } = props;
  try {
    let products = await global.dbConnection('products').
      join('productcategories', 'productcategories.categoryid', 'products.productcategoryid').
      join('app_types', global.dbConnection.raw(`FIND_IN_SET(app_types.apptypeid, products.producttypeid)`)).
      select("products.productid",
        "products.sizeChart",
        "products.productcategoryid",
        "productcategories.categoryname",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.productcost",
        "products.othercost",
        "products.handlingcost",
        "products.retailprice",
        "products.productsku",
        "products.baseprice",
        global.dbConnection.raw('GROUP_CONCAT(app_types.typename) as printingtype'),
        global.dbConnection.raw('GROUP_CONCAT(app_types.apptypeid) as printingtypeid'),
        "products.slug",
        "products.productstatus")
      .groupBy("products.productid",
        "products.productcategoryid",
        "products.productname",
        "products.productdesc",
        "products.productstock",
        "products.slug",
        "products.productstatus").where('products.slug', slug)


    await Promise.all(products.map(async product => {
      const variants = await global.dbConnection('productvariants').
        leftJoin('app_types', 'app_types.apptypeid', 'productvariants.varianttype1').
        leftJoin('app_types as app_types2', 'app_types2.apptypeid', 'productvariants.varianttype2').
        leftJoin('app_types as app_types3', 'app_types3.apptypeid', 'productvariants.varianttype').
        select(
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
        ).where('productid', product.productid)

      product.variants = variants

      const images = await global.dbConnection('productimages').
        join('app_types', 'app_types.apptypeid', 'productimages.colorid').
        join('app_types as app_types2', 'app_types2.apptypeid', 'productimages.apptypeid1').
        select(
          "productid",
          "productimages.productimageid",
          'app_types.typename as color',
          'app_types.apptypeid as colorid',
          'app_types.code as code',
          'app_types2.typename as placement',
          'app_types2.apptypeid as placementid',
          'imageurl'
        ).where('productid', product.productid)

      product.images = images

      const displayimages = await global.dbConnection('productimages').
        select(
          "productid",
          'imageurl'
        ).where('productid', product.productid).andWhere('apptypeid1', null)

      product.displayimages = displayimages
    }))

    

    return !_.isEmpty(products) ? products : []
  } catch (err) {
    console.log("error..", err)
  }
  return null
}

module.exports.deleteProduct = async (props) => {
  const { productid } = props
  try {
    const response = await global.dbConnection('products').del().where({ productid })

    if (response == 1) {
      const variant = await global.dbConnection('productvariants').del().where({ productid })

      if (variant > 0) {
        const images = await global.dbConnection('productimages').del().where({ productid })

        return (images > 0) ? response : null;
      }
    }
  } catch (err) {
    console.log("error", err)
  }
}

// Customized products
module.exports.createCustomizedProduct = async (props) => {
  const {
    tenantid,
    productid,
    variantid,
    colorid,
    productcost,
    plain,
    printingtypeid,
    specs,
    quantity
  } = props
  try {
    const knex = global.dbConnection
    const trx = await knex.transaction()

    const designNames = _.map(specs, 'design_name').join('-')
    const printingtype = printingtypeid.join(',')

    //console.log(printingtype)

    //Handling charge:
    var handling = await knex('tenants').select('handlingcharge').where({ tenantid })
    var handlingcharge = 20 * Number(quantity)

    //variant info  
    let variant = await knex('productvariants').
      select(
        'variantsku',
        'weight'
      ).where({ variantid })

    console.log(variant);

    var variantweight = variant[0].weight;

    var varweightinkg = variantweight * 0.001;


    const customizedsku = `${variant[0].variantsku}`
    //console.log(specs);
    if (!_.isEmpty(specs)) {

      var othercost = 0;

      for (let i = 0; i < specs.length; i++) {
        var designwidth = specs[i].width;
        var designheight = specs[i].height;

        var dimension = Number(designwidth) * Number(designheight);

        // Printing charge calculation:

        var printtype = await knex('app_types').
          select( 
            'typename'
          ).where('apptypeid', printingtype)

        console.log(printtype);
        var printselected = printtype[0].typename;

        var color = await knex('app_types').
          select(
            'typename',
          ).where('apptypeid', colorid)

        let charge;

        if (color[0].typename == "Black") {
          charge = await knex('ordercharges').
            select(
              'chargevalue',
              'chargeamount',
              'chargegst',
              'minimumcharge'
            ).where('chargetype', 'printing').andWhere('garment', 'dark')
        } else {
          charge = await knex('ordercharges').
            select(
              'chargevalue',
              'chargeamount',
              'chargegst',
              'minimumcharge'
            ).where('chargetype', 'printing').andWhere('garment', 'white')
        }

        var mincharge = charge[0].minimumcharge;
        var gst = charge[0].chargegst;
        var amountperinch = charge[0].chargeamount;

        // if(dimension < 64){      
        //     var printingcharge = Number(mincharge) * ((Number(gst / Number(100))) + Number(1));   
        // }else{      
        //   var printingcharge = ((Number(dimension) * Number(amountperinch))) * ((Number(gst) / Number(100)) + Number(1));
        // } 

        const totalSquareValueWhite = dimension * 0.7

        const totalSquareValueOthers = dimension * 1.2


        // if (color[0].typename == "White") {
        //   var printingcharge = (((totalSquareValueWhite * 5) / 100) + totalSquareValueWhite) < 80 ? 80 : ((totalSquareValueWhite * 5) / 100) + totalSquareValueWhite
        // } else {
        //   var printingcharge = (((totalSquareValueOthers * 5) / 100) + totalSquareValueOthers) < 100 ? 100 : ((totalSquareValueOthers * 5) / 100) + totalSquareValueOthers
        // }


        if (color[0].typename == "White") {


          const multiplyWidthAndHeight = (Number(designwidth)).toFixed(1) * (Number(designheight)).toFixed(1)

          const multiplyWithWhiteGarment = multiplyWidthAndHeight * 0.7

          const gst = (multiplyWithWhiteGarment * 5) / 100

          const addingGst = multiplyWithWhiteGarment + gst

          const addingHandlingCharge = addingGst + 20

          const multiplyWithQuantity = addingHandlingCharge * Number(quantity)

          var printingcharge = multiplyWithQuantity < 80 ? 105 : multiplyWithQuantity 


          // const gstValue = (totalSquareValueWhite * 5) / 100
          // var finalCost = (totalSquareValueWhite + gstValue) * quantity

          // var withHandling = finalCost < 80 ? 100 * quantity  : finalCost

          // var printingcharge = (quantity * 20) + withHandling

          // console.log(`gstValue - `,gstValue);
          // console.log(`printingcharge - `,printingcharge);

        } else {

          const multiplyWidthAndHeight = (Number(designwidth)).toFixed(1) * (Number(designheight)).toFixed(1) // multiplication of width and height

          const multiplyWithColorGarment = multiplyWidthAndHeight * 1.2 // prev + printing per sq

          const gst = (multiplyWithColorGarment * 5) / 100 // gst for printing

          const addingGst = multiplyWithColorGarment + gst // gst + printing

          const addingHandlingCharge = addingGst + 20 // adding handling charge of 20

          const multiplyWithQuantity = addingHandlingCharge * Number(quantity) // multiply everything with quantity

          var printingcharge = multiplyWithQuantity < 100 ? 126 : multiplyWithQuantity // dynamic final value


          console.log(`multiplyWidthAndHeight - `,multiplyWidthAndHeight);
          console.log(`multiplyWithColorGarment - `,multiplyWithColorGarment);
          console.log(`addingGst - `,addingGst);
          console.log(`addingHandlingCharge - `,addingHandlingCharge);
          console.log(`multiplyWithQuantity - `,multiplyWithQuantity);
          console.log(`printingcharge - `,printingcharge);


          console.log(`othercost - `,othercost);
          

          // const gstValue = (totalSquareValueOthers * 5) / 100
          // var finalCost = (totalSquareValueOthers + gstValue) * quantity

          // var withHandling = finalCost < 100 ? 120 * quantity : finalCost

          // var printingcharge = (quantity * 20) + withHandling
        }




        //var handlingcharge = 20;
        // var cost = Number(printingcharge) + Number(handlingcharge);
        var cost = Number(printingcharge)
        othercost += cost;
      }
    } else {
      //var handlingcharge = 20;
      var othercost = handlingcharge;
    }


    // Shipping charge calculation:

    var shipcharge = await knex('ordercharges').
      select(
        'chargevalue',
        'chargeamount',
        'chargegst',
      ).where('chargetype','shipping')

    var weight = shipcharge[0].chargevalue;
    var price = shipcharge[0].chargeamount;
    var shipgst = shipcharge[0].chargegst;

    var priceperkg = price / weight;
    var shipprice = varweightinkg * priceperkg;



    console.log(othercost);

    // adding product
    const response1 = await trx('tenantproducts').insert({
      tenantid,
      productid,
      variantid,
      productcost,
      plain,
      othercost,
      productsku: customizedsku,
      printingtypeid: printingtype
    })
    if (!_.isEmpty(response1)) {

      if (!_.isEmpty(specs)) {
        const result = specs.map(item => {
          return {
            ...item,
            tenantproductid: response1[0]
          }
        })
        console.log("result...", result)
        const response2 = await trx('tenantproductspecs').insert(result)

        if (!_.isEmpty(response2)) {
          await trx.commit()
          return response1
        }
      } else {
        await trx.commit()
        return response1
      }
    }

    console.log(`final 🔥 othercost - `,othercost);

    await trx.rollback();
    return null
  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.getCusProductsByTenantId = async (props) => {
  const { tenantid } = props;
  try {

    const response = await global.dbConnection('tenantproducts')
      .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'tenantproducts.tenantproductid')
      .leftJoin('app_types', 'app_types.apptypeid', 'tenantproductspecs.placementid')
      .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
      .select(
        'tenantproducts.tenantproductid',
        'tenantproducts.productid',
        'tenantproducts.variantid',
        global.dbConnection.raw('GROUP_CONCAT(ap.typename) as printingtype'),
        global.dbConnection.raw('GROUP_CONCAT(ap.apptypeid) as printingtypeid'),
        'tenantproducts.productcost',
        'tenantproducts.othercost',
        'tenantproducts.productsku',
        'tenantproducts.plain'
      ).groupBy(
        'tenantproducts.tenantproductid'
      )
      .where('tenantproducts.tenantid', tenantid)

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
          'tenantproductspecs.imageurl',
          'tenantproductspecs.designurl',
        ).where('tenantproductspecs.tenantproductid', product.tenantproductid)

      product.specs = specs

    }))

    return !_.isEmpty(response) ? response : null
  } catch (err) {
    console.log("error..", err)
  }
  return null
}

module.exports.getAllSkuBySearch = async (props) => {
  const { sku } = props
  try {
    const response = await global.dbConnection('productvariants')
      .select(
        'variantid',
        'variantsku',
        'quantity'
      )
      .whereRaw('LOWER(variantsku) LIKE ?', [`%${sku.toLowerCase()}%`]);
    //  .where('variantsku', 'like', `%${sku}%`)

    return !_.isEmpty(response) ? response : null
  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.getImagesbycolor = async (props) => {
  const { productId, colorId } = props;
  try {
    const response = await global.dbConnection('productimages')
      .select(
        'apptypeid1',
        'imageurl',
        'productimageid'
      )
      .where('productid', productId)
      .where('colorid', colorId);
    //  .where('variantsku', 'like', `%${sku}%`)

    return !_.isEmpty(response) ? response : null
  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.getProductBySku = async (sku) => {
  try {
    const response = await global.dbConnection('productvariants')
      .leftJoin('products', 'products.productid', 'productvariants.productid')
      .select('products.productname')
      .where('productvariants.variantsku', sku)
      .first();
    const productName = response ? response.productname : null;

    const colorSku = sku.split('-')[1];
    const color = await global.dbConnection('app_types').select('typename').where('sku', colorSku).first();
    const productColorName = color ? color.typename : null;

    const sizeSku = sku.split('-')[2];
    const size = await global.dbConnection('app_types').select('typename').where('sku', sizeSku).first();
    const productSize = size ? size.typename : null;

    const skuDetail = {
      productName,
      productColorName,
      productSize
    }
    return skuDetail
  } catch (err) {
    console.log("error", err)
  }
  return null
}


module.exports.getVariantIdBySku = async (props) => {
  const { sku } = props
  try {
    const response = await global.dbConnection('productvariants')
      .select(
        'variantid',
        'variantsku',
        'quantity'
      )
    .whereRaw('LOWER(variantsku) = ?', [sku.toLowerCase()])
     .first();
    return !_.isEmpty(response) ? response : null
  } catch (err) {
    console.log("error", err)
  }
  return null
}