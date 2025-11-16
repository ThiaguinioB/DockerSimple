import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 200 },   // sanity
    { duration: '30s', target: 500 },   // comprobar 500
    { duration: '30s', target: 1000 },  // comprobar 1k
    { duration: '30s', target: 2000 },  // comprobar 2k
    { duration: '30s', target: 0 },     // cool-down
  ],
  thresholds: {
    'http_req_failed': ['rate<0.05'],   // fail si >5% fallan
    'http_req_duration': ['p(95)<2000'],// fail si p95 > 2000ms
  },
};

export default function () {
  const res = http.get('http://tu-dominio.com');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.1);
}
