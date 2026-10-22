import { LiveActivityRegistrationSchema } from "@open-game-system/ogs-protocol";
import { Hono } from "hono";
import { apiError, invalidBody, parseBody } from "../lib/http";
import { forgetActivity, liveActivitiesOn, registerActivity } from "../lib/live-activities";
import { getSession, mayEnter } from "../lib/sessions";
import { anyToken, type ProfileEnv } from "../middleware/profile-auth";

/**
 * A phone's controller Live Activity push token, under the couch session it follows (mounted at
 * /api/v1/sessions). Behind LIVE_ACTIVITIES = "on": otherwise 404 feature_disabled. Only the
 * session's host, a member, or its launcher may register.
 */
const liveActivities = new Hono<ProfileEnv>();

liveActivities.use("/:sid/live-activities", anyToken);
liveActivities.use("/:sid/live-activities/*", anyToken);
liveActivities.use("/:sid/live-activities", async (c, next) => {
  if (!liveActivitiesOn(c.env))
    return apiError(c, 404, "feature_disabled", "Live Activities are not on");
  await next();
});
liveActivities.use("/:sid/live-activities/*", async (c, next) => {
  if (!liveActivitiesOn(c.env))
    return apiError(c, 404, "feature_disabled", "Live Activities are not on");
  await next();
});

/** POST /sessions/:sid/live-activities { activityId, pushToken, app, environment } → 201. */
liveActivities.post("/:sid/live-activities", async (c) => {
  const body = await parseBody(c, LiveActivityRegistrationSchema);
  if (!body)
    return invalidBody(
      c,
      "activityId, pushToken (hex), app and environment (sandbox|production) are required",
    );
  const db = c.env.DB;
  const row = await getSession(db, c.req.param("sid"));
  if (!row) return apiError(c, 404, "session_not_found", "Session not found");
  const claims = c.get("claims");
  if (!(await mayEnter(db, claims, row)))
    return apiError(c, 403, "not_a_member", "Join this TV with its code first");
  await registerActivity(db, row.id, claims.sub, body, Date.now());
  return c.json({ activityId: body.activityId }, 201);
});

/** DELETE /sessions/:sid/live-activities/:activityId — the phone ended or lost it. */
liveActivities.delete("/:sid/live-activities/:activityId", async (c) => {
  const gone = await forgetActivity(
    c.env.DB,
    c.req.param("sid"),
    c.get("claims").sub,
    c.req.param("activityId"),
  );
  if (!gone) return apiError(c, 404, "activity_not_found", "No such Live Activity");
  return c.body(null, 204);
});

export default liveActivities;
