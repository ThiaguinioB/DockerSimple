import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 10000,             // 💥 10 000 solicitudes por segundo
      timeUnit: '1s',          // “rate” medido por segundo
      duration: '2m',          // Mantiene la carga durante 2 minutos
      preAllocatedVUs: 2000,   // VUs iniciales reservados
      maxVUs: 5000,            // Escala hasta 5000 si la app responde lento
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.05'],       // Menos del 5% de errores
    http_req_duration: ['p(95)<2000'],    // 95% de requests < 2 s
  },
};

export default function () {
  const res = http.get('http://tu-dominio.com');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.1); // Pequeña pausa entre requests del mismo VU
}
