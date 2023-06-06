import ReactionError from "@reactioncommerce/reaction-error";
import encodeOpaqueId from "@reactioncommerce/api-utils/encodeOpaqueId.js";

//encode fulfillment id 
const encodeFulfillmentGroupOpaqueId = encodeOpaqueId("reaction/fulfillmentMethod");
//check user city, return true if islamabad 
function isSameCity(city) {
  const pattern = /^(isd|islamabad|rwp|rawalpindi|ict)$/;
  const isValid = pattern.test(city.toLowerCase());
  return isValid;
}
/**
 * @name getOrderShippingByAddress
 * @method
 * @memberof Order/NoMeteorQueries
 * @summary Query the Orders collection for an order with the provided orderId
 * @param {Object} context - an object containing the per-request state
 * @param {Object} params - request parameters
 * @param {String} params.orderId - Order ID
 * @param {String} params.shopId - Shop ID for the shop that owns the order
 * @param {String} [params.token] - Anonymous order token
 * @returns {Promise<Object>|undefined} - An Order document, if one is found
 */

export default async function getOrderShippingByAddress(parnet, { input } = {}, context) {
  console.log("input", input);
  const { address, city, amount } = input;
  if (!address || !city) {
    throw new ReactionError("invalid-param", "You must provide address and city arguments");
  }
  const { collections } = context;
  const { Shipping } = collections;
  const ShippingMethodsObj = await Shipping.find({}).toArray();
  if (ShippingMethodsObj) {
    const ShippingMethods = ShippingMethodsObj[0];
    let selectedFullfilmentId = null;
    if (parseInt(amount) >= 3000) {
      const selectedMethodId = ShippingMethods?.methods.filter(item => item.group.toLowerCase() == "free");
      selectedFullfilmentId = await encodeFulfillmentGroupOpaqueId(selectedMethodId[0]?._id);
      
      return {...selectedMethodId[0],
        // _id:selectedFullfilmentId
      };
    }
    else if (isSameCity(city)==true) {
      const selectedMethodId = ShippingMethods?.methods.filter(item => item.name.toLowerCase() == "same-city");
      selectedFullfilmentId = await encodeFulfillmentGroupOpaqueId(selectedMethodId[0]?._id);
      
       return {...selectedMethodId[0],
        // _id:selectedFullfilmentId
      };

    }
    else {
      const selectedMethodId = ShippingMethods?.methods.filter(item => item.name.toLowerCase() == "other-city");
      selectedFullfilmentId = await encodeFulfillmentGroupOpaqueId(selectedMethodId[0]?._id);
      
      return {...selectedMethodId[0],
        // _id:selectedFullfilmentId
      };
    }


  }
  else {
    throw new ReactionError("", "No Fulfillment methods found, create a fulfillment methode and try again");

  }

}
