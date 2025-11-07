#!/usr/bin/env node
import dotenv from "dotenv";
import { Op } from "sequelize";
import { createSequelize } from "../src/config/database.js";
import { defineAuthLogModel } from "../src/models/auth-log.js";

dotenv.config();

const daysConfig = process.env.AUTH_LOG_RETENTION_DAYS || "90";
const retentionDays = Number.parseInt(daysConfig, 10);

if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
  console.error("AUTH_LOG_RETENTION_DAYS must be a positive integer.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL must be set to prune auth logs.");
  process.exit(1);
}

const sequelize = createSequelize({
  databaseUrl,
  sslMode: process.env.PGSSLMODE
});

const AuthLog = defineAuthLogModel(sequelize);

const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

const run = async () => {
  try {
    await sequelize.authenticate();
    const deleted = await AuthLog.destroy({
      where: {
        createdAt: {
          [Op.lt]: cutoff
        }
      }
    });
    console.log(`Pruned ${deleted} auth log entries older than ${retentionDays} day(s).`);
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error("Failed to prune auth logs", error);
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error("Failed to close database connection", closeError);
    }
    process.exit(1);
  }
};

run();
