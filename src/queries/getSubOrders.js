import _ from "lodash";
import ReactionError from "@reactioncommerce/reaction-error";

export default async function getAllCategories(context, args) {
    try {
        let { first, offset, searchQuery, sortOrder, sortBy, sellerId, internalOrderId, orderId, startDate, endDate, customerName, workflowStatus } = args;

        const { SubOrders } = context.collections;

        // Default values
        let limit = first || 10;   // how many items to fetch
        let skip = offset || 0;    // from where to start

        // Build the sort object
        let sortDirection = sortOrder === "asc" ? 1 : -1;
        let sortField = sortBy || "createdAt";
        let sort = { [sortField]: sortDirection };

        // Build query if searchQuery is provided
        let query = {};
        if (searchQuery) {
            query = {
                $or: [
                    { "someField": { $regex: searchQuery, $options: "i" } }, // Example search
                    { "anotherField": { $regex: searchQuery, $options: "i" } }
                ]
            };
        }

        if (sellerId) {
            query.sellerId = sellerId;
        }

        if (internalOrderId) {
            query.internalOrderId = internalOrderId;
        }

        if (orderId) {
            query.referenceId = orderId;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        if (customerName) {
            query["shipping.address.fullName"] = { $regex: customerName, $options: "i" };
        }

        // if (status) {
        //     query["workflow.status"] = status;
        // }

        if (workflowStatus) {
            if (workflowStatus.toLowerCase().includes("cancel")) {
                // Skip orders where workflow.status ends with "canceled"
                query["workflow.status"] = { $not: /canceled$/i };
            } else {
                // Match orders where workflow.status ends with the given status
                const statusRegex = new RegExp(`${workflowStatus}$`, "i");
                query["workflow.status"] = statusRegex;
            }
        }

        // Fetch paginated results
        const subOrdersCursor = SubOrders.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit);

        const subOrders = await subOrdersCursor.toArray();

        // Total count for frontend
        const totalSubOrders = await SubOrders.countDocuments(query);

        return {
            nodes: subOrders,
            totalCount: totalSubOrders,
            pageInfo: {
                offset,
                first: limit,
                hasNextPage: offset + limit < totalSubOrders,
                hasPreviousPage: offset > 0
            }
        };
    } catch (error) {
        console.error("Error fetching sub orders:", error);
        throw new Error("Failed to fetch sub orders");
    }
}


// import _ from "lodash";
// import ReactionError from "@reactioncommerce/reaction-error";

// export default async function getAllCategories(context, args) {
//     try {
//         let { itemPerPage, PageNumber, searchQuery, sortOrder, sortBy } = args;

//         const { SubOrders } = context.collections;

//         let itemsPerPage = itemPerPage || 10;
//         PageNumber = PageNumber || 1;
//         let skipAmount = (PageNumber - 1) * itemsPerPage;

//         // Build the sort object
//         let sortDirection = sortOrder === "asc" ? 1 : -1;
//         let sortField = sortBy || "createdAt";
//         let sort = { [sortField]: sortDirection };

//         // You can also build a search filter here if needed (currently empty)
//         let query = {};
//         if (searchQuery) {
//             query = {
//                 $or: [
//                     { "someField": { $regex: searchQuery, $options: "i" } }, // Example search, adjust "someField"
//                     { "anotherField": { $regex: searchQuery, $options: "i" } }
//                 ]
//             };
//         }

//         // Fetch paginated and sorted subOrders
//         const subOrdersCursor = SubOrders.find(query)
//             .sort(sort)
//             .skip(skipAmount)
//             .limit(itemsPerPage);

//         const subOrders = await subOrdersCursor.toArray();

//         // Get total count (for frontend pagination info)
//         const totalSubOrders = await SubOrders.countDocuments(query);

//         return {
//             nodes: subOrders,
//             totalCount: totalSubOrders,
//             pageInfo: {
//                 currentPage: PageNumber,
//                 totalPages: Math.ceil(totalSubOrders / itemsPerPage),
//                 hasNextPage: skipAmount + itemsPerPage < totalSubOrders,
//                 hasPreviousPage: PageNumber > 1
//             }
//         };
//     } catch (error) {
//         console.error("Error fetching sub orders:", error);
//         throw new Error("Failed to fetch sub orders");
//     }
// }


