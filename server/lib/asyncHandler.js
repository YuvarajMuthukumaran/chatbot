// Express 4 doesn't catch a rejected promise from an async route handler: it
// becomes an unhandled rejection, which on Node 15+ exits the process — and
// with it every in-memory chat session. (A doctor search for "(" did exactly
// that, via an invalid regex.) This forwards the error to the error
// middleware in index.js instead.
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
