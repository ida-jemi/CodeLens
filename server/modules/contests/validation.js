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

export const addReminderSchema = z.object({
  contestId: z.coerce.number().int().positive(),
});
