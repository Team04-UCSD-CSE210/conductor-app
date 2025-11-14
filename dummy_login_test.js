/* global __VU */
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.05'],
  },
};

export default function () {
  const url = 'https://localhost:8443/login.html'; // <--- change to your own endpoint
  const payload = JSON.stringify({
    username: `testuser${__VU}`,
    password: 'Password1!',
  });
  const params = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post(url, payload, params);

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(1);
}

