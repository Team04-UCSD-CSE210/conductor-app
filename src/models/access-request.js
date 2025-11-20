import { DataTypes } from "sequelize";

export function defineAccessRequestModel(sequelize) {
  return sequelize.define("AccessRequest", {
    email: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    requested_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: "access_requests",
    timestamps: false
  });
}