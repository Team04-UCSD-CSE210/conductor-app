// apps/api/start.js
import { buildApp } from "./server.js";

const PORT = process.env.PORT || 3000;
const app = buildApp();
app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});
