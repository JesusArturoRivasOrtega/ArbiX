# ArbiX

**Simulador web de arbitraje de Bitcoin multi-exchange en tiempo real.**

ArbiX detecta divergencias de precio entre exchanges, calcula si la oportunidad sigue siendo rentable despues de fees, slippage, latencia, liquidez y wallets, y simula la ejecucion completa sin colocar ordenes reales ni pedir llaves privadas.

El proyecto fue construido para el challenge de arbitraje de Bitcoin: no se limita a comparar `ask < bid`; modela una operacion ejecutable contra profundidad de order book, registra P&L, explica rechazos y muestra el estado del bot en una interfaz web.

![Dashboard principal de ArbiX](docs/screenshots/readme-dashboard.png)

## Indice

- [Resumen ejecutivo](#resumen-ejecutivo)
- [Por que cumple la convocatoria](#por-que-cumple-la-convocatoria)
- [Capturas explicadas](#capturas-explicadas)
- [Arquitectura](#arquitectura)
- [Como funciona el bot](#como-funciona-el-bot)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Instalacion y ejecucion](#instalacion-y-ejecucion)
- [Modos de operacion](#modos-de-operacion)
- [API y eventos realtime](#api-y-eventos-realtime)
- [Pruebas y calidad](#pruebas-y-calidad)
- [Despliegue](#despliegue)
- [Decisiones tecnicas](#decisiones-tecnicas)
- [Limitaciones conocidas](#limitaciones-conocidas)

## Resumen ejecutivo

ArbiX es una plataforma full-stack para evaluar oportunidades de arbitraje crypto. Consume datos de mercado de varios exchanges, normaliza quotes y order books, compara precios, estima el volumen ejecutable, descuenta costos reales y decide si simular o rechazar la operacion.

El sistema esta pensado como una demo tecnica robusta:

- **Tiempo real:** backend NestJS con Socket.IO y adaptadores WebSocket/polling segun exchange.
- **Multi-exchange:** Binance, Kraken, OKX, Bybit y Coinbase opcional, mas adaptadores demo/replay.
- **Multi-symbol:** BTC/USDT, ETH/USDT y SOL/USDT.
- **Ejecucion simulada:** VWAP contra profundidad de libro, fees, slippage, withdrawal fee, latencia y wallets.
- **Riesgo explicable:** circuit breaker, stale data guard, price anomaly guard y razones de rechazo.
- **Frontend funcional:** dashboard financiero en Next.js con oportunidades, P&L, wallets, risk center, analytics y strategy lab.
- **No trading real:** no usa llaves privadas, no envia ordenes y no mueve fondos reales.

## Por que cumple la convocatoria

La convocatoria pide construir un sistema automatico capaz de detectar arbitraje en tiempo real y simular su ejecucion de forma inteligente. ArbiX cubre esos puntos asi:

| Requisito de la convocatoria | Como lo cumple ArbiX | Evidencia en el proyecto |
|---|---|---|
| Monitoreo en tiempo real de order books de BTC en dos o mas exchanges | Mantiene snapshots normalizados por exchange y simbolo. En modo LIVE usa adaptadores publicos; en DEMO/REPLAY usa el mismo contrato para escenarios deterministas. | `apps/api/src/market-data`, `OrderBookStore`, `ExchangeAdapter`, Market Matrix del dashboard |
| Conexion por WebSockets o polling a feeds publicos | Adaptadores para Binance, Kraken, OKX, Bybit y Coinbase opcional. Todos normalizan datos a contratos comunes antes de llegar al motor. | `apps/api/src/market-data/adapters` |
| Mejor Ask y Bid actualizado por plataforma | Cada snapshot conserva top-of-book y profundidad. La UI muestra precios por exchange y simbolo en realtime. | Dashboard, `GET /market/snapshots`, `GET /market/orderbooks` |
| Deteccion de oportunidades `ask < bid` | El motor compara compra barata contra venta cara entre venues activos por simbolo. | `apps/api/src/arbitrage/arbitrage.engine.ts` |
| Calculo de rentabilidad neta | El calculo descuenta trading fees, withdrawal fees, slippage, latencia y volumen ejecutable. | `cost-calculator.ts`, `slippage-estimator.ts`, detalle de oportunidades |
| Evitar oportunidades falsas por costos | Si el spread bruto se vuelve negativo al descontar costos, la oportunidad se marca `REJECTED` con razon explicita. | Oportunidades rechazadas por `NET_PROFIT_NEGATIVE`, `CIRCUIT_BREAKER_ACTIVE`, etc. |
| Ejecucion simulada de la operacion | Al aprobar una oportunidad, simula compra y venta simultanea, timeline, fees, P&L y ledger. | `execution-simulator.ts`, `wallet.service.ts`, `pnl.service.ts` |
| Restricciones de liquidez del order book | Usa VWAP recorriendo niveles de profundidad; no asume que todo se llena al mejor precio. | `slippage-estimator.ts`, `partial-fill.service.ts` |
| Ordenes parciales | Permite reducir volumen si la liquidez disponible no cubre el tamano objetivo. | `partial-fill.service.ts`, config `allowPartialFills` |
| Balance de wallets | Cada exchange mantiene balances virtuales separados por activo. El trade aplica deltas a wallets y escribe ledger. | Wallets page, `GET /wallets`, `POST /wallets/reset` |
| Registro y visualizacion de rendimiento | Guarda oportunidades, trades, P&L acumulado, razones de rechazo, latencia y volumen. | Analytics, Opportunity Feed, P&L chart |
| Interfaz web funcional | Next.js dashboard con navegacion por modulos: Dashboard, Opportunities, Simulator, Wallets, Analytics, Risk Center, Strategy Lab y Settings. | `apps/web/src/app` |
| Despliegue web | Incluye configuracion para Vercel, Railway, Render, Docker Compose y variables de entorno. | `apps/web/vercel.json`, `railway.json`, `render.yaml`, `docker-compose.yml` |
| README claro | Este documento describe arquitectura, instalacion, ejecucion, decisiones tecnicas, capturas y cobertura del challenge. | `README.md` |

### Evaluacion por criterios del jurado

| Criterio | Respuesta tecnica |
|---|---|
| Velocidad y eficiencia | El backend opera con eventos realtime, normalizacion ligera y deduplicacion/cooldown de oportunidades para no recalcular ejecuciones redundantes. La UI muestra latencia por exchange y latencia de deteccion. |
| Precision de rentabilidad neta | El calculo no usa solo top-of-book: estima VWAP, fees de compra/venta, withdrawal fee, slippage y penalizacion por latencia. |
| Robustez de negocio | Maneja baja liquidez, ordenes parciales, circuit breaker, stale data, price anomalies, wallet constraints y P&L stop. |
| Inteligencia del bot | Puntua oportunidades con confianza, clasifica `EXECUTED`, `REJECTED`, `WATCHING` y expone un Strategy Lab para arbitraje triangular en modo observacion. |
| Arquitectura y codigo | Monorepo TypeScript con frontend, backend, tipos compartidos, modulos NestJS separados y pruebas unitarias/e2e. |
| Experiencia web | Dashboard financiero denso, estados en vivo, filtros, exports CSV/JSON, tutorial guiado, panel de demo y vistas de riesgo/analytics. |

## Capturas explicadas

Las capturas siguientes fueron tomadas desde la app local en modo `DEMO`, con backend NestJS y frontend Next.js corriendo en tiempo real.

### 1. Dashboard principal

![Dashboard principal de ArbiX](docs/screenshots/readme-dashboard.png)

El dashboard funciona como centro de mando. En la parte superior se observa:

- Estado de modo `DEMO`.
- Conexion realtime activa.
- Bot en ejecucion.
- Precios vivos de BTC, ETH y SOL.
- Latencia maxima detectada.
- Filtro por par y controles de replay.

Las tarjetas principales resumen el estado operativo: P&L neto, oportunidades evaluadas, simulaciones ejecutadas, rechazos, spread actual, latencia media, exchanges activos y notional simulado. Esto responde al requisito de visualizar rendimiento y estado del mercado en una interfaz web clara.

### 2. Oportunidades de arbitraje

![Vista de oportunidades y detalle de arbitraje](docs/screenshots/readme-opportunities.png)

Esta pantalla muestra el triage de oportunidades. Cada oportunidad incluye:

- Par negociado.
- Exchange de compra y exchange de venta.
- Estado (`EXECUTED`, `REJECTED`, `WATCHING`, `EXPIRED`).
- Spread bruto.
- Volumen.
- Latencia de procesamiento.
- Confianza.
- Motivo de rechazo cuando aplica.

El panel derecho permite auditar una oportunidad concreta. En la captura se ve un rechazo por circuit breaker: el bot no ejecuta una operacion solo porque exista spread; primero valida riesgo y costos.

### 3. Wallets virtuales

![Wallets virtuales por exchange y activo](docs/screenshots/readme-wallets.png)

La convocatoria exige manejar balances de wallets. ArbiX modela balances por exchange y activo, no un saldo global simplificado. Esto es importante porque en arbitraje real el capital esta fragmentado: tener USDT en Binance no significa poder vender BTC en Kraken si esa wallet no tiene BTC.

La vista incluye:

- Portafolio por exchange.
- Distribucion por activo.
- Tabla de wallets.
- Ledger por trade.
- Reset de saldos demo.
- Export CSV.

Cada simulacion aprobada modifica balances virtuales y escribe movimientos en ledger.

### 4. Analytics y P&L

![Analytics de P&L, fees y rechazos](docs/screenshots/readme-analytics.png)

Analytics consolida rendimiento y calidad de oportunidades:

- Gross profit.
- Net profit.
- Fees pagados.
- Slippage.
- Latencia promedio.
- Ejecutadas vs rechazadas.
- Total de oportunidades.
- Sharpe ratio cuando hay suficientes ejecuciones.
- Mejor oportunidad ejecutada y peor oportunidad rechazada.

Esta vista responde directamente al requisito de llevar historial de oportunidades, operaciones, ganancias y perdidas acumuladas.

### 5. Risk Center

![Centro de riesgo y circuit breaker](docs/screenshots/readme-risk.png)

El Risk Center muestra por que ArbiX es un simulador de ejecucion inteligente, no solo un comparador de precios. Aqui se configuran y visualizan:

- Circuit breaker.
- Latencia maxima permitida.
- Edad maxima del order book.
- Slippage maximo.
- Tamano maximo de trade.
- Stop de P&L negativo.
- Minimo liquidity score.
- Proteccion contra datos stale.
- Permiso de partial fills.

La captura muestra latencia maxima de `1500ms` frente a un limite de `1000ms`, lo que eleva el riesgo. Esta decision evita simular oportunidades que podrian desaparecer antes de ejecutarse.

### 6. Strategy Lab

![Strategy Lab para arbitraje triangular](docs/screenshots/readme-strategy-lab.png)

Ademas del arbitraje cross-exchange, ArbiX incluye un Strategy Lab para explorar arbitraje triangular en modo watch-only. La idea es mostrar extensibilidad: el motor principal cubre el challenge, y el laboratorio prueba estrategias mas sofisticadas sin poner en riesgo la demo.

## Arquitectura

ArbiX es un monorepo TypeScript con workspaces npm:

```text
ArbiX
├─ apps
│  ├─ api   # Backend NestJS, Socket.IO, Prisma, motor de arbitraje
│  └─ web   # Frontend Next.js, Tailwind, Zustand, Recharts
├─ packages
│  ├─ shared # Tipos compartidos frontend/backend
│  └─ config # Configuracion reutilizable
├─ docs
│  ├─ screenshots
│  ├─ architecture.md
│  ├─ compliance-review.md
│  ├─ demo-script.md
│  └─ technical-decisions.md
└─ docker-compose.yml
```

### Diagrama de componentes

```mermaid
flowchart TB
  subgraph EX["Exchanges / fuentes de mercado"]
    BIN["Binance"]
    KRA["Kraken"]
    OKX["OKX"]
    BYB["Bybit"]
    CB["Coinbase opcional"]
    MOCK["Mock / Replay"]
  end

  subgraph API["NestJS API"]
    ADP["Exchange Adapters"]
    NORM["Normalizador de quotes/order books"]
    STORE["OrderBook Store"]
    ARB["Arbitrage Engine"]
    VWAP["VWAP + Slippage Estimator"]
    COST["Cost Calculator"]
    RISK["Risk Engine + Circuit Breaker"]
    SIM["Execution Simulator"]
    WAL["Wallet Service"]
    PNL["P&L Service"]
    DB[("PostgreSQL / Prisma")]
    GW["Socket.IO Gateway"]
  end

  subgraph WEB["Next.js Web App"]
    DASH["Dashboard"]
    OPP["Opportunities"]
    WALLETS["Wallets"]
    ANALYTICS["Analytics"]
    RISKUI["Risk Center"]
    LAB["Strategy Lab"]
  end

  BIN --> ADP
  KRA --> ADP
  OKX --> ADP
  BYB --> ADP
  CB --> ADP
  MOCK --> ADP
  ADP --> NORM
  NORM --> STORE
  STORE --> ARB
  ARB --> VWAP
  VWAP --> COST
  COST --> RISK
  RISK --> SIM
  SIM --> WAL
  SIM --> PNL
  ARB --> DB
  SIM --> DB
  WAL --> DB
  GW --> WEB
  ARB --> GW
  SIM --> GW
  WAL --> GW
  PNL --> GW
```

### Flujo de datos

```mermaid
sequenceDiagram
  participant E as Exchange WS / Demo Adapter
  participant A as Exchange Adapter
  participant O as OrderBook Store
  participant B as Arbitrage Engine
  participant C as Cost Calculator
  participant R as Risk Engine
  participant S as Execution Simulator
  participant W as Wallet Service
  participant U as Web UI

  E->>A: Quote + order book update
  A->>O: NormalizedOrderBook
  O->>B: Best ask/bid by symbol
  B->>B: Compare ask < bid across exchanges
  B->>C: Candidate opportunity
  C->>C: VWAP, fees, withdrawal, slippage, latency
  C->>R: Net opportunity
  R-->>B: Accept or reject with reason
  alt Accepted
    B->>S: Simulate buy + sell
    S->>W: Apply wallet deltas
    S->>U: trade.simulated + pnl.updated
  else Rejected
    B->>U: opportunity.rejected + reason
  end
```

### Pipeline de decision

```mermaid
flowchart TD
  A["Llega nuevo order book"] --> B["Normalizar simbolo, bid, ask y profundidad"]
  B --> C{"Existe ask menor que bid en otro exchange?"}
  C -- "No" --> X["No hay oportunidad"]
  C -- "Si" --> D["Calcular volumen ejecutable"]
  D --> E["Calcular VWAP por niveles de order book"]
  E --> F["Descontar trading fees, withdrawal fee y slippage"]
  F --> G["Medir latencia y edad del libro"]
  G --> H{"Rentabilidad neta supera umbral?"}
  H -- "No" --> R1["REJECTED: costos/rentabilidad"]
  H -- "Si" --> I{"Wallets y liquidez alcanzan?"}
  I -- "No" --> R2["REJECTED o partial fill"]
  I -- "Si" --> J{"Circuit breaker activo?"}
  J -- "Si" --> R3["REJECTED: riesgo"]
  J -- "No" --> K["EXECUTED: simulacion de trade"]
  K --> L["Actualizar wallets, ledger y P&L"]
```

## Como funciona el bot

1. **Ingestion de mercado:** adaptadores conectan con exchanges publicos o fuentes demo/replay.
2. **Normalizacion:** cada feed se convierte a `BestQuote` y `NormalizedOrderBook`.
3. **Comparacion cross-exchange:** el motor busca `ask` bajo en un exchange y `bid` alto en otro para el mismo par.
4. **Profundidad realista:** el simulador no compra todo al primer ask; calcula VWAP recorriendo niveles del libro.
5. **Costos netos:** descuenta fees, withdrawal fee, slippage y costo/penalizacion por latencia.
6. **Wallet-aware execution:** valida si hay USDT/BTC suficientes en las wallets correctas.
7. **Riesgo:** aplica stale-data guard, price anomaly guard, circuit breaker y limites configurables.
8. **Decision:** clasifica como ejecutada, rechazada, watching o expirada.
9. **Simulacion:** si se aprueba, registra compra, venta, fees, wallet deltas y P&L.
10. **Realtime UI:** emite eventos por Socket.IO para actualizar dashboard, analytics y vistas de detalle.

## Tecnologias utilizadas

### Frontend

| Tecnologia | Uso |
|---|---|
| Next.js 15 | App web, routing y rendering |
| React 19 | Componentes de UI |
| TypeScript | Tipado estricto |
| Tailwind CSS | Estilos y layout financiero |
| shadcn-style components | Botones, cards, tabs, inputs, switches |
| Zustand | Stores de mercado, oportunidades, wallets, analytics y UI |
| Socket.IO Client | Realtime desde backend |
| Recharts | Graficas de P&L, volumen, rechazos y distribucion |
| Lucide React | Iconografia |
| Playwright | Pruebas e2e y capturas |

### Backend

| Tecnologia | Uso |
|---|---|
| NestJS 11 | API modular, DI y controladores |
| TypeScript | Logica de dominio tipada |
| Socket.IO | Gateway realtime |
| Prisma ORM | Persistencia opcional |
| PostgreSQL | Base de datos para snapshots/trades cuando esta disponible |
| ws | Conexiones WebSocket a exchanges |
| Vitest | Unit/integration tests |
| Swagger/OpenAPI | Documentacion interactiva de API |

### Infraestructura y tooling

| Tecnologia | Uso |
|---|---|
| npm workspaces | Monorepo |
| Docker Compose | PostgreSQL, Redis, API y web |
| Vercel config | Despliegue frontend |
| Railway / Render config | Despliegue backend |
| ESLint | Calidad frontend |
| Prisma migrations | Esquema DB versionado |

## Instalacion y ejecucion

### Requisitos

- Node.js `20.11+`
- npm `10+`
- Docker Desktop opcional para PostgreSQL

### 1. Clonar e instalar

```bash
git clone <URL_DEL_REPOSITORIO>
cd Arbix
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Ejemplo base:

```env
MARKET_MODE=DEMO
API_PORT=4000
WEB_PORT=3001
ENABLE_BINANCE=true
ENABLE_KRAKEN=true
ENABLE_OKX=true
ENABLE_COINBASE=false
ENABLE_BYBIT=true
DATABASE_URL=postgresql://arbix:arbix@localhost:5432/arbix?schema=public
FRONTEND_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
GROQ_API_KEY=
```

> `GROQ_API_KEY` es opcional y solo se usa para el asistente AI de la plataforma. El core de arbitraje funciona sin esa llave.

### 3. Ejecutar sin base de datos

ArbiX puede correr en memoria, ideal para demo rapida:

```bash
npm run prisma:generate -w @arbix/api
npm run dev
```

Servicios:

| Servicio | URL |
|---|---|
| Web app | http://localhost:3001 |
| API health | http://localhost:4000/health |
| Swagger | http://localhost:4000/api/docs |
| Socket.IO | http://localhost:4000 |

### 4. Ejecutar con PostgreSQL

```bash
docker compose up -d postgres
npm run prisma:generate -w @arbix/api
npm run prisma:migrate -w @arbix/api
npm run seed -w @arbix/api
npm run dev
```

### 5. Ejecutar todo con Docker

```bash
docker compose up --build
```

Esto levanta:

- PostgreSQL en `5432`.
- Redis en `6379`.
- API en `4000`.
- Web en `3001`.

## Modos de operacion

| Modo | Descripcion | Uso recomendado |
|---|---|---|
| `DEMO` | Datos sinteticos controlados con oportunidades reproducibles. | Presentacion ante jurado y pruebas locales |
| `LIVE` | Feeds publicos de exchanges reales. No usa llaves privadas. | Validar conectividad real |
| `REPLAY` | Reproduce escenarios o buffer de ultimos minutos. | Demo, backtesting ligero y explicacion |

### Escenarios incluidos

| Escenario | Que demuestra |
|---|---|
| `profitable-arbitrage` | Una oportunidad rentable que llega a simulacion |
| `rejected-by-fees` | Spread bruto positivo que se vuelve negativo por fees |
| `insufficient-liquidity` | Profundidad insuficiente y partial fill |
| `high-latency-circuit-breaker` | Latencia excesiva que activa protecciones |
| `last-5-minutes` | Replay de buffer reciente o fallback demo |

### Flujo de demo recomendado

1. Abrir `http://localhost:3001/dashboard`.
2. Pulsar **Presentation Mode**.
3. Mostrar el estado realtime conectado.
4. Abrir **Opportunities** y explicar una oportunidad ejecutada o rechazada.
5. Abrir **Wallets** para ver deltas y ledger.
6. Abrir **Analytics** para explicar P&L, fees, rechazos y latencia.
7. Ejecutar escenario de alta latencia y abrir **Risk Center**.
8. Cerrar con **Strategy Lab** para demostrar extensibilidad.

## API y eventos realtime

### REST principal

```text
GET   /health
GET   /exchanges/status
GET   /market/snapshots
GET   /market/orderbooks
GET   /market/orderbook/:exchange/:base/:quote
GET   /opportunities
GET   /trades
GET   /simulator/last-trade
GET   /wallets
GET   /analytics/summary
GET   /analytics/performance
GET   /analytics/replay-scenarios
GET   /risk/status
GET   /risk/events
GET   /config
PATCH /config
POST  /presentation/activate
POST  /replay/start
POST  /replay/scenario/:scenarioName
POST  /replay/validate-scenarios
POST  /bot/start
POST  /bot/stop
POST  /bot/pause
POST  /bot/reset
POST  /wallets/reset
POST  /risk/circuit-breaker/clear
GET   /strategy-lab/triangular
POST  /strategy-lab/triangular/simulate
GET   /strategy-lab/triangular/last-simulation
```

Swagger esta disponible en:

```text
http://localhost:4000/api/docs
```

### Socket.IO events

Backend a frontend:

```text
market.quote.updated
market.orderbook.updated
opportunity.detected
opportunity.rejected
opportunity.executed
opportunities.updated
trade.simulated
wallet.updated
pnl.updated
analytics.updated
risk.status.updated
risk.circuit_breaker.triggered
risk.circuit_breaker.cleared
latency.updated
bot.status.updated
replay.started
replay.finished
```

Frontend a backend:

```text
bot.start
bot.stop
bot.pause
bot.reset
config.update
replay.start
replay.scenario
wallet.reset
latency.ack
```

## Pruebas y calidad

Comandos principales:

```bash
# API unit/integration tests
npm test -w @arbix/api

# Web unit tests
npm run test -w @arbix/web

# Playwright e2e
npm run test:e2e -w @arbix/web

# Type checking
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.e2e.json

# Build completo
npm run build

# Lint frontend
npm run lint -w @arbix/web
```

### Cobertura funcional de tests

| Area | Que valida |
|---|---|
| Cost calculator | Fees, slippage, withdrawal fees y net profit |
| Slippage estimator | VWAP y profundidad de order book |
| Opportunity scorer | Confidence score y recomendacion |
| Risk engine | Rechazos, latencia, P&L stop y circuit breaker |
| Wallet service | Balances, ledger, reset y aplicacion de trades |
| Arbitrage engine | Spread threshold, dedup, simulate/reject |
| Replay service | Catalogo de escenarios |
| Demo scenarios | Comportamiento de mock adapters |
| Integration specs | Engine -> simulator -> wallet -> P&L |
| Web unit tests | Stores, tutorial y formatters |
| Playwright e2e | Dashboard, Presentation Mode, tutorial, P&L y wallets |

## Despliegue

### Opcion recomendada

| Parte | Plataforma sugerida |
|---|---|
| Frontend `apps/web` | Vercel |
| Backend `apps/api` | Railway, Render o Google Cloud Run |
| PostgreSQL | Supabase, Neon, Railway Postgres o Render Postgres |

### Variables para frontend

```env
NEXT_PUBLIC_API_URL=https://tu-api.example.com
NEXT_PUBLIC_WS_URL=https://tu-api.example.com
```

### Variables para backend

```env
MARKET_MODE=DEMO
API_PORT=4000
FRONTEND_URL=https://tu-frontend.example.com
DATABASE_URL=postgresql://...
ENABLE_BINANCE=true
ENABLE_KRAKEN=true
ENABLE_OKX=true
ENABLE_BYBIT=true
ENABLE_COINBASE=false
```

### Docker Compose

Para una demo autocontenida:

```bash
docker compose up --build
```

## Decisiones tecnicas

### WebSockets sobre polling cuando es posible

El arbitraje depende de ventanas cortas. Por eso el diseno favorece streams realtime y eventos Socket.IO. Polling puede servir como fallback, pero no es el modelo principal.

### VWAP sobre top-of-book

Comparar solo mejor ask y mejor bid sobreestima profit. ArbiX recorre profundidad de order book y calcula VWAP para estimar el precio real de ejecucion.

### DEMO/REPLAY para presentacion estable

Un jurado no deberia depender de que el mercado entregue una oportunidad real justo durante la exposicion. DEMO y REPLAY permiten demostrar cada caso: ejecucion rentable, rechazo por fees, baja liquidez y riesgo por latencia.

### No trading real

El challenge pide simular ejecucion. ArbiX no pide API keys privadas, no coloca ordenes y no mueve fondos. Esto reduce riesgo operativo y hace la evaluacion reproducible.

### Tipos compartidos

`packages/shared` evita drift entre backend y frontend. Si cambia un payload realtime, TypeScript detecta la incompatibilidad en build.

### Persistencia opcional

La app funciona en memoria para facilitar demo local. Si PostgreSQL esta disponible, Prisma persiste snapshots, order books, oportunidades, trades y eventos.

## Limitaciones conocidas

- Es un simulador: no ejecuta ordenes reales.
- Los balances son virtuales y por exchange; no modela transferencias cross-chain entre exchanges.
- DEMO mode usa datos sinteticos para estabilidad de presentacion.
- LIVE mode depende de disponibilidad y formato de APIs publicas de cada exchange.
- No implementa smart order routing fragmentado entre multiples venues para una misma pierna.
- Strategy Lab triangular esta en modo exploratorio/watch-only.
- El replay de ultimos 5 minutos necesita buffer acumulado; si esta vacio usa fallback demo.

## Documentacion adicional

- [Arquitectura](docs/architecture.md)
- [Decisiones tecnicas](docs/technical-decisions.md)
- [Guion de demo](docs/demo-script.md)
- [Revision de cumplimiento](docs/compliance-review.md)
- [Checklist QA](docs/qa-checklist.md)
- [Tutorial guiado](docs/tutorial.md)

## Estado de entrega

ArbiX cumple el nucleo del challenge: monitorea multiples exchanges, detecta arbitraje, calcula rentabilidad neta, respeta liquidez, simula ejecucion, actualiza wallets, registra P&L y presenta todo en una web app. La entrega prioriza una demo verificable y una arquitectura extensible, con controles de riesgo suficientes para explicar por que una oportunidad se ejecuta o se rechaza.
