import ReactionError from "@reactioncommerce/reaction-error";
export default async function getOrderCounts(context, args) {

    const { collections, accountId } = context;
    const { SubOrders, Catalog, Payments } = collections;

    if (!accountId) {
        throw new ReactionError("unauthorized", "You do not have permission to fetch this data.");
    }
    const cancelledStatuses = [
        "Cancelled",
        "cancelled",
        "Out_Of_Stock",
        "Quality_Issue",
        "Returned_To_Seller",
        "Restocked",
        "Refunded",
        "Return_Received"
    ];

    const completedStatuses = [
        "Delivered",
        "Payment_Released",
        "Customer_Feedback_Done",
        "Completed",
        "completed",
    ];

    const inProgressStatuses = [
        "New",
        "new",
        "Confirmed",
        "Pickup_Generated",
        "Arrived_At_Office",
        "Office_Stock",
        "Dispatched",
        "Return_In_Process",
        "Dispatched_On_MP",
        "Dispatched_On_TCS",
        "Dispatched_On_Leopard",
        "Dispatched_On_Daewoo",
        "Dispatched_On_Postex",
        "Dispatched_On_Trax",
        "Dispatched_On_Penta",
        "Booked_On_Penta",
        "On_Hold",
        "Customer_Not_Responding",
        "Seller_Not_Responding",
        "Refund_In_Process",
        "Quality_Check_In_Progress",
        "Quality_Approved"
    ];


    const totalCount = await SubOrders.countDocuments();
    const cancelledCount = await SubOrders.countDocuments({
        "workflow.status": { $in: cancelledStatuses }
    });
    const completedCount = await SubOrders.countDocuments({
        "workflow.status": { $in: completedStatuses }
    });
    const inProgressCount = await SubOrders.countDocuments({
        "workflow.status": { $in: inProgressStatuses }
    }); const result = await SubOrders.aggregate([
        {
            $unwind: "$shipping"
        },
        {
            $facet: {
                totalBuyers: [
                    {
                        $group: {
                            _id: {
                                $trim: {
                                    input: {
                                        $cond: [
                                            {
                                                $isArray: "$shipping.address.fullName"
                                            },
                                            {
                                                $arrayElemAt: ["$shipping.address.fullName", 0]
                                            },
                                            "$shipping.address.fullName"
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        $count: "totalBuyers"
                    }
                ],
                totalSellers: [
                    {
                        $unwind: "$shipping.items"
                    },
                    {
                        $group: {
                            _id: {
                                $trim: {
                                    input: {
                                        $cond: [
                                            {
                                                $isArray: "$shipping.items.sellerId"
                                            },
                                            {
                                                $arrayElemAt: ["$shipping.items.sellerId", 0]
                                            },
                                            "$shipping.items.sellerId"
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        $count: "totalSellers"
                    }
                ]
            }
        }
    ]).toArray();

    const buyersCount = result[0].totalBuyers.length > 0 ? result[0].totalBuyers[0].totalBuyers : 0;
    const sellerCount = result[0].totalSellers.length > 0 ? result[0].totalSellers[0].totalSellers : 0;
    const totalProductsCount = await Catalog.countDocuments();
    const totalSoldProductCount = await Catalog.countDocuments({ "product.isSoldOut": true });
    const inStockProductsCount = await Catalog.countDocuments({ "product.isSoldOut": false });
    const totalRevenueCount = await Payments.aggregate([
        {
            $group: {
                _id: null,
                totalSum: { $sum: "$totalPrice" },
                totalPickupCharges: { $sum: "$fee" },
                totalComission: { $sum: "$commissionCharges" }
            }
        }
    ]).toArray();

    const totalSum = totalRevenueCount.length > 0 ? totalRevenueCount[0].totalSum : 0;
    const totalPickupCharges = totalRevenueCount.length > 0 ? totalRevenueCount[0].totalPickupCharges : 0;
    const totalComission = totalRevenueCount.length > 0 ? totalRevenueCount[0].totalComission : 0;


    return {
        totalChildOrders: totalCount,
        cancelledChildOrders: cancelledCount,
        completedChildOrders: completedCount,
        inProgressChildOrders: inProgressCount,
        totalBuyers: buyersCount,
        totalSellers: sellerCount,
        totalProducts: totalProductsCount,
        soldProducts: totalSoldProductCount,
        inStockProducts: inStockProductsCount,
        totalRevenue: totalSum,
        totalPickupCharges: totalPickupCharges,
        totalComission: totalComission
    }

}