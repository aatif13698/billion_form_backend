


// Base role
const roles = [
    { id: 1, name: 'super admin' },
    { id: 2, name: 'admin' },
    { id: 3, name: 'user' },
];



const serialNumber = [
    { collectionName : "client", prefix: "CL"},
    { collectionName : "company", prefix: "CO"},
    { collectionName : "SubscriptionPlan", prefix: "SP"},
    { collectionName : "topup", prefix: "TU"},
    { collectionName : "subscribedUser", prefix: "SU"},
]




exports.roles = roles;
exports.serialNumber = serialNumber;
