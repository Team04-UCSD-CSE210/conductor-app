import { DataTypes } from "sequelize";

export default (sequelize) => {
  return sequelize.define("TempUser", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    tableName: "temp_users",
    timestamps: true
  });
};