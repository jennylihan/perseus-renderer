import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

// Several Khan Academy packages reference `process.env.NODE_ENV` and a global
// `process` object at runtime. Vite doesn't provide those in the browser, so we
// shim them here.
export default defineConfig({
    plugins: [react()],
    define: {
        "process.env.NODE_ENV": JSON.stringify("development"),
        "process.env": "{}",
        global: "globalThis",
    },
    server: {
        port: 5180,
    },
});
