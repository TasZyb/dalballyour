import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [index("routes/home.tsx"),
    route("admin_taras", "routes/admin-predictions.tsx"),
    route("predict", "routes/predict.tsx")
] satisfies RouteConfig;
