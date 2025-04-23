export default async function getSubOrders(parent, args, context, info) {

    console.log("getSubOrders args:", args);
    console.log("HIT THE QUERY");
    if (!context.queries.getSubOrders) {
        throw new Error("GetAllCategories function is not defined in queries.");
    }
    let getSubOrders = await context.queries.getSubOrders(context, args);
    return getSubOrders;
}
