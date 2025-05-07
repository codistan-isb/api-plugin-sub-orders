import Random from "@reactioncommerce/random";
import accounting from "accounting-js";
import updateGroupStatusFromItemStatus from "./util/updateGroupStatusFromItemStatus.js"

/**
 * @method createChildOrders
 * @summary Us this methode to create subOrders by seller ID when an order is placed
 * @param {Object} context - an object containing the per-request state
 * @param {Object} order - Order object emitted by afterOrderCreate
 * @returns {Promise<Object>} Object with `order` property containing the created order
 */
async function createChildOrders(context, order) {
  try {

    const { collections } = context;
    const { SubOrders, Cart, Accounts, Shops } = collections;

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
    Object.keys(sellerOrders).map(async (key, i) => {


      const childItem = sellerOrders[key];
      childItem?.map((item, j) => {
        const itemTotal = +accounting.toFixed(item.subtotal, 3);

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
          items: [item],
          itemIds: [item._id],
          totalItemQuantity: 1,
          invoice: childInvoice

        }
        const childFulfillmentGroup = [fulfillmentObj];

        const childOrder = {
          ...order,
          _id: Random.id(),
          sellerId: key,
          itemIds: [item._id],
          referenceId: order.referenceId,
          shipping: childFulfillmentGroup,
          totalItemQuantity: childFulfillmentGroup.reduce((sum, group) => sum + group.totalItemQuantity, 0),
          internalOrderId: order?.internalOrderId + (String.fromCharCode(97 + i)) + String.fromCharCode(97 + j),


        }
        // OrderSchema.validate(childOrder);
        SubOrders.insertOne({ ...childOrder, parentId: order._id });
      })
    })
  }
  catch (err) {
    console.log(err)
  }
}
/**
 * @method updateChildOrdersStatus
 * @summary Us this methode to update status of subOrders an order is status is changed
 * @param {Object} context - an object containing the per-request state
 * @param {Object} order - Order object emitted by afterOrderStatusUpdate
 * @param {String} itemId - itemId emitted by afterOrderStatusUpdate
 * @param {String} sellerId - sellerId  emitted by afterOrderStatusUpdate
 * @param {String} status - status  emitted by afterOrderStatusUpdate
 * @returns {Promise<Object>} Object with `order` property containing the created order
 */

async function updateChildOrdersStatus(context, order, itemId, sellerId, status) {
  try {
    const { appEvents, collections, userId } = context;
    const { SubOrders } = collections;
    const SubOrderExist = await SubOrders.findOne({ "parentId": order?._id, itemIds: { $in: [itemId] } })

    const orderDetails = order.shipping.find(group => group.itemIds.includes(itemId));

    // console.log("orderDetails=====", orderDetails)
    const itemDetails = orderDetails?.items.find(item => item._id === itemId);

    // console.log("itemDetails==========", itemDetails)
    if (SubOrderExist != null) {
      let foundItem = false;
      const updatedGroups = SubOrderExist.shipping.map((group) => {
        let itemToAdd;
        const updatedItems = group.items.map((item) => {
          if (item._id !== itemId) return item;
          foundItem = true;


          const updatedItem = {
            ...item,
            ...(itemDetails.cancelReason !== undefined && { cancelReason: itemDetails.cancelReason }),
            ...(itemDetails.tracking !== undefined && { tracking: itemDetails.tracking }),
            ...(itemDetails.courier_Name !== undefined && { courier_Name: itemDetails.courier_Name }),
            ...(itemDetails.tracking_URL !== undefined && { tracking_URL: itemDetails.tracking_URL }),
            ...(itemDetails.pickupCharge !== undefined && { pickupCharge: itemDetails.pickupCharge }),
            ...(itemDetails.pickupCharge !== undefined && { amountAfterPickupCharge: itemDetails.subtotal - itemDetails.pickupCharge })
          };

          if (item.workflow.status !== status) {
            updatedItem.workflow = {
              status: status,
              workflow: [...item.workflow.workflow, status]
            };
          }
          return updatedItem;
        });

        // If they canceled fewer than the full quantity of the item, add a new
        // non-canceled item to make up the difference.
        if (itemToAdd) {
          updatedItems.push(itemToAdd);
        }

        const updatedGroup = { ...group, items: updatedItems };

        // Ensure proper group status
        updateGroupStatusFromItemStatus(updatedGroup, status);

        // There is a convenience itemIds prop, so update that, too
        // if (itemToAdd) {
        //   updatedGroup.itemIds.push(itemToAdd._id);
        // }

        // Return the group, with items and workflow potentially updated.
        console.log("updatedGroup", updatedGroup.workflow)

        return updatedGroup;
      });
      let updatedOrderWorkflow;

      const allGroupsAreUpdated = updatedGroups.every((group) => group.workflow.status === status);
      if (allGroupsAreUpdated && SubOrderExist.workflow.status !== status) {
        updatedOrderWorkflow = {
          status: status,
          workflow: [...SubOrderExist.workflow.workflow, status]
        };
      }


      // We're now ready to actually update the database and emit events
      const modifier = {
        $set: {
          shipping: updatedGroups,
          updatedAt: new Date()
        }
      };

      if (updatedOrderWorkflow) {
        modifier.$set.workflow = updatedOrderWorkflow;
      }


      const { modifiedCount, value: updatedOrder } = await SubOrders.findOneAndUpdate(
        { "parentId": order?._id, itemIds: { $in: [itemId] } },
        modifier,
        { returnOriginal: false }
      );
      if (modifiedCount === 0 || !updatedOrder) throw new ReactionError("server-error", "Unable to update order");
      await appEvents.emit("afterSubOrderUpdate", {
        subOrder: updatedOrder,
        updatedBy: userId,
        itemId: itemId,
        sellerId: sellerId,
        status: status,
      });
    }
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

      createChildOrders(context, order)
    });
    appEvents.on("afterOrderStatusUpdate", ({ order, itemId, sellerId, status }) => {
      console.log("==================== Updating sub Order Status ==================");

      updateChildOrdersStatus(context, order, itemId, sellerId, status)
    });
  }
  catch (err) {
    console.log(err)
  }
}
