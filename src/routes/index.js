import { Router } from "express";
import journalRoutes from "./journal.js";

const router = Router();

router.use("/journal", journalRoutes);

router.get("/journal-ui", (req, res) => {
  res.sendFile("journal.html", { root: "src/views" });
});

export default router;