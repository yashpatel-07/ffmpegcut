import { lazy } from "solid-js";
import { Navigate } from "@solidjs/router";

const Home = lazy(() => import("./pages/Home"));
const Template = lazy(() => import("./pages/template"));

export const routes = [
  { path: "/", component: Home },
  { path: "/template", component: Template },
  { path: "*", component: () => <Navigate href="/" /> },
];
