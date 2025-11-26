import { DataTypes, Model } from "sequelize";

export default (sequelize) => {
  class WorkJournalLog extends Model {}

  WorkJournalLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      done_since_yesterday: DataTypes.TEXT,
      working_on_today: DataTypes.TEXT,
      blockers: DataTypes.TEXT,
      feelings: DataTypes.TEXT
    },
    {
      sequelize,
      tableName: "work_journal_logs",
      modelName: "WorkJournalLog"
    }
  );

  return WorkJournalLog;
};