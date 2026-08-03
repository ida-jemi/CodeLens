import { z } from "zod";

/** Validate req.body against a Zod schema and call next() or return 400 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  req.body = result.data;
  next();
};

/** Validate req.params against a Zod schema and call next() or return 400 */
export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: result.error.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }
  // Route params always arrive as strings; overwrite with the coerced,
  // validated values so downstream controllers get a real number.
  req.params = { ...req.params, ...result.data };
  next();
};

export const addReminderSchema = z.object({
  contestId: z.coerce.number().int().positive(),
});

// Same positive-integer contract as addReminderSchema, applied at the
// route boundary for :contestId params instead of a request body. Keeping
// this separate from addReminderSchema (rather than reusing it directly)
// makes the two independently evolvable if param- and body-level rules
// ever need to diverge (e.g. bounds specific to one context).
export const contestIdParamSchema = z.object({
  contestId: z.coerce.number().int().positive(),
});
