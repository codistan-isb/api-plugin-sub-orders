const status = "coreOrderWorkflow/canceled";
const itemstatus = "coreOrderItemWorkflow/canceled";

/**
 * @summary Given a fulfillment group, determines and set the correct
 *   current status on it based on the status of all the items in the
 *   group. Mutates the group object if necessary
 * @param {Object} group An order fulfillment group
 * @returns {undefined}
 */
export default function updateGroupStatusFromItemStatus(group,status) {
  // If all items are canceled, set the group status to canceled
  const allItemsAreCanceled = group.items.every((item) => item.workflow.status === status);
  if (allItemsAreCanceled && group.workflow.status !== status) {
    group.workflow = {
      status: status,
      workflow: [...group.workflow.workflow, status]
    };
  }
}
