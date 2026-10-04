import { Hono } from "hono";
import { catalogueFor } from "../catalogue";
import type { Env } from "../types";

const catalogue = new Hono<{ Bindings: Env }>();

/** GET /api/v1/catalogue — every game OGS knows, as ogs-protocol manifests. Public. */
catalogue.get("/", (c) => c.json(catalogueFor(c.env)));

export default catalogue;
