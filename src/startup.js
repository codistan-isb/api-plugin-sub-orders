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
    console.log("sellerOrders", sellerOrders)
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
        sellerId: key,
        itemIds: childItem.map(item => item._id),
        referenceId: order.referenceId,
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
 * @method updateChildOrdersStatus
 * @summary Us this methode to update status of subOrders an order is status is changed
 * @param {Object} context - an object containing the per-request state
 * @param {Object} order - Order object emitted by afterOrderUpdate
 * @param {String} itemId - itemId emitted by afterOrderUpdate
 * @param {String} sellerId - sellerId  emitted by afterOrderUpdate
 * @param {String} status - status  emitted by afterOrderUpdate
 * @returns {Promise<Object>} Object with `order` property containing the created order
 */

async function updateChildOrdersStatus(context, order, itemId, sellerId, status) {
  try {
    const { accountId, appEvents, collections, userId } = context;
    const { SubOrders } = collections;
    const SubOrderExist = await SubOrders.findOne({ "parentId": order?._id, itemIds: { $in: [itemId] } })
    if (SubOrderExist != null) {
      let foundItem = false;
      const updatedGroups = SubOrderExist.shipping.map((group) => {
        let itemToAdd;
        const updatedItems = group.items.map((item) => {
          if (item._id !== itemId) return item;
          foundItem = true;


          const updatedItem = {
            ...item,
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
    appEvents.on("afterOrderUpdate", ({ order, itemId, sellerId, status }) => {
      console.log("==================== Updating sub Order Status ==================");

      updateChildOrdersStatus(context, order, itemId, sellerId, status)
    });
  }
  catch (err) {
    console.log(err)
  }
}
