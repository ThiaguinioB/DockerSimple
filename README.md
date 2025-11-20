# DockerSimple
 
# 📊 ANÁLISIS DETALLADO DEL PROYECTO

## 🎯 OBJETIVO DEL PROYECTO
Este proyecto implementa una **estrategia de despliegue Canary** en Kubernetes, permitiendo probar nuevas versiones de una aplicación web con un porcentaje controlado del tráfico antes de desplegarla completamente. Incluye pruebas de carga con K6 para validar el rendimiento.

---

## 📋 REQUISITOS PREVIOS

### **Sistema Operativo**
⚠️ **IMPORTANTE**: Este proyecto está diseñado para sistemas basados en **UNIX (Linux/macOS)**. Los comandos y scripts están optimizados para entornos bash/zsh.

### **Herramientas Requeridas**
- **Docker** - Para construcción de imágenes de contenedores
- **Kubernetes Cluster** - Opciones:
  - Minikube (desarrollo local)
  - Kind (Kubernetes in Docker)
  - Cloud providers (GKE, EKS, AKS)
- **kubectl** - CLI de Kubernetes configurado y conectado al cluster
- **NGINX Ingress Controller** - Instalado en el cluster de Kubernetes
  ```bash
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
  ```
- **K6** - Herramienta de pruebas de carga
  ```bash
  # Linux
  sudo apt-get install k6
  
  # macOS
  brew install k6
  ```

### **Verificar Instalación**
```bash
docker --version
kubectl version --client
kubectl get nodes
k6 version
```

---

## 🏗️ ARQUITECTURA Y COMPONENTES

### **1. APLICACIONES WEB (v1 y v2)**

#### **v1/** - Versión Estable (Roja)
- **`Dockerfile`**: Construye imagen basada en `nginx:alpine`
- **`index.html`**: Muestra "Hola Mundo" en **rojo** (color:red)
- **Propósito**: Versión de producción actual y estable

#### **v2/** - Versión Canary (Rosa/Púrpura)
- **`Dockerfile`**: Idéntico al v1, basado en `nginx:alpine`
- **`index.html`**: Muestra "Hola Mundo" en **rosa/púrpura** (rgb(211, 124, 245))
- **Propósito**: Nueva versión en pruebas con tráfico limitado

**Flujo de construcción de imágenes:**
```
v1/Dockerfile + v1/index.html → docker build → demo:v1 / thiaguiniob/imagen-red:v1
v2/Dockerfile + v2/index.html → docker build → demo:v2 / thiaguiniob/imagen-pink:v2
```

---

### **2. CONFIGURACIONES KUBERNETES**

#### **A. DEPLOYMENTS**

El proyecto tiene **DOS sets de deployments**:

##### **`deployments/`** - Para entorno con imágenes locales
- **`deployments-v1.yaml`**:
  - Nombre: `web-estable`
  - Replicas: 2
  - Labels: `app: web`, `version: estable`
  - Imagen: `demo:v1` (local)
  - Pull Policy: `IfNotPresent` (usa caché local)

- **`deployments-v2.yaml`**:
  - Nombre: `web-canary`
  - Replicas: 2
  - Labels: `app: web`, `version: canary`
  - Imagen: `demo:v2` (local)
  - Pull Policy: `IfNotPresent`

##### **`deployments-local/`** - Para entorno con imágenes de Docker Hub
- **`deployments-v1.yaml`**: 
  - Imagen: `thiaguiniob/imagen-red:v1` (Docker Hub)
  - Sin `imagePullPolicy` especificado (usa default)
  
- **`deployments-v2.yaml`**:
  - Imagen: `thiaguiniob/imagen-pink:v2` (Docker Hub)
  - Nota: Hay un error en el comentario (dice "fondo rojo" pero debería decir "rosa/púrpura")

#### **B. SERVICES** - Direccionamiento de tráfico

**`services/service-v1.yml`**:
```yaml
Nombre: servicio-estable
Selector: app: web, version: estable
Puerto: 80 → 80
```
→ Apunta SOLO a pods con label `version: estable`

**`services/service-v2.yml`**:
```yaml
Nombre: servicio-canary
Selector: app: web, version: canary
Puerto: 80 → 80
```
→ Apunta SOLO a pods con label `version: canary`

#### **C. INGRESS** - Control de tráfico Canary

**`ingress/ingress.yaml`** contiene DOS recursos Ingress:

**1. Ingress Estable** (`web-ingress-estable`):
- Host: `tu-dominio.com`
- Path: `/`
- Backend: `servicio-estable:80`
- Recibe el 90% del tráfico por defecto

**2. Ingress Canary** (`web-ingress-canary`):
- **Anotaciones especiales**:
  - `nginx.ingress.kubernetes.io/canary: "true"` ← Activa modo canary
  - `nginx.ingress.kubernetes.io/canary-weight: "10"` ← 10% del tráfico
- Host: `tu-dominio.com` (mismo que estable)
- Path: `/`
- Backend: `servicio-canary:80`

**Funcionamiento del Canary:**
- 90% de usuarios → `servicio-estable` → pods v1 (rojo)
- 10% de usuarios → `servicio-canary` → pods v2 (rosa)
- Permite validar v2 con tráfico real limitado

---

### **3. PRUEBAS DE CARGA (K6)**

El proyecto incluye 4 archivos JavaScript para pruebas con K6:

#### **`test.js`** - Prueba Básica
- **VUs**: 50 usuarios virtuales
- **Duración**: 30 segundos
- **Patrón**: Carga constante
- **Propósito**: Smoke test inicial

#### **`script.js`** - Prueba de Escalado Gradual
```javascript
Stages:
30s → 200 VUs   (sanity check)
30s → 500 VUs   (validación media carga)
30s → 1000 VUs  (validación alta carga)
30s → 2000 VUs  (estrés máximo)
30s → 0 VUs     (recuperación)
```
- **Thresholds**:
  - Tasa de error < 5%
  - P95 de latencia < 2000ms

#### **`spike_test.js`** - Prueba de Picos de Tráfico
```javascript
10s → 50 VUs     (calentamiento)
10s → 1000 VUs   (pico abrupto)
20s → 1000 VUs   (mantener pico)
10s → 50 VUs     (caída rápida)
10s → 0 VUs      (recuperación)
```
- **Propósito**: Simular tráfico viral o campañas publicitarias
- Valida auto-scaling y resistencia a picos

#### **`stress_test.js`** - Prueba de Estrés Sostenido
- **Patrón**: `constant-arrival-rate`
- **Rate**: 10,000 requests/segundo
- **Duración**: 2 minutos
- **VUs**: 2000-5000 (escala automático)
- **Propósito**: Encontrar límites del sistema

---

## 🔄 FLUJO DE TRABAJO COMPLETO

### **FASE 1: Construcción de Imágenes**
```bash
# Construir versión estable
cd v1/
docker build -t demo:v1 .
docker tag demo:v1 thiaguiniob/imagen-red:v1
docker push thiaguiniob/imagen-red:v1

# Construir versión canary
cd v2/
docker build -t demo:v2 .
docker tag demo:v2 thiaguiniob/imagen-pink:v2
docker push thiaguiniob/imagen-pink:v2
```

### **FASE 2: Despliegue en Kubernetes**

**Opción A - Imágenes Locales:**
```bash
kubectl apply -f deployments/deployments-v1.yaml
kubectl apply -f deployments/deployments-v2.yaml
kubectl apply -f services/service-v1.yml
kubectl apply -f services/service-v2.yml
kubectl apply -f ingress/ingress.yaml
```

**Opción B - Imágenes Docker Hub:**
```bash
kubectl apply -f deployments-local/deployments-v1.yaml
kubectl apply -f deployments-local/deployments-v2.yaml
kubectl apply -f services/
kubectl apply -f ingress/
```

### **FASE 3: Configuración DNS Local**

**Paso 1: Obtener la IP del Ingress Controller**
```bash
# Obtener la IP externa del Ingress Controller
kubectl get svc -n ingress-nginx

# O usar este comando directo
kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

**Paso 2: Configurar el archivo hosts**
```bash
# Linux/macOS: Editar /etc/hosts
sudo nano /etc/hosts

# Agregar esta línea (reemplazar <INGRESS_IP> con la IP obtenida):
<INGRESS_IP> tu-dominio.com

# Ejemplo:
# 192.168.49.2 tu-dominio.com
```

**Nota para Windows**: Editar `C:\Windows\System32\drivers\etc\hosts` como Administrador

### **FASE 4: Validación del Canary**

**Linux/macOS (bash/zsh):**
```bash
# Hacer 100 requests para ver distribución del tráfico
for i in {1..100}; do curl http://tu-dominio.com; done
```

**Windows (PowerShell):**
```powershell
# Hacer 100 requests para ver distribución del tráfico
1..100 | ForEach-Object { Invoke-WebRequest http://tu-dominio.com }
```

**Resultado esperado:**
- ~90 respuestas con texto rojo (v1 - versión estable)
- ~10 respuestas con texto rosa (v2 - versión canary)

**Verificar distribución:**
```bash
# Contar respuestas por color
for i in {1..100}; do curl -s http://tu-dominio.com; done | grep -o 'color:[^;]*' | sort | uniq -c
```

### **FASE 5: Pruebas de Carga**
```bash
# Test básico
k6 run test.js

# Test de escalado
k6 run script.js

# Test de picos
k6 run spike_test.js

# Test de estrés
k6 run stress_test.js
```

### **FASE 6: Promoción o Rollback**

**Si v2 funciona bien (promover):**
```bash
# Aumentar tráfico canary gradualmente
kubectl patch ingress web-ingress-canary -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"50"}}}'

# Eventualmente, convertir v2 en estable
kubectl set image deployment/web-estable web-red=demo:v2
kubectl delete -f deployments/deployments-v2.yaml
```

**Si v2 falla (rollback):**
```bash
# Simplemente eliminar el despliegue canary
kubectl delete -f deployments/deployments-v2.yaml
kubectl delete -f services/service-v2.yml
kubectl delete ingress web-ingress-canary
```

---

## 🎓 PATRONES Y CONCEPTOS CLAVE

1. **Canary Deployment**: Reduce riesgo desplegando versiones nuevas a un subset de usuarios
2. **Label Selectors**: Permiten routing granular del tráfico entre versiones
3. **Weighted Traffic**: NGINX Ingress Controller maneja el split de tráfico
4. **Performance Testing**: Validación automatizada con múltiples escenarios de carga
5. **Containerización**: Aplicaciones simples empaquetadas para portabilidad

---

## 📈 DIAGRAMA DE FLUJO DE TRÁFICO

```
Usuario → tu-dominio.com
         ↓
    NGINX Ingress Controller
         ↓
    ┌────┴────┐
    ↓         ↓
  90%       10%
    ↓         ↓
Ingress    Ingress
Estable    Canary
    ↓         ↓
Servicio   Servicio
Estable    Canary
    ↓         ↓
Pod v1     Pod v2
(rojo)     (rosa)
```

---

## 💡 OBSERVACIONES Y MEJORAS SUGERIDAS

### **Mejoras Implementadas:**
- ✅ `README.md` completo con instrucciones detalladas de uso
- ✅ Diagrama de flujo de tráfico incluido
- ✅ Requisitos previos documentados (kubectl, k6, docker)
- ✅ Comandos específicos para Linux/macOS y Windows
- ✅ Archivos de configuración comentados (ingress.yaml)

### **Mejoras Adicionales Recomendadas:**

#### **Configuración:**
- ⚙️ Reemplazar `tu-dominio.com` con variable de entorno
- ⚙️ Agregar archivo `.env.example` con configuraciones
- ⚙️ Crear script de setup automatizado

#### **Kubernetes:**
- 🔧 Agregar `livenessProbe` y `readinessProbe` a los pods
- 🔧 Definir `resources.limits` y `resources.requests`
- 🔧 Implementar HorizontalPodAutoscaler (HPA)
- 🔧 Agregar NetworkPolicies para seguridad

#### **Monitoreo:**
- 📊 Integrar Prometheus para métricas
- 📊 Agregar Grafana dashboards
- 📊 Implementar logging centralizado (ELK/Loki)
- 📊 Alertas automáticas en caso de errores

#### **CI/CD:**
- 🚀 Pipeline de GitHub Actions/GitLab CI
- 🚀 Automatizar construcción de imágenes
- 🚀 Tests automáticos antes de deploy
- 🚀 Rollback automático si fallan health checks

#### **Testing:**
- 🧪 Agregar tests unitarios
- 🧪 Implementar tests de integración
- 🧪 Validación automática de distribución de tráfico
- 🧪 Smoke tests post-deployment

---

## 📚 TECNOLOGÍAS UTILIZADAS

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Docker | - | Containerización de aplicaciones |
| Kubernetes | - | Orquestación de contenedores |
| NGINX | alpine | Servidor web |
| NGINX Ingress Controller | - | Gestión de tráfico y routing |
| K6 | - | Pruebas de carga y rendimiento |

---

## 🎯 CASOS DE USO

Este proyecto es ideal para:

1. **Aprendizaje**: Entender despliegues Canary en Kubernetes
2. **Testing**: Validar nuevas versiones sin riesgo total
3. **Performance**: Evaluar rendimiento bajo diferentes cargas
4. **DevOps**: Practicar estrategias de deployment modernas
5. **Migración gradual**: Mover usuarios progresivamente a nuevas versiones

---

## 🔗 RECURSOS ADICIONALES

- [Kubernetes Canary Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#canary-deployments)
- [NGINX Ingress Canary Annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#canary)
- [K6 Documentation](https://k6.io/docs/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 📝 CONCLUSIÓN

Este proyecto representa una **implementación educativa excelente** de:
- ✅ Despliegues Canary con Kubernetes
- ✅ Control de tráfico con NGINX Ingress
- ✅ Testing de rendimiento profesional con K6
- ✅ Arquitectura de microservicios básica

Es una base sólida para aprender estrategias de deployment avanzadas y puede extenderse con las mejoras sugeridas para un entorno de producción completo.
