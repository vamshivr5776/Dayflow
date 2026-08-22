const http = require('node:http');
const { URL } = require('node:url');

require('./db'); // opens the DB connection and seeds the admin account
const { Router, runHandlers } = require('./utils/router');
const { parseBody, fail } = require('./utils/http');

const router = new Router();

require('./routes/auth').register(router);
require('./routes/profile').register(router);
require('./routes/employees').register(router);
require('./routes/attendance').register(router);
require('./routes/leave').register(router);
require('./routes/payroll').register(router);
require('./routes/dashboard').register(router);

// Simple liveness check.
router.get('/api/health', async (req, res) => {
  const { ok } = require('./utils/http');
  ok(res, { status: 'ok', time: new Date().toISOString() });
});

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  let pathname;
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return fail(res, 400, 'Invalid request URL.');
  }
  req.query = Object.fromEntries(pathname.searchParams.entries());

  try {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.body = await parseBody(req);
    }

    const match = router.match(req.method, pathname.pathname);
    if (!match) {
      return fail(res, 404, `No route for ${req.method} ${pathname.pathname}`);
    }

    req.params = match.params;
    await runHandlers(match.handlers, req, res);

    if (!res.writableEnded) {
      // A handler forgot to respond — fail closed rather than hang the request.
      fail(res, 500, 'Handler did not send a response.');
    }
  } catch (err) {
    const statusCode = err.statusCode || 500;
    if (statusCode === 500) console.error(err);
    fail(res, statusCode, err.message || 'Something went wrong.');
  }
});

const PORT = Number(process.env.PORT || 4000);
server.listen(PORT, () => {
  console.log(`Dayflow API listening on http://localhost:${PORT}`);
});

module.exports = { server };
