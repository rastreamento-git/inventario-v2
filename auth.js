const {
  createHmac,
  createHash,
  timingSafeEqual,
  randomUUID,
} = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const { fail } = require("./errors");
function equal(a, b) {
  const hash = (v) => createHash("sha256").update(String(v)).digest();
  return timingSafeEqual(hash(a), hash(b));
}
function configureAuth(app, env) {
  const enabled = Boolean(env.APP_PASSWORD);
  if (
    env.NODE_ENV === "production" &&
    (!enabled || env.APP_PASSWORD.length < 12)
  )
    throw new Error(
      "Produção exige APP_PASSWORD com pelo menos 12 caracteres.",
    );
  if (enabled && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32))
    throw new Error("Configure SESSION_SECRET com pelo menos 32 caracteres.");
  const sign = (payload) =>
    createHmac("sha256", env.SESSION_SECRET)
      .update(payload)
      .digest("base64url");
  function valid(req) {
    if (!enabled) return true;
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const parts = token.split(".");
    if (parts.length !== 2 || !equal(parts[1], sign(parts[0]))) return false;
    try {
      const data = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      return Number.isSafeInteger(data.exp) && data.exp > Date.now();
    } catch {
      return false;
    }
  }
  app.get("/api/auth/session", (req, res) =>
    res.json({ enabled, authenticated: valid(req) }),
  );
  app.post(
    "/api/auth/login",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Muitas tentativas. Aguarde 15 minutos." },
    }),
    (req, res) => {
      if (!enabled) return res.json({ enabled: false, token: null });
      if (
        typeof req.body?.password !== "string" ||
        !equal(req.body.password, env.APP_PASSWORD)
      )
        fail(401, "Senha incorreta.");
      const exp = Date.now() + 8 * 60 * 60000;
      const payload = Buffer.from(
        JSON.stringify({ exp, jti: randomUUID() }),
      ).toString("base64url");
      res.json({
        enabled: true,
        token: `${payload}.${sign(payload)}`,
        expiresAt: exp,
      });
    },
  );
  app.use("/api", (req, res, next) => {
    if (!valid(req))
      return res
        .status(401)
        .json({ error: "Entre com a senha de acesso para continuar." });
    next();
  });
}
module.exports = { configureAuth };
