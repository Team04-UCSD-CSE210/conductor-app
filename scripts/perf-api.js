// ESM (your project has "type": "module")
import autocannon from 'autocannon';

const base = process.env.BASE_URL || 'http://localhost:3000';
const usersPath = process.env.USERS_PATH || '/users';

function run(label, opts) {
  return new Promise((resolve, reject) => {
    console.log(`\n== ${label} ==`);
    const inst = autocannon(opts, (err, res) => {
      if (err) return reject(err);
      console.log(`${label} summary:`, {
        duration: `${res.duration} ms`,
        requests_per_sec: res.requests?.average,
        latency_p50_ms: res.latency?.p50,
        latency_p99_ms: res.latency?.p99,
        non2xx: res.non2xx,
        errors: res.errors,
      });
      resolve();
    });
    autocannon.track(inst, { renderProgressBar: true });
  });
}

try {
  const r = await fetch(`${base}${usersPath}?limit=1&offset=0`);
  console.log(`Probe GET ${usersPath} -> ${r.status}`);
} catch (e) {
  console.error(`Probe failed: ${e.message}`);
}

try {
  await run(`GET ${usersPath} (warm-up)`, {
    url: `${base}${usersPath}?limit=50&offset=0`,
    connections: 20,
    duration: 5,
    method: 'GET',
  });

  await run(`GET ${usersPath} (sustained)`, {
    url: `${base}${usersPath}?limit=50&offset=0`,
    connections: 50,
    duration: 15,
    method: 'GET',
  });

  await run(`POST ${usersPath} (create)`, {
    url: `${base}`,
    connections: 10,
    duration: 10,
    requests: [
      {
        method: 'POST',
        path: usersPath,
        setupRequest: (req) => {
          const n = Math.floor(Math.random() * 1e12).toString(36);
          req.headers = {
            ...(req.headers || {}),
            'content-type': 'application/json',
          };
          req.body = JSON.stringify({
            name: `Perf ${n}`,
            email: `perf_${n}@ex.com`,
            role: 'user',
            status: 'active',
          });
          return req;
        },
      },
    ],
  });
} catch (error) {
  console.error('Performance test failed:', error);
  process.exit(1);
}
