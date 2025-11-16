import journalRoutes from "./journal.js";

router.use("/journal", journalRoutes);

router.get("/journal-ui", (req, res) => {
  res.sendFile("journal.html", { root: "src/views" });
});