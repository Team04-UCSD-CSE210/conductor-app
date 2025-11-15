// javascript
import { Op } from "sequelize";
import { isUuid } from "../../utils/validation.js";

// Group API middleware for Class Directory
// - GET /api/class/:offeringId/groups
// - GET /api/class/group/:teamId
// - (compat) GET /api/class/:offeringId/group/:teamId
export function registerGroupApis(app, { authMiddleware: _authMiddleware, models = {} } = {}) {
    console.log("📝 registerGroupApis called, models:", Object.keys(models));
    // Keep endpoints public (no auth)
    const auth = (_req, _res, next) => next();

    const toPositiveInt = (v, fallback) => {
        const n = Number.parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
    };

    // GET /api/class/:offeringId/groups
    app.get("/api/class/:offeringId/groups", auth, async (req, res) => {
        const { offeringId } = req.params;
        const { search, sort = "name", page = 1, limit = 20 } = req.query;

        if (!isUuid(offeringId)) {
            return res.status(404).json({ error: "offering_not_found" });
        }

        const pageNum = toPositiveInt(page, 1);
        const limitNum = toPositiveInt(limit, 20);

        try {
            const { Team, TeamMember, User } = models;
            if (!Team || !TeamMember) {
                return res.status(500).json({ error: "models_not_initialized" });
            }

            const where = { offering_id: offeringId };
            if (search) {
                where.name = { [Op.iLike]: `%${String(search)}%` };
            }

            const offset = (pageNum - 1) * limitNum;
            const order = sort === "number" ? [["team_number", "ASC"]] : [["name", "ASC"]];

            const teams = await Team.findAll({ where, order, limit: limitNum, offset });
            const teamIds = teams.map((t) => t.id);

            let memberCountMap = new Map();
            let leadersByTeam = new Map();
            let userMap = new Map();

            if (teamIds.length > 0) {
                const members = await TeamMember.findAll({
                    where: { team_id: { [Op.in]: teamIds } },
                });

                // count members and collect leaders
                const leaderUserIds = new Set();
                for (const m of members) {
                    memberCountMap.set(m.team_id, (memberCountMap.get(m.team_id) || 0) + 1);
                    if ((m.role || "").toLowerCase() === "leader") {
                        if (!leadersByTeam.has(m.team_id)) leadersByTeam.set(m.team_id, []);
                        leadersByTeam.get(m.team_id).push({ userId: m.user_id });
                        leaderUserIds.add(m.user_id);
                    }
                }

                // optional: hydrate leader names/emails
                if (User && leaderUserIds.size > 0) {
                    const users = await User.findAll({
                        where: { id: { [Op.in]: Array.from(leaderUserIds) } },
                        attributes: ["id", "name", "email"],
                    });
                    for (const u of users) userMap.set(u.id, { name: u.name || null, email: u.email || null });
                }
            }

            const groups = teams.map((t) => {
                const leadersRaw = leadersByTeam.get(t.id) || [];
                const leaders = leadersRaw.map((l) => ({
                    userId: l.userId,
                    name: userMap.get(l.userId)?.name || null,
                }));
                return {
                    teamId: t.id,
                    name: t.name,
                    status: t.status || "active",
                    number: t.team_number ?? null,
                    logo: null,
                    mantra: null,
                    links: { slack: null, githubRepo: null, notion: null },
                    memberCount: memberCountMap.get(t.id) || 0,
                    leaders,
                };
            });

            return res.json({ offeringId, groups });
        } catch (err) {
            console.error("Error in GET /api/class/:offeringId/groups", err);
            return res.status(500).json({ error: "internal_error" });
        }
    });

    // GET /api/class/group/:teamId
    app.get("/api/class/group/:teamId", auth, async (req, res) => {
        const { teamId } = req.params;

        if (!isUuid(teamId)) {
            return res.status(404).json({ error: "team_not_found" });
        }

        try {
            const { Team, TeamMember, User } = models;
            if (!Team || !TeamMember) {
                return res.status(500).json({ error: "models_not_initialized" });
            }

            const team = await Team.findByPk(teamId);
            if (!team) return res.status(404).json({ error: "team_not_found" });

            const members = await TeamMember.findAll({ where: { team_id: teamId } });

            let userMap = new Map();
            if (User && members.length > 0) {
                const userIds = Array.from(new Set(members.map((m) => m.user_id)));
                const users = await User.findAll({
                    where: { id: { [Op.in]: userIds } },
                    attributes: ["id", "name", "preferred_name", "email"],
                });
                for (const u of users) {
                    userMap.set(u.id, {
                        name: u.name || null,
                        preferredName: u.preferred_name || u.name || null,
                        email: u.email || null,
                    });
                }
            }

            const memberDtos = members.map((m) => {
                const prof = userMap.get(m.user_id) || {};
                return {
                    userId: m.user_id,
                    name: prof.name ?? null,
                    preferredName: prof.preferredName ?? prof.name ?? null,
                    pronouns: null,
                    photo: null,
                    email: prof.email ?? null,
                    role: (m.role || "member").toUpperCase(),
                    joinedAt: m.joined_at || null,
                    phone: null,
                };
            });

            return res.json({
                teamId: team.id,
                offeringId: team.offering_id,
                name: team.name,
                number: team.team_number ?? null,
                logo: null,
                mantra: null,
                status: team.status || "active",
                links: { slack: null, githubRepo: null, drive: null },
                members: memberDtos,
            });
        } catch (err) {
            console.error("Error in GET /api/class/group/:teamId", err);
            return res.status(500).json({ error: "internal_error" });
        }
    });

    // Compatibility route with offeringId present
    app.get("/api/class/:offeringId/group/:teamId", auth, async (req, res) => {
        return res.redirect(307, `/api/class/group/${encodeURIComponent(req.params.teamId)}`);
    });
}
