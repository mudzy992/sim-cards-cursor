import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000/api';

export default function () {
  const res = http.get(`${BASE_URL}/analytics/overview`);

  check(res, {
    'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
  });

  sleep(1);
}

