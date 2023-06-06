import resolveShopFromShopId from "@reactioncommerce/api-utils/graphql/resolveShopFromShopId.js";
import { encodeOrderItemOpaqueId } from "../../xforms/id.js";
import productTags from "./productTags.js";
import uploadedBy from "./uploadedBy.js";

export default {
  _id: (node) => encodeOrderItemOpaqueId(node._id),
  productTags,
  uploadedBy,
  shop: resolveShopFromShopId,
  status: (node) => node.workflow.status
};
