import Random from "@reactioncommerce/random";
import accounting from "accounting-js";



async function createChildOrders(context, order) {
  try {
    const { collections } = context;
    const { SubOrders, Cart } = collections;
    const parentFulfillmentGroup = order?.shipping?.[0]

    const orderItems = order?.shipping?.[0]?.items;
    let sellerOrders = {};
    orderItems?.map(order => {

      if (sellerOrders[order.sellerId]) {

        let sellerOrder = sellerOrders[order.sellerId];
        sellerOrder.push(order)
        sellerOrders[order.sellerId] = sellerOrder
      } else {
        let sellerOrder = [order];
        sellerOrders[order.sellerId] = sellerOrder
      }
    })
    console.log("sellerOrders",sellerOrders)
    Object.keys(sellerOrders).map(async (key) => {


      const childItem = sellerOrders[key];
      const itemTotal = +accounting.toFixed(childItem.reduce((sum, item) => (sum + item.subtotal), 0), 3);

      // Fulfillment
      const shippingTotal = parentFulfillmentGroup.shipmentMethod.rate || 0;
      const handlingTotal = parentFulfillmentGroup.shipmentMethod.handling || 0;
      const fulfillmentTotal = shippingTotal + handlingTotal;

      // Totals
      // To avoid rounding errors, be sure to keep this calculation the same between here and
      // `buildOrderInputFromCart.js` in the client code.
      const total = +accounting.toFixed(Math.max(0, itemTotal + fulfillmentTotal), 3);

      const childInvoice = { ...parentFulfillmentGroup.invoice, subtotal: itemTotal, total }
      let fulfillmentObj = {
        ...parentFulfillmentGroup,
        _id: Random.id(),
        items: childItem,
        itemIds: childItem.map(item => item._id),
        totalItemQuantity: childItem.reduce((sum, item) => sum + item.quantity, 0),
        invoice: childInvoice

      }
      const childFulfillmentGroup = [fulfillmentObj]
      const childOrder = {
        ...order,
        _id: Random.id(),
        referenceId: Random.id(),
        shipping: childFulfillmentGroup,
        totalItemQuantity: childFulfillmentGroup.reduce((sum, group) => sum + group.totalItemQuantity, 0),

      }
      // OrderSchema.validate(childOrder);
      SubOrders.insertOne({ ...childOrder, parentId: order._id });

    })
  }
  catch (err) {
    console.log(err)
  }
}

/**
 * @summary Called on startup
 * @param {Object} context Startup context
 * @param {Object} context.collections Map of MongoDB collections
 * @returns {undefined}
 */
export default function ordersStartup(context) {
  try {
    const { appEvents } = context;

    appEvents.on("afterOrderCreate", ({ order }) => {
      console.log("====================Creating sub Order ==================");

      const orderItems = order?.shipping[0]?.items;
      createChildOrders(context, order)
    });
  }
  catch (err) {
    console.log(err)
  }
}
