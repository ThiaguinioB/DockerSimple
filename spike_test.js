import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus', // Escenario que sube y baja usuarios
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },    // 🔹 Calentamiento suave
        { duration: '10s', target: 1000 },  // ⚡ Pico abrupto de carga
        { duration: '20s', target: 1000 },  // 🔹 Mantiene el pico
        { duration: '10s', target: 50 },    // 🔻 Cae la demanda
        { duration: '10s', target: 0 },     // 🔹 Recuperación total
      ],
      gracefulRampDown: '5s',
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.05'], // Máx 5% de errores
    http_req_duration: ['p(95)<2000'], // 95% de requests < 2s
  },
};

export default function () {
  const res = http.get('http://tu-dominio.com');
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(1);
}
