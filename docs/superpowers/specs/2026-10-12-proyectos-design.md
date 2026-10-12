# Apartado Proyectos — Diseño

Fecha: 2026-10-12
Estado: aprobado, listo para plan de implementación

## Objetivo

Dar al equipo de Tecnología de la Información de ProDominicana un lugar dentro de MonitoreoApp para registrar sus proyectos y ver de un vistazo cuáles están por empezar, cuáles están en marcha y cuáles ya cerraron, con un responsable claro por cada uno.

El apartado vive como una tercera pestaña en el dashboard, después de Servicios y Alertas.

## Decisiones tomadas

Cada decisión de abajo la tomó el usuario durante el diseño. No son supuestos.

| Pregunta | Decisión |
|---|---|
| ¿Qué es un proyecto? | Trabajo ligado a los servicios monitoreados |
| ¿Cómo se mide el progreso? | Porcentaje manual de 0 a 100 |
| ¿De dónde salen los responsables? | Lista de usuarios que expone el backend |
| ¿Qué separa actual de pasado y futuro? | Solo el estado del proyecto, sin fechas |
| ¿Cuántos servicios por proyecto? | Varios |
| ¿Cuántos responsables por proyecto? | Uno |
| ¿Las rutas nuevas exigen token? | No, consistente con el resto del backend |

## Alcance

### Dentro

- Módulo backend `projects` con CRUD completo y persistencia en archivo.
- Endpoint que lista los usuarios disponibles para asignar.
- Pestaña Proyectos en el dashboard, con las tres agrupaciones.
- Modal único para crear y editar.
- Pruebas unitarias del servicio backend.

### Fuera

- Página de detalle por proyecto. Un proyecto tiene ocho campos; no llenan una pantalla propia. Se añade después si la necesidad aparece.
- Fechas de inicio y fin, plazos, cálculo de retraso.
- Tareas, checklists, hitos.
- Notificaciones por correo o sonido para cambios de proyecto. El correo y el sonido quedan reservados para caídas de servicio.
- Difusión por WebSocket. Los proyectos cambian solo cuando una persona los edita.
- Historial de cambios de estado.
- Filtro por responsable y búsqueda por texto. Con cinco personas y una lista corta todavía no hacen falta.
- Arnés de pruebas para el frontend. Decisión aparte.

## Modelo de datos

```ts
export type ProjectStatus =
  | "planificado"
  | "en_curso"
  | "en_pausa"
  | "terminado"
  | "cancelado";

export interface Project {
  id: number;
  name: string;
  description: string | null;
  serviceIds: number[];
  assignedTo: string;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
}
```

`id` se genera con `Date.now()`, igual que en `ServicesService.add`.
`assignedTo` guarda el `username`, no el nombre completo. El nombre para mostrar se resuelve en el frontend contra la lista de usuarios.
`serviceIds` guarda ids de servicios monitoreados.
`createdAt` es una cadena ISO.

### Agrupación

La agrupación sale del estado, nada más:

| Grupo | Estados |
|---|---|
| Actuales | `en_curso`, `en_pausa` |
| Futuros | `planificado` |
| Pasados | `terminado`, `cancelado` |

## Backend

### Archivos nuevos

Todos bajo `apps/backend/src/projects/`:

| Archivo | Responsabilidad |
|---|---|
| `project.interface.ts` | Define `Project` y `ProjectStatus`. Sin lógica. |
| `projects.service.ts` | Carga y guarda `projects.json`. CRUD. Toda la validación. |
| `projects.controller.ts` | Traduce HTTP a llamadas del servicio. Sin lógica de negocio. |
| `projects.module.ts` | Declara el módulo. Importa `ServicesModule` y `AuthModule`. |
| `projects.service.spec.ts` | Pruebas unitarias del servicio. |

### Archivos modificados

- `apps/backend/src/app.module.ts` — agrega `ProjectsModule` al arreglo `imports`.
- `apps/backend/src/auth/auth.service.ts` — método público `listUsers()` que devuelve los usuarios de `LOCAL_USERS` sin el campo `password`.
- `apps/backend/src/auth/auth.controller.ts` — ruta `@Get("users")` que llama a `listUsers()`.
- `apps/backend/src/auth/auth.module.ts` — agrega `AuthService` al arreglo `exports`, que hoy solo exporta `JwtModule`. Sin eso, `ProjectsService` no puede inyectarlo.
- `.gitignore` — agrega `apps/backend/projects.json` junto a la línea de `services.json`.

`LOCAL_USERS` no se duplica. Sigue siendo la única fuente de usuarios locales y vive donde ya está, en `auth.service.ts`.

### Endpoints

```
GET    /api/projects          -> Project[]
GET    /api/projects/:id      -> Project | null
POST   /api/projects          -> Project
PATCH  /api/projects/:id      -> Project | null
DELETE /api/projects/:id      -> { ok: boolean }
GET    /api/auth/users        -> { username, name, email, department }[]
```

Cuerpo del `POST`:

```ts
{ name: string; description?: string; serviceIds?: number[];
  assignedTo: string; status?: ProjectStatus; progress?: number }
```

Cuerpo del `PATCH`: los mismos campos, todos opcionales. Solo los campos presentes se modifican.

`GET /api/projects/:id` devuelve `null` cuando el id no existe, igual que `ServicesController.getOne`. Es consistente con lo que ya hay en el proyecto, aunque un 404 sería más ortodoxo.

### Persistencia

Archivo `projects.json`, resuelto con `path.join(process.cwd(), "projects.json")`.

**Corrección del 2026-10-12, tras la revisión de código:** esta sección afirmaba que la ruta absoluta no repetía el fallo de `services.service.ts`, que usa `"./services.json"`. La afirmación era falsa. `fs` resuelve las rutas relativas contra `process.cwd()` igual, así que los dos apuntan al mismo archivo. La única diferencia real es que `projects.json` se fija al importar el módulo y por tanto sobreviviría a un `process.chdir()`, que esta aplicación nunca ejecuta. En la práctica `projects.json` tiene la misma fragilidad: arrancar el backend desde otra carpeta crea un archivo de datos distinto y vacío. Anclarlo de verdad exige `__dirname` o una variable `DATA_DIR`, y eso quedó fuera de este trabajo.

Si el archivo no existe, el servicio arranca con una lista vacía. No se siembran proyectos de ejemplo.

El guardado reescribe el archivo completo con `JSON.stringify(..., null, 2)`, igual que `ServicesService.save`. El volumen esperado es de decenas de proyectos, así que no hace falta nada más elaborado.

### Validación

Vive en `ProjectsService`, no en el controlador. No hay `class-validator` instalado y no se agrega: la validación es manual y explícita.

| Campo | Regla | Si falla |
|---|---|---|
| `name` | Recortado, no vacío | `BadRequestException("El nombre del proyecto es obligatorio")` |
| `status` | Dentro de los cinco valores | `BadRequestException("Estado de proyecto invalido")` |
| `status` ausente al crear | Queda en `planificado` | — |
| `progress` | `Math.min(100, Math.max(0, Math.round(n)))` | Se corrige en silencio |
| `progress` ausente al crear | Queda en `0` | — |
| `assignedTo` | Tiene que existir entre los usuarios | `BadRequestException("Responsable no encontrado")` |
| `serviceIds` | Se filtra contra `ServicesService.getAll()` | Los ids muertos se descartan sin error |

Los ids de servicio muertos se descartan en silencio a propósito: borrar un servicio monitoreado no debe romper las peticiones de los proyectos que lo mencionaban.

Para validar `assignedTo`, `ProjectsService` necesita la lista de usuarios. `ProjectsModule` importa `AuthModule`, que debe exportar `AuthService`. Para validar `serviceIds` importa `ServicesModule`, que ya exporta `ServicesService` — el mismo mecanismo que usa `MonitorModule`.

## Frontend

### Archivos nuevos

| Archivo | Líneas aprox. | Responsabilidad |
|---|---|---|
| `apps/frontend/hooks/useProjects.ts` | 70 | Carga proyectos y usuarios, CRUD, estado de error |
| `apps/frontend/components/ProjectsTab.tsx` | 200 | Las tres agrupaciones, las tarjetas y el modal |

`hooks/` y `components/` van en la raíz de `apps/frontend`, consistente con el `hooks/useMonitor.ts` que ya está ahí.

### Archivo modificado

`apps/frontend/app/page.tsx` — un botón de pestaña más después del de Alertas, y el bloque que monta el componente:

```tsx
{activeTab === 'projects' && <ProjectsTab services={services} />}
```

Alrededor de doce líneas. El archivo se mantiene cerca de sus 168 líneas actuales en vez de crecer a más de trescientas.

### Hook `useProjects`

Separado de `useMonitor` a propósito. `useMonitor` abre el socket y hace el redirect al login; `useProjects` solo mueve datos.

Expone: `projects`, `users`, `loading`, `error`, `reload`, `addProject`, `updateProject`, `removeProject`.

Reusa el mismo patrón de `authFetch` de `useMonitor`: lee el token de `localStorage` bajo la llave `monitor_token` y lo manda en el header `Authorization`. El backend todavía no lo exige, pero el frontend lo manda de todas formas, para que activar el guard más adelante no requiera tocar el hook.

Sin socket. Tras un `POST` o un `PATCH` exitoso, el estado local se actualiza con el objeto que devuelve la respuesta.

### Pestaña

Botón con el icono `FolderKanban` de `lucide-react` y un badge con el conteo de proyectos actuales, el mismo patrón visual del badge de Alertas.

Tres secciones colapsables. Actuales abierta por defecto; Futuros y Pasados cerradas.

### Tarjeta de proyecto

Reusa las clases de las tarjetas de servicio: `bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-red-700`.

Muestra el nombre, una pastilla de estado, el nombre del responsable, una barra de progreso con su porcentaje, y los servicios ligados como chips. Cada chip lleva un punto de color con el estado en vivo de ese servicio. Ese dato ya viene en el arreglo `services` que el dashboard tiene en memoria y se pasa por prop, así que no hay petición adicional.

A la derecha, botones de editar y borrar, siguiendo el `Trash2` de las tarjetas de servicio.

Colores de estado, dentro de la paleta que la app ya usa:

| Estado | Clases |
|---|---|
| `planificado` | `bg-gray-800 text-gray-300` |
| `en_curso` | `bg-blue-900 text-blue-300` |
| `en_pausa` | `bg-yellow-900 text-yellow-300` |
| `terminado` | `bg-green-900 text-green-300` |
| `cancelado` | `bg-red-900 text-red-300` |

La barra de progreso usa el mismo criterio de tres cortes que ya aplica el uptime en el dashboard: 67 o más en verde, 34 o más en amarillo, por debajo en rojo.

### Modal de crear y editar

Un solo modal cubre las dos operaciones, igual que el de Agregar servicio: `fixed inset-0 bg-black bg-opacity-70`.

Campos: nombre (texto), descripción (`textarea`), estado (`select` con los cinco valores), progreso (`input type="range"` con el número al lado), responsable (`select` poblado desde `users`), y servicios ligados (lista de checkboxes construida desde la prop `services`).

## Manejo de errores

### Backend

| Caso | Comportamiento |
|---|---|
| `projects.json` ausente | Arranca con lista vacía |
| `projects.json` corrupto | `try/catch` sobre el `JSON.parse`, registra con `Logger` y arranca con lista vacía. No tumba el proceso. |
| Validación fallida | `BadRequestException` con mensaje en español |
| `serviceIds` con ids muertos | Se descartan en silencio |
| `GET /:id` con id inexistente | Devuelve `null` |
| `writeFileSync` falla | Se registra con `Logger` y el error propaga como 500 |

El `try/catch` sobre el `JSON.parse` es una mejora dirigida: `services.service.ts` hoy revienta el arranque del backend si `services.json` tiene un JSON inválido. Este diseño no corrige ese archivo, solo evita repetir el fallo en el nuevo.

### Frontend

`useProjects` expone un estado `error`. Cuando la carga falla, la pestaña muestra un banner rojo con el texto "No se pudo cargar los proyectos" y un botón de reintentar que llama a `reload`.

Esto se aparta a propósito del `.catch(() => {})` de `useMonitor`, que descarta el fallo en silencio y deja la pantalla vacía sin explicarle nada al usuario.

## Pruebas

### Backend

Jest ya está configurado en `apps/backend/package.json` con `rootDir: src` y `testRegex: .*\.spec\.ts$`.

El trabajo se hace por desarrollo guiado por pruebas: cada prueba se escribe y se ve fallar antes de escribir el código que la satisface.

`projects.service.spec.ts`, con `fs`, `ServicesService` y `AuthService` simulados:

1. Archivo ausente: `getAll()` devuelve lista vacía.
2. JSON corrupto: `getAll()` devuelve lista vacía y la carga no lanza.
3. `name` vacío: `add` lanza `BadRequestException`.
4. `assignedTo` desconocido: `add` lanza `BadRequestException`.
5. `status` inválido: `add` lanza `BadRequestException`.
6. `status` ausente: el proyecto queda en `planificado`.
7. `progress` de 150 queda en 100; de -5 queda en 0; de 33.6 queda en 34.
8. `serviceIds` con un id inexistente: ese id se filtra y los válidos se conservan.
9. `update` con un id inexistente: devuelve `null`.
10. `remove` con un id inexistente: devuelve `{ ok: false }`.
11. Tras `add`, el proyecto aparece en `getAll()` y el guardado se ejecutó.

### Frontend

`apps/frontend/package.json` no tiene jest, ni vitest, ni testing-library, ni un script `test`. No hay forma de correr pruebas automatizadas del frontend hoy, y montar un arnés queda fuera de este trabajo.

La verificación del frontend es manual:

1. `pnpm run build` en `apps/frontend` compila sin errores de TypeScript.
2. La pestaña Proyectos aparece en tercer lugar, después de Alertas.
3. Crear un proyecto con dos servicios ligados y estado `en_curso`: aparece bajo Actuales.
4. Los chips de servicio muestran el punto de color que corresponde al estado real en el dashboard.
5. Cambiar el progreso a 100 y el estado a `terminado`: el proyecto pasa a Pasados.
6. Borrar un proyecto: desaparece y no reaparece al recargar la página.
7. Apagar el backend y recargar: aparece el banner de error, no una pantalla vacía.

### Comandos de verificación

```bash
cd apps/backend  && pnpm test && pnpm run build
cd apps/frontend && pnpm run build
```

Ambos se ejecutan antes de empezar a escribir código, para establecer una línea base. Si alguno ya falla en el estado actual del repositorio, se reporta antes de continuar, para no confundir una rotura previa con una introducida por este trabajo.

## Deuda registrada, no resuelta

Estos puntos se conocen y se dejan fuera del alcance por decisión explícita.

1. **Las rutas nuevas no exigen token.** `/api/projects` y `/api/auth/users` quedan públicas, consistentes con `services` y `monitor`, que tampoco tienen guard. En consecuencia, `GET /api/auth/users` expone nombres, correos y departamentos del personal a cualquiera que alcance el puerto 4000. El usuario tomó esta decisión para mantener la consistencia con el backend actual.

2. **`JwtStrategy` sigue sin usarse.** Ningún controlador del backend aplica `@UseGuards(AuthGuard('jwt'))`. El login emite un token válido que nada verifica después.

3. **Los dos archivos de datos dependen del directorio de arranque.** `services.json` usa `"./services.json"` y `projects.json` usa `path.join(process.cwd(), ...)`, que resuelve al mismo sitio. Arrancar el backend desde otra carpeta crea archivos de datos nuevos y vacíos para ambos.

4. **Las credenciales locales siguen en el repositorio.** `auth.service.ts` contiene cinco usuarios con la contraseña en texto plano. El endpoint nuevo expone los datos de esos usuarios pero no la contraseña.
