const HttpError = require('../utils/HttpError');

// tiny validator: rules = { field: { required, type:'string|number|email|date|enum', min, max, values } }
module.exports = (rules) => (req, res, next) => {
  const errors = [];
  for (const [field, r] of Object.entries(rules)) {
    const v = req.body[field];
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (r.required) errors.push(`${field} is required`);
      continue;
    }
    if (r.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) errors.push(`${field} must be a valid email`);
    if (r.type === 'date' && isNaN(new Date(v).getTime())) errors.push(`${field} must be a valid date`);
    if (r.type === 'number' && isNaN(Number(v))) errors.push(`${field} must be a number`);
    if (r.type === 'enum' && !r.values.includes(v)) errors.push(`${field} must be one of ${r.values.join(', ')}`);
    if (r.min !== undefined && String(v).length < r.min && r.type !== 'number') errors.push(`${field} must be at least ${r.min} characters`);
    if (r.max !== undefined && String(v).length > r.max && r.type !== 'number') errors.push(`${field} must be at most ${r.max} characters`);
  }
  if (errors.length) return next(new HttpError(400, errors.join('; ')));
  next();
};
