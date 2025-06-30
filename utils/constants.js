


const defaultSuperAdminPersmissionsList = [
    {
        name: "Administration",
        access: true,
        menu: [
            {
                name: "Roles & Permissions",
                displayName: "All Roles & Permissions",
                access: true,
                subMenus: {
                    create: { id: 1, access: true, api: "/demo/path" },
                    view: { id: 2, access: true, api: "/demo/path" },
                    update: { id: 3, access: true, api: "/demo/path" },
                    softDelete: { id: 4, access: true, api: "/demo/path" },
                    activeActive: { id: 5, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Staff",
                displayName: "All Staff",
                access: true,
                subMenus: {
                    create: { id: 6, access: true, api: "/demo/path" },
                    view: { id: 7, access: true, api: "/demo/path" },
                    update: { id: 8, access: true, api: "/demo/path" },
                    softDelete: { id: 9, access: true, api: "/demo/path" },
                    activeActive: { id: 10, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Clients",
                displayName: "All Clients",
                access: true,
                subMenus: {
                    create: { id: 66, access: true, api: "/demo/path" },
                    view: { id: 67, access: true, api: "/demo/path" },
                    update: { id: 68, access: true, api: "/demo/path" },
                    softDelete: { id: 69, access: true, api: "/demo/path" },
                    activeActive: { id: 70, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Companies",
                displayName: "All Companies",
                access: true,
                subMenus: {
                    create: { id: 11, access: true, api: "/demo/path" },
                    view: { id: 12, access: true, api: "/demo/path" },
                    update: { id: 13, access: true, api: "/demo/path" },
                    softDelete: { id: 14, access: true, api: "/demo/path" },
                    activeActive: { id: 15, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Organization",
                displayName: "All Organization",
                access: true,
                subMenus: {
                    create: { id: 16, access: true, api: "/demo/path" },
                    view: { id: 17, access: true, api: "/demo/path" },
                    update: { id: 18, access: true, api: "/demo/path" },
                    softDelete: { id: 19, access: true, api: "/demo/path" },
                    activeActive: { id: 20, access: true, api: "/demo/path" },
                }
            },
            {
                name: "User",
                displayName: "All User",
                access: true,
                subMenus: {
                    create: { id: 21, access: true, api: "/demo/path" },
                    view: { id: 22, access: true, api: "/demo/path" },
                    update: { id: 23, access: true, api: "/demo/path" },
                    softDelete: { id: 24, access: true, api: "/demo/path" },
                    activeActive: { id: 25, access: true, api: "/demo/path" },
                }
            },

            {
                name: "Request",
                displayName: "All Request",
                access: true,
                subMenus: {
                    create: { id: 26, access: true, api: "/demo/path" },
                    view: { id: 27, access: true, api: "/demo/path" },
                    update: { id: 28, access: true, api: "/demo/path" },
                    softDelete: { id: 29, access: true, api: "/demo/path" },
                    activeActive: { id: 30, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Subscription",
                displayName: "All Subscription",
                access: true,
                subMenus: {
                    create: { id: 31, access: true, api: "/demo/path" },
                    view: { id: 32, access: true, api: "/demo/path" },
                    update: { id: 33, access: true, api: "/demo/path" },
                    softDelete: { id: 34, access: true, api: "/demo/path" },
                    activeActive: { id: 35, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Topup",
                displayName: "All Topup",
                access: true,
                subMenus: {
                    create: { id: 36, access: true, api: "/demo/path" },
                    view: { id: 37, access: true, api: "/demo/path" },
                    update: { id: 38, access: true, api: "/demo/path" },
                    softDelete: { id: 39, access: true, api: "/demo/path" },
                    activeActive: { id: 40, access: true, api: "/demo/path" },
                }
            },
            {
                name: "Subscribed",
                displayName: "All Subscribed",
                access: true,
                subMenus: {
                    create: { id: 41, access: true, api: "/demo/path" },
                    view: { id: 42, access: true, api: "/demo/path" },
                    update: { id: 43, access: true, api: "/demo/path" },
                    softDelete: { id: 44, access: true, api: "/demo/path" },
                    activeActive: { id: 45, access: true, api: "/demo/path" },
                }
            },
             {
                name: "Leads",
                displayName: "All Leads",
                access: true,
                subMenus: {
                    create: { id: 46, access: true, api: "/demo/path" },
                    view: { id: 47, access: true, api: "/demo/path" },
                    update: { id: 48, access: true, api: "/demo/path" },
                    softDelete: { id: 49, access: true, api: "/demo/path" },
                    activeActive: { id: 50, access: true, api: "/demo/path" },
                }
            }
        ]
    },

];

const defaultAdminPersmissionsList = [
    {
        name: "Administration",
        access: true,
        menu: [
            {
                name: "Organization",
                displayName: "All Organization",
                access: true,
                subMenus: {
                    create: { id: 16, access: true, api: "/demo/path" },
                    view: { id: 17, access: true, api: "/demo/path" },
                    update: { id: 18, access: true, api: "/demo/path" },
                    softDelete: { id: 19, access: true, api: "/demo/path" },
                    activeActive: { id: 20, access: true, api: "/demo/path" },
                }
            },
            {
                name: "User",
                displayName: "All User",
                access: true,
                subMenus: {
                    create: { id: 21, access: true, api: "/demo/path" },
                    view: { id: 22, access: true, api: "/demo/path" },
                    update: { id: 23, access: true, api: "/demo/path" },
                    softDelete: { id: 24, access: true, api: "/demo/path" },
                    activeActive: { id: 25, access: true, api: "/demo/path" },
                }
            },
        ]
    },
];

const defaultUserPersmissionsList = [
    {
        name: "Administration",
        access: true,
        menu: [
            {
                name: "Organization",
                displayName: "All Organization",
                access: true,
                subMenus: {
                    create: { id: 16, access: true, api: "/demo/path" },
                    view: { id: 17, access: true, api: "/demo/path" },
                    update: { id: 18, access: true, api: "/demo/path" },
                    softDelete: { id: 19, access: true, api: "/demo/path" },
                    activeActive: { id: 20, access: true, api: "/demo/path" },
                }
            },
            {
                name: "User",
                displayName: "All User",
                access: true,
                subMenus: {
                    create: { id: 21, access: true, api: "/demo/path" },
                    view: { id: 22, access: true, api: "/demo/path" },
                    update: { id: 23, access: true, api: "/demo/path" },
                    softDelete: { id: 24, access: true, api: "/demo/path" },
                    activeActive: { id: 25, access: true, api: "/demo/path" },
                }
            },
        ]
    },
];

const defaultSuperAdminStaffPersmissionsList = [
    {
        name: "Administration",
        access: false,
        menu: [
            {
                name: "Roles & Permissions",
                displayName: "All Roles & Permissions",
                access: false,
                subMenus: {
                    create: { id: 1, access: false, api: "/demo/path" },
                    view: { id: 2, access: false, api: "/demo/path" },
                    update: { id: 3, access: false, api: "/demo/path" },
                    softDelete: { id: 4, access: false, api: "/demo/path" },
                    activeActive: { id: 5, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Staff",
                displayName: "All Staff",
                access: false,
                subMenus: {
                    create: { id: 6, access: false, api: "/demo/path" },
                    view: { id: 7, access: false, api: "/demo/path" },
                    update: { id: 8, access: false, api: "/demo/path" },
                    softDelete: { id: 9, access: false, api: "/demo/path" },
                    activeActive: { id: 10, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Clients",
                displayName: "All Clients",
                access: false,
                subMenus: {
                    create: { id: 66, access: false, api: "/demo/path" },
                    view: { id: 67, access: false, api: "/demo/path" },
                    update: { id: 68, access: false, api: "/demo/path" },
                    softDelete: { id: 69, access: false, api: "/demo/path" },
                    activeActive: { id: 70, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Companies",
                displayName: "All Companies",
                access: false,
                subMenus: {
                    create: { id: 11, access: false, api: "/demo/path" },
                    view: { id: 12, access: false, api: "/demo/path" },
                    update: { id: 13, access: false, api: "/demo/path" },
                    softDelete: { id: 14, access: false, api: "/demo/path" },
                    activeActive: { id: 15, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Organization",
                displayName: "All Organization",
                access: false,
                subMenus: {
                    create: { id: 16, access: false, api: "/demo/path" },
                    view: { id: 17, access: false, api: "/demo/path" },
                    update: { id: 18, access: false, api: "/demo/path" },
                    softDelete: { id: 19, access: false, api: "/demo/path" },
                    activeActive: { id: 20, access: false, api: "/demo/path" },
                }
            },
            {
                name: "User",
                displayName: "All User",
                access: false,
                subMenus: {
                    create: { id: 21, access: false, api: "/demo/path" },
                    view: { id: 22, access: false, api: "/demo/path" },
                    update: { id: 23, access: false, api: "/demo/path" },
                    softDelete: { id: 24, access: false, api: "/demo/path" },
                    activeActive: { id: 25, access: false, api: "/demo/path" },
                }
            },

            {
                name: "Request",
                displayName: "All Request",
                access: false,
                subMenus: {
                    create: { id: 26, access: false, api: "/demo/path" },
                    view: { id: 27, access: false, api: "/demo/path" },
                    update: { id: 28, access: false, api: "/demo/path" },
                    softDelete: { id: 29, access: false, api: "/demo/path" },
                    activeActive: { id: 30, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Subscription",
                displayName: "All Subscription",
                access: false,
                subMenus: {
                    create: { id: 31, access: false, api: "/demo/path" },
                    view: { id: 32, access: false, api: "/demo/path" },
                    update: { id: 33, access: false, api: "/demo/path" },
                    softDelete: { id: 34, access: false, api: "/demo/path" },
                    activeActive: { id: 35, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Topup",
                displayName: "All Topup",
                access: false,
                subMenus: {
                    create: { id: 36, access: false, api: "/demo/path" },
                    view: { id: 37, access: false, api: "/demo/path" },
                    update: { id: 38, access: false, api: "/demo/path" },
                    softDelete: { id: 39, access: false, api: "/demo/path" },
                    activeActive: { id: 40, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Subscribed",
                displayName: "All Subscribed",
                access: false,
                subMenus: {
                    create: { id: 41, access: false, api: "/demo/path" },
                    view: { id: 42, access: false, api: "/demo/path" },
                    update: { id: 43, access: false, api: "/demo/path" },
                    softDelete: { id: 44, access: false, api: "/demo/path" },
                    activeActive: { id: 45, access: false, api: "/demo/path" },
                }
            },
            {
                name: "Leads",
                displayName: "All Leads",
                access: false,
                subMenus: {
                    create: { id: 46, access: false, api: "/demo/path" },
                    view: { id: 47, access: false, api: "/demo/path" },
                    update: { id: 48, access: false, api: "/demo/path" },
                    softDelete: { id: 49, access: false, api: "/demo/path" },
                    activeActive: { id: 50, access: false, api: "/demo/path" },
                }
            }
        ]
    },

];


// Base role
const roles = [
    { id: 1, name: 'super admin', capability: defaultSuperAdminPersmissionsList },
    { id: 2, name: 'admin', capability: defaultAdminPersmissionsList },
    { id: 3, name: 'user', capability: defaultUserPersmissionsList },
    { id: 4, name: 'staff', capability: defaultSuperAdminStaffPersmissionsList },
];


const serialNumber = [
    { collectionName: "client", prefix: "CL" },
    { collectionName: "company", prefix: "CO" },
    { collectionName: "SubscriptionPlan", prefix: "SP" },
    { collectionName: "topup", prefix: "TU" },
    { collectionName: "subscribedUser", prefix: "SU" },
    { collectionName: "organization", prefix: "ORG" },
    { collectionName: "session", prefix: "SE" },
    { collectionName: "form", prefix: "FM" },
    { collectionName: "user", prefix: "UR" },
    { collectionName: "superAdminStaff", prefix: "SAS" },
    { collectionName: "fileSerialNumber", prefix: "FSN" },
]


exports.roles = roles;
exports.serialNumber = serialNumber;
exports.defaultSuperAdminPersmissionsList = defaultSuperAdminPersmissionsList;
exports.defaultAdminPersmissionsList = defaultAdminPersmissionsList;
exports.defaultUserPersmissionsList = defaultUserPersmissionsList;
exports.defaultSuperAdminStaffPersmissionsList = defaultSuperAdminStaffPersmissionsList;


