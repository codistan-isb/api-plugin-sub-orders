
export default async function getOrderCounts(parent, args, context, info) {
    // console.log("Collections available:", Object.keys(context.collections));
    //     console.log("HIT THE QUERY");
    if (!context.queries.getOrderCounts) {
        throw new Error("getOrderCounts function is not defined in queries.");
    }

    let getCategories = await context.queries.getOrderCounts(context, args);
    return getCategories;
}
