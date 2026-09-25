import { ZodError } from 'zod';

export function validate(schemas) {
  return (req, res, next) => {
    try {
      for (const [location, schema] of Object.entries(schemas)) {
        if (schema) req[location] = schema.parse(req[location]);
      }
      return next();
    } catch (error) {
      if (!(error instanceof ZodError)) return next(error);
      return res.status(400).json({
        error: 'البيانات المدخلة غير صحيحة',
        code: 'VALIDATION_FAILED',
        details: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
      });
    }
  };
}
