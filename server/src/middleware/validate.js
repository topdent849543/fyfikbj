import { ZodError } from 'zod';

export function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const [location, schema] of Object.entries(schemas)) {
        if (schema) req[location] = schema.parse(req[location]);
      }
      next();
    } catch (error) {
      if (!(error instanceof ZodError)) return next(error);

      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }
  };
}
