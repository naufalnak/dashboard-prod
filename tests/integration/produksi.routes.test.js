const request = require("supertest");
const app = require("../../src/app");
const { signToken } = require("../../src/lib/auth");

describe("Produksi Routes", () => {
  const token = signToken({
    id: 1,
    username: "admin",
    role: "admin",
  });

  describe("GET /api/produksi-harian", () => {
    it("returns paginated JSON", async () => {
      const res = await request(app)
        .get("/api/produksi-harian")
        .query({ period: "today" });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);

      expect(res.body).toHaveProperty("rows");
      expect(res.body).toHaveProperty("total");
      expect(Array.isArray(res.body.rows)).toBe(true);
    });
  });

  describe("GET /api/produksi-harian-summary", () => {
    it("requires authentication", async () => {
      const res = await request(app)
        .get("/api/produksi-harian-summary")
        .query({ period: "today" });

      expect(res.status).toBe(401);
    });

    it("returns summary when authenticated", async () => {
      const res = await request(app)
        .get("/api/produksi-harian-summary")
        .set("Authorization", `Bearer ${token}`)
        .query({ period: "today" });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);
    });
  });
});