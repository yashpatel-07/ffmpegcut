import "./App.css";
import { Router } from "@solidjs/router";
import { routes } from "./routes.tsx";

export default function App() {
  return <Router>{routes}</Router>;
}
