import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
import { login, refreshSession, logout, issueTokens } from "../services/authService.js";
import { createUser, findUserById, userToSession } from "../services/userService.js";
import { validatePassword, validateEmailStrict } from "../utils/sanitize.js";
import { authenticate } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();

function setAuthCookies(res, accessToken, refreshRaw) {
  const cookieOpts = {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "strict",
    path: "/",
  };
  res.cookie("sac_access", accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  res.cookie("sac_refresh", refreshRaw, {
    ...cookieOpts,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie("sac_access", { path: "/" });
  res.clearCookie("sac_refresh", { path: "/" });
}

const ERROR_MAP = {
  INVALID_CREDENTIALS: { status: 401, message: "Identifiant ou mot de passe incorrect" },
  ROLE_MISMATCH: { status: 403, message: "Rôle incorrect pour ce compte" },
  ACCOUNT_LOCKED: {
    status: 423,
    message: "Compte temporairement verrouillé. Réessayez dans 15 minutes.",
  },
  EMAIL_EXISTS: { status: 409, message: "Cet e-mail est déjà inscrit" },
  PHONE_EXISTS: {
    status: 409,
    message: "Ce numéro de téléphone est déjà lié à un compte",
  },
  IDENTITY_CONFLICT: {
    status: 409,
    message: "Cette identité est déjà enregistrée. Une seule inscription par personne",
  },
  MULTI_ROLE: {
    status: 403,
    message: "Un seul rôle par personne (pas de double compte étudiant / professeur / assistant)",
  },
  INVALID_PHONE: {
    status: 400,
    message: "Numéro de téléphone mobile congolais invalide (ex. 085 184 8859)",
  },
  UNIVERSITY_MISMATCH: {
    status: 403,
    message: "Université incorrecte : utilisez celle choisie à l'inscription",
  },
  CODE_UNI_MISMATCH: {
    status: 403,
    message: "Code établissement incorrect",
  },
  INVALID_PROFILE: { status: 400, message: "Profil invalide ou informations non fiables" },
  INVALID_REFRESH: { status: 401, message: "Session expirée, reconnectez-vous" },
};

function mapError(err, res) {
  const mapped = ERROR_MAP[err.message];
  if (mapped) {
    return res.status(mapped.status).json({ error: err.message, message: mapped.message });
  }
  throw err;
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { identifier, password, role, universite, codeUni } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }
    try {
      const result = await login(String(identifier).trim(), password, role || null, {
        universite: universite || null,
        codeUni: codeUni || null,
      });
      setAuthCookies(res, result.accessToken, result.refreshRaw);
      res.json({ ok: true, session: result.session });
    } catch (e) {
      mapError(e, res);
    }
  })
);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const email = validateEmailStrict(body.email);
    if (!email || !validatePassword(body.password)) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message:
          "E-mail réel requis et mot de passe (8+ caractères, lettre + chiffre, sans espace)",
      });
    }
    if (!body.telephone) {
      return res.status(400).json({
        error: "INVALID_PHONE",
        message: "Numéro de téléphone mobile requis",
      });
    }
    try {
      const user = await createUser({ ...body, email, password: body.password });
      const tokens = issueTokens(user);
      setAuthCookies(res, tokens.accessToken, tokens.refreshRaw);
      res.status(201).json({ ok: true, session: tokens.session });
    } catch (e) {
      mapError(e, res);
    }
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    try {
      const result = refreshSession(req.cookies?.sac_refresh);
      setAuthCookies(res, result.accessToken, result.refreshRaw);
      res.json({ ok: true, session: result.session });
    } catch (e) {
      clearAuthCookies(res);
      mapError(e, res);
    }
  })
);

router.post("/logout", (req, res) => {
  logout(req.cookies?.sac_refresh);
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = findUserById(req.user.id);
    res.json({
      session: userToSession(user),
    });
  })
);

export default router;
