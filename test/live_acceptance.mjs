// Live Backend Acceptance Test Suite for Requirement 3
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'; // Tested via Vite dev proxy

function getTestCredentials() {
  let email = process.env.TEST_ADMIN_EMAIL;
  let password = process.env.TEST_ADMIN_PASSWORD;

  if (!email || !password) {
    const envLocalPath = path.resolve('.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf8');
      const emailMatch = content.match(/TEST_ADMIN_EMAIL=(.+)/);
      const passMatch = content.match(/TEST_ADMIN_PASSWORD=(.+)/);
      if (emailMatch) email = emailMatch[1].trim();
      if (passMatch) password = passMatch[1].trim();
    }
  }

  if (!email || !password) {
    throw new Error('Test admin credentials not found in environment (TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD) or .env.local');
  }

  return { email, password };
}

async function runLiveAcceptance() {
  console.log('=== RUNNING LIVE BACKEND ACCEPTANCE VIA VITE PROXY ===');
  const credentials = getTestCredentials();
  let sessionCookie = '';

  async function callApi(apiPath, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${BASE_URL}${apiPath}`, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/JSESSIONID=[^;]+/);
      if (match) {
        sessionCookie = match[0];
      }
    }

    let data = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => '');
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
    };
  }

  const results = [];

  // 1. POST /api/auth/login -> 200
  const loginRes = await callApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: credentials.email, password: credentials.password })
  });
  results.push({
    method: 'POST',
    path: '/api/auth/login',
    status: loginRes.status,
    count: loginRes.ok ? 1 : 0,
    note: loginRes.ok ? 'OK (Session created)' : 'Failed'
  });

  // 2. GET /api/auth/me -> 200, role Admin và authorities thật
  const meRes = await callApi('/api/auth/me');
  const authCount = Array.isArray(meRes.data?.authorities) ? meRes.data.authorities.length : 0;
  results.push({
    method: 'GET',
    path: '/api/auth/me',
    status: meRes.status,
    count: authCount,
    note: `Role: ${meRes.data?.role}, Authorities count: ${authCount}`
  });

  // 3. GET /api/users -> 200
  const usersRes = await callApi('/api/users');
  const usersCount = Array.isArray(usersRes.data) ? usersRes.data.length : (usersRes.data?.content?.length ?? 0);
  results.push({
    method: 'GET',
    path: '/api/users',
    status: usersRes.status,
    count: usersCount,
    note: `Returned ${usersCount} users`
  });

  // 4. GET /api/roles -> 200
  const rolesRes = await callApi('/api/roles');
  const rolesCount = Array.isArray(rolesRes.data) ? rolesRes.data.length : 0;
  results.push({
    method: 'GET',
    path: '/api/roles',
    status: rolesRes.status,
    count: rolesCount,
    note: `Returned ${rolesCount} roles`
  });

  // 5. GET /api/permissions -> 200
  const permRes = await callApi('/api/permissions');
  const permCount = Array.isArray(permRes.data) ? permRes.data.length : 0;
  results.push({
    method: 'GET',
    path: '/api/permissions',
    status: permRes.status,
    count: permCount,
    note: `Returned ${permCount} permissions`
  });

  // 6. GET /api/audit-logs -> 200
  const auditRes = await callApi('/api/audit-logs');
  const auditCount = Array.isArray(auditRes.data) ? auditRes.data.length : (auditRes.data?.content?.length ?? 0);
  results.push({
    method: 'GET',
    path: '/api/audit-logs',
    status: auditRes.status,
    count: auditCount,
    note: `Returned ${auditCount} audit logs`
  });

  // 7. POST /api/auth/logout -> 204
  const logoutRes = await callApi('/api/auth/logout', { method: 'POST' });
  results.push({
    method: 'POST',
    path: '/api/auth/logout',
    status: logoutRes.status,
    count: 0,
    note: logoutRes.status === 204 ? 'No Content (204)' : `Status: ${logoutRes.status}`
  });

  // 8. GET /api/auth/me sau logout -> 401
  const meAfterLogout = await callApi('/api/auth/me');
  results.push({
    method: 'GET',
    path: '/api/auth/me',
    status: meAfterLogout.status,
    count: 0,
    note: meAfterLogout.status === 401 ? 'Unauthorized (401)' : `Unexpected: ${meAfterLogout.status}`
  });

  console.log('\n=== LIVE BACKEND ACCEPTANCE RESULTS ===');
  console.table(results);

  // Validate all assertions
  const failures = [];
  if (loginRes.status !== 200) failures.push(`POST /api/auth/login expected 200, got ${loginRes.status}`);
  if (meRes.status !== 200 || meRes.data?.role !== 'Admin') failures.push(`GET /api/auth/me expected 200 with role Admin, got ${meRes.status} with role ${meRes.data?.role}`);
  if (usersRes.status !== 200) failures.push(`GET /api/users expected 200, got ${usersRes.status}`);
  if (rolesRes.status !== 200) failures.push(`GET /api/roles expected 200, got ${rolesRes.status}`);
  if (permRes.status !== 200) failures.push(`GET /api/permissions expected 200, got ${permRes.status}`);
  if (auditRes.status !== 200) failures.push(`GET /api/audit-logs expected 200, got ${auditRes.status}`);
  if (logoutRes.status !== 204 && logoutRes.status !== 200) failures.push(`POST /api/auth/logout expected 204 or 200, got ${logoutRes.status}`);
  if (meAfterLogout.status !== 401) failures.push(`GET /api/auth/me after logout expected 401, got ${meAfterLogout.status}`);

  if (failures.length === 0) {
    console.log('\n>>> ALL LIVE BACKEND ACCEPTANCE ASSERTIONS PASSED (100%)! <<<');
  } else {
    console.error('\n>>> FAILURES ENCOUNTERED:', failures);
    process.exit(1);
  }
}

runLiveAcceptance().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
