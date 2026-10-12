# Apartado Proyectos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una tercera pestaña Proyectos al dashboard de MonitoreoApp ProDominicana, para registrar proyectos ligados a los servicios monitoreados, con un responsable y un porcentaje de progreso manual.

**Architecture:** Módulo NestJS nuevo `projects` que persiste en un archivo JSON, espejo del patrón que `services` ya usa en este repositorio. El frontend añade un hook y un componente de pestaña; `app/page.tsx` solo los conecta. La agrupación en actuales, futuros y pasados se deriva del estado del proyecto, sin fechas.

**Tech Stack:** NestJS 11, TypeScript 5, Jest 30 con ts-jest, Next.js 16 con App Router, React 19, Tailwind CSS 4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-12-proyectos-design.md`

## Global Constraints

- No se añade ninguna dependencia nueva, ni en `apps/backend` ni en `apps/frontend`. `class-validator` sigue sin instalarse; toda validación es manual.
- `node_modules` está instalado por pnpm de Windows y sus enlaces no resuelven desde WSL. Todo comando de prueba o de build se ejecuta a través de `cmd.exe /c "..."` desde WSL, o directamente en PowerShell desde Windows. Correr `npx jest` desde WSL falla con `Module ts-jest in the transform option was not found`.
- Línea base verificada antes de empezar, en el commit de arranque: `jest` 1 prueba pasa, `nest build` exit 0, `next build` exit 0. Cualquier fallo nuevo es atribuible a este trabajo.
- Ninguna ruta lleva `@UseGuards(AuthGuard('jwt'))`. Decisión del usuario, para mantener consistencia con `services` y `monitor`, que tampoco lo tienen.
- Los textos de la interfaz y los mensajes de error van en español, sin tildes en los mensajes del backend, igual que los mensajes que ya existen en `auth.service.ts` (`"Credenciales incorrectas"`).
- Los nombres de estado se guardan en minúsculas con guion bajo: `planificado`, `en_curso`, `en_pausa`, `terminado`, `cancelado`.
- El frontend manda siempre el header `Authorization` con el token de `localStorage` bajo la llave `monitor_token`, aunque el backend todavía no lo exija.
- Las clases de Tailwind se reusan de las tarjetas de servicio existentes en `app/page.tsx`: `bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-red-700`.

## Review Focus

Cinco entradas que el spec implica pero que su lista de pruebas no ejercita. Cada línea tiene su prueba añadida a la tarea que posee el código.

1. **`progress` que no es un número** (`"abc"`, `null`, un objeto). `Math.round(NaN)` da `NaN`, `JSON.stringify` lo convierte en `null`, y el proyecto queda con un progreso corrupto en disco para siempre. Esperado: rechazar con 400. Prueba en la Tarea 3.
2. **`serviceIds` que no es un arreglo** (llega como número o cadena desde un cliente mal escrito). `.filter` sobre un número lanza `TypeError` y la ruta responde 500. Esperado: tratarlo como lista vacía. Prueba en la Tarea 3.
3. **`PATCH` que no revalida.** El spec describe la validación sin decir que aplica también al update. Un `PATCH` con `assignedTo: "nadie"` o `status: "inventado"` corrompería el registro. Esperado: el update valida con las mismas reglas que el create. Prueba en la Tarea 3.
4. **`name` con solo espacios** (`"   "`). Pasa un chequeo de cadena vacía ingenuo y crea un proyecto sin nombre visible en la lista. Esperado: rechazar con 400. Prueba en la Tarea 3.
5. **`id` enviado en el cuerpo del `POST`.** Un cliente que mande `{ "id": 1, ... }` podría colisionar con un proyecto existente. Esperado: el `id` del cuerpo se ignora, el servidor siempre genera el suyo. Prueba en la Tarea 3.

Además, `Date.now()` como generador de id colisiona si se crean dos proyectos en el mismo milisegundo. La Tarea 3 lo resuelve con un bucle de incremento y su propia prueba.

---

## Estructura de archivos

### Backend — `apps/backend/`

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/projects/project.interface.ts` | Crear | Tipos `Project`, `ProjectStatus`, constante `PROJECT_STATUSES`. Sin lógica. |
| `src/projects/projects.service.ts` | Crear | Persistencia, CRUD y toda la validación. |
| `src/projects/projects.service.spec.ts` | Crear | Pruebas unitarias del servicio. |
| `src/projects/projects.controller.ts` | Crear | Traduce HTTP a llamadas del servicio. Sin lógica. |
| `src/projects/projects.module.ts` | Crear | Declara el módulo, importa `ServicesModule` y `AuthModule`. |
| `src/auth/auth.service.spec.ts` | Crear | Pruebas de `listUsers()`. |
| `src/auth/auth.service.ts` | Modificar | Método `listUsers()`. |
| `src/auth/auth.controller.ts` | Modificar | Ruta `GET users`. |
| `src/auth/auth.module.ts` | Modificar | Exporta `AuthService`. |
| `src/app.module.ts` | Modificar | Registra `ProjectsModule`. |

### Frontend — `apps/frontend/`

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `hooks/useProjects.ts` | Crear | Carga, CRUD y estado de error. Sin JSX. |
| `components/ProjectsTab.tsx` | Crear | Las tres agrupaciones, las tarjetas y el modal. |
| `app/page.tsx` | Modificar | Botón de pestaña y montaje del componente. |

### Raíz

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `.gitignore` | Modificar | Ignora `apps/backend/projects.json`. |

### Desviación del spec, registrada

El spec escribió el montaje como `<ProjectsTab services={services} />`, con el hook dentro del componente. El plan mueve la llamada a `useProjects()` a `app/page.tsx` y pasa el resultado por props con `{...projectsState}`.

Razón: el badge de conteo del botón de pestaña vive en `page.tsx` y necesita la lista de proyectos. Con el hook dentro del componente, `page.tsx` tendría que llamar `useProjects()` por su cuenta y el backend recibiría las peticiones dos veces. El tipo de props se deriva con `ReturnType<typeof useProjects>`, así que la lista de props no se repite a mano y el montaje sigue siendo una línea.

---

## Task 1: Lista de usuarios asignables

**Files:**
- Modify: `apps/backend/src/auth/auth.service.ts`
- Modify: `apps/backend/src/auth/auth.controller.ts`
- Modify: `apps/backend/src/auth/auth.module.ts`
- Test: `apps/backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores. `LOCAL_USERS`, la constante privada que ya existe en `auth.service.ts:5`.
- Produces: `AuthService.listUsers(): { username: string; name: string; email: string; department: string }[]`. La Tarea 3 la inyecta para validar `assignedTo`. La Tarea 5 consume la ruta `GET /api/auth/users`.

- [ ] **Step 1: Escribir la prueba que falla**

Crear `apps/backend/src/auth/auth.service.spec.ts`:

```ts
import { AuthService } from "./auth.service";

describe("AuthService.listUsers", () => {
  const jwtStub = { sign: () => "token-de-prueba" } as any;

  it("devuelve los cinco usuarios locales", () => {
    const service = new AuthService(jwtStub);
    const users = service.listUsers();
    expect(users).toHaveLength(5);
    expect(users.map((u) => u.username).sort()).toEqual([
      "admin",
      "edwinmercedes",
      "josegarcia",
      "josemontedeoca",
      "wiltonpatrocino",
    ]);
  });

  it("nunca expone el campo password", () => {
    const service = new AuthService(jwtStub);
    for (const user of service.listUsers()) {
      expect(user).not.toHaveProperty("password");
    }
  });

  it("incluye nombre, correo y departamento de cada usuario", () => {
    const service = new AuthService(jwtStub);
    const josegarcia = service.listUsers().find((u) => u.username === "josegarcia");
    expect(josegarcia).toEqual({
      username: "josegarcia",
      name: "Jose Garcia",
      email: "josegarcia@prodominicana.gob.do",
      department: "TI",
    });
  });
});
```

- [ ] **Step 2: Correr la prueba y verificar que falla**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest auth.service"`
Expected: FAIL con `service.listUsers is not a function`.

- [ ] **Step 3: Implementar `listUsers()`**

En `apps/backend/src/auth/auth.service.ts`, añadir este método público dentro de la clase `AuthService`, justo después del constructor y antes de `login`:

```ts
  listUsers() {
    return Object.entries(LOCAL_USERS).map(([username, user]) => ({
      username,
      name: user.name,
      email: user.email,
      department: user.department,
    }));
  }
```

El campo `password` no se copia. `LOCAL_USERS` no se mueve ni se duplica.

- [ ] **Step 4: Correr la prueba y verificar que pasa**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest auth.service"`
Expected: PASS, 3 pruebas.

- [ ] **Step 5: Exponer la ruta HTTP**

Reemplazar el contenido completo de `apps/backend/src/auth/auth.controller.ts`:

```ts
import { Controller, Post, Get, Body, HttpCode } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @Get("users")
  listUsers() {
    return this.auth.listUsers();
  }
}
```

- [ ] **Step 6: Exportar `AuthService` del módulo**

En `apps/backend/src/auth/auth.module.ts`, cambiar la línea de exports:

```ts
  exports: [JwtModule, AuthService],
```

Sin este cambio, la Tarea 3 no puede inyectar `AuthService` en `ProjectsService`.

- [ ] **Step 7: Verificar que compila**

Run: `cd apps/backend && cmd.exe /c "npx --no-install nest build"`
Expected: exit 0, sin salida.

- [ ] **Step 8: Verificar la ruta a mano**

Arrancar el backend en una terminal: `cd apps/backend && cmd.exe /c "npx --no-install nest start"`
En otra: `curl http://localhost:4000/api/auth/users`
Expected: un arreglo JSON de 5 objetos, ninguno con la llave `password`.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/auth/
git commit -m "feat(auth): expose assignable users via GET /api/auth/users"
```

---

## Task 2: Modelo y persistencia de proyectos

**Files:**
- Create: `apps/backend/src/projects/project.interface.ts`
- Create: `apps/backend/src/projects/projects.service.ts`
- Test: `apps/backend/src/projects/projects.service.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `AuthService.listUsers()` de la Tarea 1. `ServicesService.getAll(): MonitorService[]`, que `ServicesModule` ya exporta.
- Produces: el tipo `Project`, el tipo `ProjectStatus`, la constante `PROJECT_STATUSES`, la clase `ProjectsService` con `onModuleInit()`, `getAll(): Project[]` y `getOne(id: number): Project | null`. La Tarea 3 añade los métodos de escritura a esta misma clase.

- [ ] **Step 1: Crear los tipos**

Crear `apps/backend/src/projects/project.interface.ts`:

```ts
export type ProjectStatus =
  | "planificado"
  | "en_curso"
  | "en_pausa"
  | "terminado"
  | "cancelado";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "planificado",
  "en_curso",
  "en_pausa",
  "terminado",
  "cancelado",
];

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

export interface ProjectInput {
  name?: unknown;
  description?: unknown;
  serviceIds?: unknown;
  assignedTo?: unknown;
  status?: unknown;
  progress?: unknown;
}
```

`ProjectInput` usa `unknown` a propósito. El cuerpo de una petición HTTP no está tipado en tiempo de ejecución, y declararlo `string` o `number` mentiría: NestJS no valida nada sin `class-validator`, que este trabajo no instala. Los métodos de limpieza de la Tarea 3 estrechan cada campo.

- [ ] **Step 2: Escribir las pruebas que fallan**

Crear `apps/backend/src/projects/projects.service.spec.ts`:

```ts
import * as fs from "fs";
import { ProjectsService } from "./projects.service";

jest.mock("fs");

const mockedFs = fs as jest.Mocked<typeof fs>;

const servicesStub = {
  getAll: () => [{ id: 1 }, { id: 2 }, { id: 3 }],
} as any;

const authStub = {
  listUsers: () => [
    { username: "josegarcia", name: "Jose Garcia", email: "", department: "TI" },
    { username: "admin", name: "Administrador Sistema", email: "", department: "TI" },
  ],
} as any;

function makeService(fileContents?: string): ProjectsService {
  mockedFs.existsSync.mockReturnValue(fileContents !== undefined);
  mockedFs.readFileSync.mockReturnValue((fileContents ?? "[]") as any);
  mockedFs.writeFileSync.mockImplementation(() => undefined);
  const service = new ProjectsService(servicesStub, authStub);
  service.onModuleInit();
  return service;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProjectsService, carga", () => {
  it("arranca con la lista vacia cuando el archivo no existe", () => {
    const service = makeService(undefined);
    expect(service.getAll()).toEqual([]);
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });

  it("arranca con la lista vacia cuando el JSON esta corrupto, sin lanzar", () => {
    expect(() => makeService("{ esto no es json")).not.toThrow();
    const service = makeService("{ esto no es json");
    expect(service.getAll()).toEqual([]);
  });

  it("arranca con la lista vacia cuando el JSON es valido pero no es un arreglo", () => {
    const service = makeService('{"proyectos":[]}');
    expect(service.getAll()).toEqual([]);
  });

  it("carga los proyectos guardados", () => {
    const guardado = [
      {
        id: 10,
        name: "Migracion de correo",
        description: null,
        serviceIds: [1],
        assignedTo: "josegarcia",
        status: "en_curso",
        progress: 40,
        createdAt: "2026-10-01T12:00:00.000Z",
      },
    ];
    const service = makeService(JSON.stringify(guardado));
    expect(service.getAll()).toEqual(guardado);
  });
});

describe("ProjectsService.getOne", () => {
  const guardado = JSON.stringify([
    {
      id: 10,
      name: "Migracion de correo",
      description: null,
      serviceIds: [],
      assignedTo: "josegarcia",
      status: "en_curso",
      progress: 40,
      createdAt: "2026-10-01T12:00:00.000Z",
    },
  ]);

  it("devuelve el proyecto cuando el id existe", () => {
    expect(makeService(guardado).getOne(10)?.name).toBe("Migracion de correo");
  });

  it("devuelve null cuando el id no existe", () => {
    expect(makeService(guardado).getOne(999)).toBeNull();
  });
});
```

- [ ] **Step 3: Correr las pruebas y verificar que fallan**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest projects.service"`
Expected: FAIL con `Cannot find module './projects.service'`.

- [ ] **Step 4: Implementar la carga y la lectura**

Crear `apps/backend/src/projects/projects.service.ts`:

```ts
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { AuthService } from "../auth/auth.service";
import { ServicesService } from "../services/services.service";
import { Project } from "./project.interface";

const DB_FILE = path.join(process.cwd(), "projects.json");

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger("ProjectsService");
  private projects: Project[] = [];

  constructor(
    private readonly services: ServicesService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit() {
    this.load();
  }

  private load() {
    if (!fs.existsSync(DB_FILE)) {
      this.projects = [];
      return;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      this.projects = Array.isArray(parsed) ? parsed : [];
      if (!Array.isArray(parsed)) {
        this.logger.error("projects.json no contiene un arreglo, se arranca con la lista vacia");
      }
    } catch (e: any) {
      this.logger.error("projects.json ilegible (" + e.message + "), se arranca con la lista vacia");
      this.projects = [];
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.projects, null, 2));
    } catch (e: any) {
      this.logger.error("No se pudo guardar projects.json: " + e.message);
      throw e;
    }
  }

  getAll(): Project[] {
    return this.projects;
  }

  getOne(id: number): Project | null {
    return this.projects.find((p) => p.id === id) ?? null;
  }
}
```

`DB_FILE` usa `path.join(process.cwd(), ...)`. **Corregido el 2026-10-12:** este párrafo afirmaba que así no se repetía el fallo de `services.service.ts:5`. Es falso: `fs` resuelve `"./services.json"` contra `process.cwd()` igual, así que ambos apuntan al mismo sitio y `projects.json` hereda la misma fragilidad. Lo único que gana es fijarse al importar.

El método `save` queda definido aquí aunque ninguna ruta lo llame todavía; la Tarea 3 lo usa. `tsc` no se queja de un método privado sin usar, pero ESLint podría. Si `pnpm run lint` marca `save` como no usado, se ignora: la Tarea 3 lo consume en el mismo trabajo.

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest projects.service"`
Expected: PASS, 6 pruebas.

- [ ] **Step 6: Ignorar el archivo de datos**

En `.gitignore`, bajo el comentario `# Data files`, la sección queda así:

```
# Data files
apps/backend/services.json
apps/backend/projects.json
```

- [ ] **Step 7: Verificar que compila**

Run: `cd apps/backend && cmd.exe /c "npx --no-install nest build"`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src/projects/ .gitignore
git commit -m "feat(projects): add Project model and file persistence"
```

---

## Task 3: Validación y escritura de proyectos

**Files:**
- Modify: `apps/backend/src/projects/projects.service.ts`
- Test: `apps/backend/src/projects/projects.service.spec.ts`

**Interfaces:**
- Consumes: `Project`, `ProjectStatus`, `PROJECT_STATUSES`, `ProjectInput` de la Tarea 2. `AuthService.listUsers()` de la Tarea 1. `ServicesService.getAll()`.
- Produces: `ProjectsService.add(input: ProjectInput): Project`, `ProjectsService.update(id: number, input: ProjectInput): Project | null`, `ProjectsService.remove(id: number): boolean`. La Tarea 4 las expone por HTTP.

- [ ] **Step 1: Escribir las pruebas que fallan**

Primero, añadir `BadRequestException` a los imports del inicio de `apps/backend/src/projects/projects.service.spec.ts`, junto a los que la Tarea 2 ya puso:

```ts
import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import { ProjectsService } from "./projects.service";
```

Un `import` después del primer `describe` es legal en un módulo ES, pero ESLint lo marca y el archivo se vuelve difícil de leer.

Luego, añadir al final del archivo:

```ts
const entradaValida = { name: "Rediseno de ProtalentHub", assignedTo: "josegarcia" };

describe("ProjectsService.add, validacion", () => {
  it("rechaza el nombre vacio", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, name: "" })).toThrow(BadRequestException);
  });

  it("rechaza el nombre de solo espacios", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, name: "   " })).toThrow(BadRequestException);
  });

  it("rechaza el nombre ausente", () => {
    const service = makeService(undefined);
    expect(() => service.add({ assignedTo: "josegarcia" })).toThrow(BadRequestException);
  });

  it("recorta los espacios del nombre", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, name: "  Portal nuevo  " }).name).toBe("Portal nuevo");
  });

  it("rechaza un responsable desconocido", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, assignedTo: "nadie" })).toThrow(BadRequestException);
  });

  it("rechaza el responsable ausente", () => {
    const service = makeService(undefined);
    expect(() => service.add({ name: "Portal nuevo" })).toThrow(BadRequestException);
  });

  it("rechaza un estado invalido", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, status: "inventado" })).toThrow(BadRequestException);
  });

  it("deja el estado en planificado cuando no se envia", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).status).toBe("planificado");
  });

  it("acepta los cinco estados validos", () => {
    const service = makeService(undefined);
    for (const status of ["planificado", "en_curso", "en_pausa", "terminado", "cancelado"]) {
      expect(service.add({ ...entradaValida, status }).status).toBe(status);
    }
  });
});

describe("ProjectsService.add, progreso", () => {
  it("deja el progreso en 0 cuando no se envia", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).progress).toBe(0);
  });

  it("recorta 150 a 100", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, progress: 150 }).progress).toBe(100);
  });

  it("recorta -5 a 0", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, progress: -5 }).progress).toBe(0);
  });

  it("redondea 33.6 a 34", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, progress: 33.6 }).progress).toBe(34);
  });

  it("rechaza un progreso que no es un numero", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, progress: "abc" })).toThrow(BadRequestException);
    expect(() => service.add({ ...entradaValida, progress: {} })).toThrow(BadRequestException);
    expect(() => service.add({ ...entradaValida, progress: null })).toThrow(BadRequestException);
  });
});

describe("ProjectsService.add, servicios ligados", () => {
  it("conserva los ids de servicio que existen", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, serviceIds: [1, 3] }).serviceIds).toEqual([1, 3]);
  });

  it("descarta los ids de servicio que no existen, sin lanzar", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, serviceIds: [1, 999, 2] }).serviceIds).toEqual([1, 2]);
  });

  it("trata un serviceIds que no es arreglo como lista vacia, sin lanzar", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, serviceIds: 1 }).serviceIds).toEqual([]);
    expect(service.add({ ...entradaValida, serviceIds: "1,2" }).serviceIds).toEqual([]);
  });

  it("deja serviceIds vacio cuando no se envia", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).serviceIds).toEqual([]);
  });
});

describe("ProjectsService.add, campos derivados", () => {
  it("ignora un id enviado en el cuerpo y genera el suyo", () => {
    const service = makeService(
      JSON.stringify([
        {
          id: 10,
          name: "Existente",
          description: null,
          serviceIds: [],
          assignedTo: "josegarcia",
          status: "en_curso",
          progress: 0,
          createdAt: "2026-10-01T12:00:00.000Z",
        },
      ]),
    );
    const creado = service.add({ ...entradaValida, id: 10 } as any);
    expect(creado.id).not.toBe(10);
    expect(service.getAll()).toHaveLength(2);
  });

  it("nunca repite un id, incluso en el mismo milisegundo", () => {
    const service = makeService(undefined);
    const ahora = Date.now();
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(ahora);
    const ids = [service.add(entradaValida).id, service.add(entradaValida).id, service.add(entradaValida).id];
    nowSpy.mockRestore();
    expect(new Set(ids).size).toBe(3);
  });

  it("deja la descripcion en null cuando no se envia o esta vacia", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).description).toBeNull();
    expect(service.add({ ...entradaValida, description: "   " }).description).toBeNull();
  });

  it("recorta la descripcion cuando viene con texto", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, description: "  Dos fases  " }).description).toBe("Dos fases");
  });

  it("guarda createdAt como cadena ISO", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("persiste el proyecto creado", () => {
    const service = makeService(undefined);
    const creado = service.add(entradaValida);
    expect(service.getAll()).toContain(creado);
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
  });
});

describe("ProjectsService.update", () => {
  function conUnProyecto() {
    const service = makeService(undefined);
    const creado = service.add({ ...entradaValida, status: "en_curso", progress: 20 });
    return { service, id: creado.id };
  }

  it("devuelve null cuando el id no existe", () => {
    const { service } = conUnProyecto();
    expect(service.update(999, { progress: 50 })).toBeNull();
  });

  it("solo cambia los campos presentes", () => {
    const { service, id } = conUnProyecto();
    const actualizado = service.update(id, { progress: 70 });
    expect(actualizado?.progress).toBe(70);
    expect(actualizado?.name).toBe("Rediseno de ProtalentHub");
    expect(actualizado?.status).toBe("en_curso");
  });

  it("rechaza un responsable desconocido en el update", () => {
    const { service, id } = conUnProyecto();
    expect(() => service.update(id, { assignedTo: "nadie" })).toThrow(BadRequestException);
  });

  it("rechaza un estado invalido en el update", () => {
    const { service, id } = conUnProyecto();
    expect(() => service.update(id, { status: "inventado" })).toThrow(BadRequestException);
  });

  it("rechaza un nombre vacio en el update", () => {
    const { service, id } = conUnProyecto();
    expect(() => service.update(id, { name: "   " })).toThrow(BadRequestException);
  });

  it("rechaza un progreso no numerico en el update", () => {
    const { service, id } = conUnProyecto();
    expect(() => service.update(id, { progress: "abc" })).toThrow(BadRequestException);
  });

  it("recorta el progreso fuera de rango en el update", () => {
    const { service, id } = conUnProyecto();
    expect(service.update(id, { progress: 500 })?.progress).toBe(100);
  });

  it("no cambia nada cuando la validacion falla", () => {
    const { service, id } = conUnProyecto();
    expect(() => service.update(id, { progress: 90, status: "inventado" })).toThrow(BadRequestException);
    expect(service.getOne(id)?.progress).toBe(20);
  });

  it("no permite cambiar el id ni createdAt", () => {
    const { service, id } = conUnProyecto();
    const createdAtOriginal = service.getOne(id)!.createdAt;
    const actualizado = service.update(id, { id: 777, createdAt: "1999-01-01T00:00:00.000Z" } as any);
    expect(actualizado?.id).toBe(id);
    expect(actualizado?.createdAt).toBe(createdAtOriginal);
  });
});

describe("ProjectsService.remove", () => {
  it("devuelve true y borra el proyecto cuando el id existe", () => {
    const service = makeService(undefined);
    const creado = service.add(entradaValida);
    expect(service.remove(creado.id)).toBe(true);
    expect(service.getAll()).toEqual([]);
  });

  it("devuelve false cuando el id no existe", () => {
    const service = makeService(undefined);
    expect(service.remove(999)).toBe(false);
  });

  it("no guarda cuando no borro nada", () => {
    const service = makeService(undefined);
    jest.clearAllMocks();
    service.remove(999);
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });
});
```

La prueba `"no cambia nada cuando la validacion falla"` fija un orden de implementación concreto: el update valida todos los campos antes de asignar ninguno. Un update que asigne campo por campo dejaría el proyecto a medio cambiar cuando el segundo campo es inválido.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest projects.service"`
Expected: FAIL con `service.add is not a function`.

- [ ] **Step 3: Implementar la escritura y la validación**

En `apps/backend/src/projects/projects.service.ts`, cambiar la línea de imports de `@nestjs/common` y la de `./project.interface`:

```ts
import { BadRequestException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
```

```ts
import { PROJECT_STATUSES, Project, ProjectInput, ProjectStatus } from "./project.interface";
```

Y añadir estos métodos dentro de la clase, después de `getOne`:

```ts
  add(input: ProjectInput): Project {
    const project: Project = {
      id: this.nextId(),
      name: this.cleanName(input.name),
      description: this.cleanDescription(input.description),
      serviceIds: this.cleanServiceIds(input.serviceIds),
      assignedTo: this.cleanAssignedTo(input.assignedTo),
      status: input.status === undefined ? "planificado" : this.cleanStatus(input.status),
      progress: input.progress === undefined ? 0 : this.cleanProgress(input.progress),
      createdAt: new Date().toISOString(),
    };
    this.projects.push(project);
    this.save();
    return project;
  }

  update(id: number, input: ProjectInput): Project | null {
    const project = this.getOne(id);
    if (!project) return null;

    // Se valida todo antes de asignar nada, para que un campo invalido
    // no deje el proyecto a medio cambiar.
    const changes: Partial<Project> = {};
    if (input.name !== undefined) changes.name = this.cleanName(input.name);
    if (input.description !== undefined) changes.description = this.cleanDescription(input.description);
    if (input.serviceIds !== undefined) changes.serviceIds = this.cleanServiceIds(input.serviceIds);
    if (input.assignedTo !== undefined) changes.assignedTo = this.cleanAssignedTo(input.assignedTo);
    if (input.status !== undefined) changes.status = this.cleanStatus(input.status);
    if (input.progress !== undefined) changes.progress = this.cleanProgress(input.progress);

    Object.assign(project, changes);
    this.save();
    return project;
  }

  remove(id: number): boolean {
    const before = this.projects.length;
    this.projects = this.projects.filter((p) => p.id !== id);
    if (this.projects.length === before) return false;
    this.save();
    return true;
  }

  private nextId(): number {
    let id = Date.now();
    while (this.projects.some((p) => p.id === id)) id++;
    return id;
  }

  private cleanName(value: unknown): string {
    const name = typeof value === "string" ? value.trim() : "";
    if (name === "") {
      throw new BadRequestException("El nombre del proyecto es obligatorio");
    }
    return name;
  }

  private cleanDescription(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const description = value.trim();
    return description === "" ? null : description;
  }

  private cleanStatus(value: unknown): ProjectStatus {
    if (!PROJECT_STATUSES.includes(value as ProjectStatus)) {
      throw new BadRequestException("Estado de proyecto invalido");
    }
    return value as ProjectStatus;
  }

  private cleanProgress(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new BadRequestException("El progreso debe ser un numero entre 0 y 100");
    }
    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private cleanAssignedTo(value: unknown): string {
    const username = typeof value === "string" ? value.trim() : "";
    const exists = this.auth.listUsers().some((u) => u.username === username);
    if (!exists) {
      throw new BadRequestException("Responsable no encontrado");
    }
    return username;
  }

  private cleanServiceIds(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    const valid = new Set(this.services.getAll().map((s) => s.id));
    return value
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && valid.has(id));
  }
```

`cleanProgress` exige `typeof value === "number"` en vez de convertir con `Number(value)`. La conversión aceptaría `null` como 0, `""` como 0 y `true` como 1, y guardaría un progreso que nadie escribió. `Project.id` y `Project.createdAt` no tienen método de limpieza porque `update` solo copia las llaves de `changes`, así que un `id` o un `createdAt` en el cuerpo se descarta.

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest projects.service"`
Expected: PASS, 42 pruebas. (Las 6 de la Tarea 2 mas las 36 de esta.)

- [ ] **Step 5: Correr la suite completa**

Run: `cd apps/backend && cmd.exe /c "npx --no-install jest"`
Expected: PASS, 3 suites, 46 pruebas. (1 de `app.controller`, 3 de `auth.service`, 42 de `projects.service`.)

- [ ] **Step 6: Verificar que compila**

Run: `cd apps/backend && cmd.exe /c "npx --no-install nest build"`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/projects/
git commit -m "feat(projects): add validated create, update and delete"
```

---

## Task 4: Rutas HTTP de proyectos

**Files:**
- Create: `apps/backend/src/projects/projects.controller.ts`
- Create: `apps/backend/src/projects/projects.module.ts`
- Modify: `apps/backend/src/app.module.ts`

**Interfaces:**
- Consumes: `ProjectsService` completo, de las Tareas 2 y 3. `ServicesModule` y `AuthModule`.
- Produces: las rutas `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`. La Tarea 5 las consume.

- [ ] **Step 1: Crear el controlador**

Crear `apps/backend/src/projects/projects.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ProjectInput } from "./project.interface";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  getAll() {
    return this.projects.getAll();
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.projects.getOne(Number(id));
  }

  @Post()
  create(@Body() body: ProjectInput) {
    return this.projects.add(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: ProjectInput) {
    return this.projects.update(Number(id), body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return { ok: this.projects.remove(Number(id)) };
  }
}
```

Sin `@UseGuards`. El controlador no valida: toda la validación vive en el servicio, y las `BadRequestException` que lanza se convierten en 400 por el manejador de excepciones de NestJS.

- [ ] **Step 2: Crear el módulo**

Crear `apps/backend/src/projects/projects.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ServicesModule } from "../services/services.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [ServicesModule, AuthModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
```

- [ ] **Step 3: Registrar el módulo**

En `apps/backend/src/app.module.ts`, añadir el import arriba:

```ts
import { ProjectsModule } from "./projects/projects.module";
```

Y añadir `ProjectsModule` al arreglo `imports`, después de `ServicesModule`:

```ts
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ".env" }),
    ScheduleModule.forRoot(),
    AuthModule,
    ServicesModule,
    ProjectsModule,
    MonitorModule,
    NotificationsModule,
    GatewayModule,
  ],
```

- [ ] **Step 4: Verificar que compila y que el contenedor arranca**

Run: `cd apps/backend && cmd.exe /c "npx --no-install nest build"`
Expected: exit 0.

Un error de inyección de dependencias no lo detecta `tsc`, solo el arranque. Arrancar: `cd apps/backend && cmd.exe /c "npx --no-install nest start"`
Expected: el log lista `ProjectsController {/api/projects}` con sus cinco rutas, y termina con `MonitoreoApp ProDominicana corriendo en http://localhost:4000`. Si falta el export de `AuthService` de la Tarea 1, aquí sale `Nest can't resolve dependencies of the ProjectsService`.

- [ ] **Step 5: Verificar las rutas a mano**

Con el backend corriendo:

```bash
# Lista vacia al inicio
curl http://localhost:4000/api/projects

# Crear
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Rediseno de ProtalentHub","assignedTo":"josegarcia","status":"en_curso","progress":35,"serviceIds":[2,3]}'

# Responsable invalido, espera 400
curl -i -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"Prueba","assignedTo":"nadie"}'
```

Expected: la lista arranca en `[]`; el create devuelve el proyecto con un `id` numérico y `createdAt`; el responsable inválido devuelve `400` con `"Responsable no encontrado"`. El archivo `apps/backend/projects.json` aparece en disco tras el primer create.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/projects/ apps/backend/src/app.module.ts
git commit -m "feat(projects): expose REST routes and register module"
```

---

## Task 5: Hook y componente de la pestaña

**Files:**
- Create: `apps/frontend/hooks/useProjects.ts`
- Create: `apps/frontend/components/ProjectsTab.tsx`

**Interfaces:**
- Consumes: las rutas de la Tarea 4 y `GET /api/auth/users` de la Tarea 1. El tipo `MonitorService` que `hooks/useMonitor.ts` ya exporta.
- Produces: `useProjects()`, que devuelve `{ projects, users, loading, error, reload, addProject, updateProject, removeProject }`. El componente `ProjectsTab`, cuyas props son `ReturnType<typeof useProjects> & { services: MonitorService[] }`. La Tarea 6 los monta.

**Nota sobre pruebas:** `apps/frontend/package.json` no tiene jest, ni vitest, ni testing-library, ni un script `test`. No hay forma de correr pruebas automatizadas del frontend, y montar un arnés queda fuera de este trabajo. La verificación de esta tarea es `next build`, que corre el chequeo de TypeScript. La verificación de comportamiento está en la Tarea 6, que es cuando la pestaña se vuelve visible.

- [ ] **Step 1: Crear el hook**

Crear `apps/frontend/hooks/useProjects.ts`:

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ProjectStatus = 'planificado' | 'en_curso' | 'en_pausa' | 'terminado' | 'cancelado';

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

export interface AssignableUser {
  username: string;
  name: string;
  email: string;
  department: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  serviceIds: number[];
  assignedTo: string;
  status: ProjectStatus;
  progress: number;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    let token: string | null = null;
    try {
      token = localStorage.getItem('monitor_token');
    } catch {}
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    });
    if (!res.ok) {
      let message = 'HTTP ' + res.status;
      try {
        const body = await res.json();
        if (body?.message) message = String(body.message);
      } catch {}
      throw new Error(message);
    }
    return res;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [projectsRes, usersRes] = await Promise.all([
        authFetch(API + '/api/projects'),
        authFetch(API + '/api/auth/users'),
      ]);
      setProjects(await projectsRes.json());
      setUsers(await usersRes.json());
    } catch {
      setError('No se pudo cargar los proyectos');
    }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addProject = async (input: ProjectInput) => {
    const res = await authFetch(API + '/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const created: Project = await res.json();
    setProjects(prev => [...prev, created]);
  };

  const updateProject = async (id: number, input: ProjectInput) => {
    const res = await authFetch(API + '/api/projects/' + id, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    const saved: Project = await res.json();
    setProjects(prev => prev.map(p => (p.id === id ? saved : p)));
  };

  const removeProject = async (id: number) => {
    await authFetch(API + '/api/projects/' + id, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  return { projects, users, loading, error, reload, addProject, updateProject, removeProject };
}
```

`authFetch` lanza cuando la respuesta no es `ok` y propaga el `message` del backend, para que el modal pueda mostrar `"Responsable no encontrado"` en vez de un fallo genérico. Esto se aparta a propósito del `.catch(() => {})` de `useMonitor.ts:80-81`, que descarta el fallo en silencio.

- [ ] **Step 2: Verificar que el hook compila**

Run: `cd apps/frontend && cmd.exe /c "npx --no-install next build"`
Expected: exit 0. El hook todavía no se usa en ninguna parte, así que el build solo confirma que los tipos cierran.

- [ ] **Step 3: Crear el componente de la pestaña**

Crear `apps/frontend/components/ProjectsTab.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import type { MonitorService } from '../hooks/useMonitor';
import type { Project, ProjectInput, ProjectStatus, useProjects } from '../hooks/useProjects';

type ProjectsTabProps = ReturnType<typeof useProjects> & { services: MonitorService[] };

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  en_pausa: 'En pausa',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  planificado: 'bg-gray-800 text-gray-300',
  en_curso: 'bg-blue-900 text-blue-300',
  en_pausa: 'bg-yellow-900 text-yellow-300',
  terminado: 'bg-green-900 text-green-300',
  cancelado: 'bg-red-900 text-red-300',
};

const GROUPS: { key: string; label: string; statuses: ProjectStatus[] }[] = [
  { key: 'actuales', label: 'Actuales', statuses: ['en_curso', 'en_pausa'] },
  { key: 'futuros', label: 'Futuros', statuses: ['planificado'] },
  { key: 'pasados', label: 'Pasados', statuses: ['terminado', 'cancelado'] },
];

const EMPTY_FORM: ProjectInput = {
  name: '',
  description: '',
  serviceIds: [],
  assignedTo: '',
  status: 'planificado',
  progress: 0,
};

function progressBarClass(progress: number) {
  if (progress >= 67) return 'bg-green-500';
  if (progress >= 34) return 'bg-yellow-500';
  return 'bg-red-500';
}

function serviceDotClass(status: MonitorService['status'] | undefined) {
  if (status === 'up') return 'bg-green-500';
  if (status === 'down') return 'bg-red-500';
  return 'bg-gray-600';
}

export default function ProjectsTab({
  services,
  projects,
  users,
  loading,
  error,
  reload,
  addProject,
  updateProject,
  removeProject,
}: ProjectsTabProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    actuales: true,
    futuros: false,
    pasados: false,
  });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProjectInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const userName = (username: string) =>
    users.find(u => u.username === username)?.name ?? username;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, assignedTo: users[0]?.username ?? '' });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      description: project.description ?? '',
      serviceIds: project.serviceIds,
      assignedTo: project.assignedTo,
      status: project.status,
      progress: project.progress,
    });
    setFormError('');
    setShowForm(true);
  };

  const toggleServiceId = (id: number) => {
    setForm(prev => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter(s => s !== id)
        : [...prev.serviceIds, id],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('El nombre del proyecto es obligatorio');
      return;
    }
    if (!form.assignedTo) {
      setFormError('Selecciona un responsable');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId === null) await addProject(form);
      else await updateProject(editingId, form);
      setShowForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo guardar el proyecto');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">Cargando proyectos...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-950 border border-red-800 rounded-xl p-6 flex items-center justify-between">
        <p className="text-red-200">{error}</p>
        <button onClick={reload} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition">
          <Plus className="w-4 h-4" /> Nuevo proyecto
        </button>
      </div>

      {projects.length === 0 && (
        <div className="bg-gray-900 rounded-xl p-8 text-center text-gray-500">
          No hay proyectos registrados
        </div>
      )}

      {projects.length > 0 &&
        GROUPS.map(group => {
          const grouped = projects.filter(p => group.statuses.includes(p.status));
          const isOpen = openGroups[group.key];
          return (
            <div key={group.key} className="mb-4">
              <button
                onClick={() => setOpenGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                className="w-full flex items-center gap-2 text-left text-sm font-semibold text-gray-300 hover:text-white transition mb-2"
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {group.label}
                <span className="text-gray-500 font-normal">({grouped.length})</span>
              </button>

              {isOpen && grouped.length === 0 && (
                <p className="text-xs text-gray-600 pl-6 pb-2">Sin proyectos en este grupo</p>
              )}

              {isOpen &&
                grouped.map(project => (
                  <div key={project.id} className="bg-gray-900 rounded-xl p-5 border border-gray-800 hover:border-red-700 transition mb-3">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{project.name}</h3>
                        {project.description && (
                          <p className="text-xs text-gray-400 mt-1">{project.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Responsable: {userName(project.assignedTo)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_CLASS[project.status]}`}>
                          {STATUS_LABEL[project.status]}
                        </span>
                        <button onClick={() => openEdit(project)} className="text-gray-600 hover:text-white transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeProject(project.id)} className="text-gray-600 hover:text-red-400 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${progressBarClass(project.progress)}`} style={{ width: project.progress + '%' }} />
                      </div>
                      <span className="text-xs font-bold text-gray-300 w-10 text-right">{project.progress}%</span>
                    </div>

                    {project.serviceIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {project.serviceIds.map(id => {
                          const service = services.find(s => s.id === id);
                          return (
                            <span key={id} className="flex items-center gap-2 bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-lg border border-gray-700">
                              <span className={`w-2 h-2 rounded-full ${serviceDotClass(service?.status)}`} />
                              {service?.name ?? 'Servicio ' + id}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          );
        })}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-700 max-h-full overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">
              {editingId === null ? 'Nuevo proyecto' : 'Editar proyecto'}
            </h2>

            <div className="grid gap-3">
              <input
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-red-500"
                placeholder="Nombre del proyecto"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />

              <textarea
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-red-500 resize-none"
                rows={3}
                placeholder="Descripcion (opcional)"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />

              <select
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700"
                value={form.assignedTo}
                onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))}
              >
                <option value="">Selecciona un responsable</option>
                {users.map(u => (
                  <option key={u.username} value={u.username}>{u.name}</option>
                ))}
              </select>

              <select
                className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700"
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as ProjectStatus }))}
              >
                {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(status => (
                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                ))}
              </select>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-gray-400">Progreso</label>
                  <span className="text-xs font-bold text-gray-300">{form.progress}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="w-full accent-red-600"
                  value={form.progress}
                  onChange={e => setForm(p => ({ ...p, progress: Number(e.target.value) }))}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Servicios ligados</label>
                <div className="mt-2 grid gap-2 max-h-40 overflow-y-auto">
                  {services.length === 0 && <p className="text-xs text-gray-600">No hay servicios monitoreados</p>}
                  {services.map(service => (
                    <label key={service.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-red-600"
                        checked={form.serviceIds.includes(service.id)}
                        onChange={() => toggleServiceId(service.id)}
                      />
                      {service.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p className="text-red-400 text-sm mt-3">{formError}</p>}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2 rounded-lg transition font-semibold">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `cd apps/frontend && cmd.exe /c "npx --no-install next build"`
Expected: exit 0, con el chequeo de TypeScript limpio. Si falla con `MonitorService` no exportado, revisar que `hooks/useMonitor.ts:9` siga exportando la interfaz; ya lo hace.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/hooks/useProjects.ts apps/frontend/components/ProjectsTab.tsx
git commit -m "feat(frontend): add projects hook and tab component"
```

---

## Task 6: Montar la pestaña en el dashboard

**Files:**
- Modify: `apps/frontend/app/page.tsx`

**Interfaces:**
- Consumes: `useProjects()` y `ProjectsTab` de la Tarea 5. El arreglo `services` que `useMonitor()` ya devuelve en `page.tsx:9`.
- Produces: nada que otra tarea consuma. Es la última.

- [ ] **Step 1: Añadir los imports**

En `apps/frontend/app/page.tsx`, la línea 6 cambia para incluir el icono nuevo:

```tsx
import { Plus, Trash2, RefreshCw, Wifi, WifiOff, CheckCircle, XCircle, Clock, Bell, FolderKanban, ChevronRight, LogOut, User } from 'lucide-react';
```

Y se añaden dos imports después de la línea de `useMonitor`:

```tsx
import { useProjects } from '../hooks/useProjects';
import ProjectsTab from '../components/ProjectsTab';
```

- [ ] **Step 2: Llamar al hook y contar los proyectos actuales**

Dentro de `Home`, después de la línea `const router = useRouter();`:

```tsx
  const projectsState = useProjects();
  const proyectosActuales = projectsState.projects.filter(
    p => p.status === 'en_curso' || p.status === 'en_pausa',
  ).length;
```

- [ ] **Step 3: Añadir el botón de pestaña**

En el bloque `<div className="flex gap-2 mb-6">`, después del botón de Alertas, añadir:

```tsx
          <button onClick={() => setActiveTab('projects')} className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === 'projects' ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <FolderKanban className="w-4 h-4" /> Proyectos {proyectosActuales > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-2">{proyectosActuales}</span>}
          </button>
```

- [ ] **Step 4: Montar el contenido**

Después del bloque `{activeTab === 'alerts' && ( ... )}` y antes de `</main>`, añadir:

```tsx
        {activeTab === 'projects' && <ProjectsTab services={services} {...projectsState} />}
```

- [ ] **Step 5: Verificar que compila**

Run: `cd apps/frontend && cmd.exe /c "npx --no-install next build"`
Expected: exit 0.

- [ ] **Step 6: Verificación manual completa**

Arrancar los dos procesos, cada uno en su terminal:

```bash
cd apps/backend  && cmd.exe /c "npx --no-install nest start"
cd apps/frontend && cmd.exe /c "npx --no-install next dev"
```

Abrir `http://localhost:3000`, entrar con `josegarcia` / `Monitor2024!`, y recorrer esta lista:

1. La pestaña Proyectos aparece en tercer lugar, después de Alertas.
2. La pestaña vacía muestra "No hay proyectos registrados", no una pantalla en blanco.
3. Crear un proyecto con nombre, responsable, estado `en_curso`, progreso 35 y dos servicios marcados. Aparece bajo Actuales, con el badge del botón de pestaña en 1.
4. La barra de progreso al 35 por ciento sale amarilla; subirla a 80 la pone verde; bajarla a 20 la pone roja.
5. Los chips de servicio muestran el punto verde para los servicios que el dashboard lista como EN LINEA, y rojo para los CAIDO.
6. Guardar sin nombre: el modal muestra "El nombre del proyecto es obligatorio" y no cierra.
7. Editar el proyecto, poner progreso 100 y estado `terminado`. El proyecto desaparece de Actuales, el badge baja a 0, y aparece bajo Pasados al abrir ese grupo.
8. Recargar la página: el proyecto sigue ahí con sus datos.
9. Borrar el proyecto: desaparece y no vuelve al recargar.
10. Apagar el backend y recargar: aparece el banner rojo "No se pudo cargar los proyectos" con el botón Reintentar. Volver a arrancar el backend y pulsar Reintentar: la lista carga.
11. Las pestañas Servicios y Alertas siguen funcionando igual que antes.

- [ ] **Step 7: Correr la verificación completa**

```bash
cd apps/backend  && cmd.exe /c "npx --no-install jest" && cmd.exe /c "npx --no-install nest build"
cd apps/frontend && cmd.exe /c "npx --no-install next build"
```

Expected: 3 suites y 46 pruebas pasan; los dos builds salen con exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/app/page.tsx
git commit -m "feat(frontend): add Proyectos tab to dashboard"
```

---

## Deuda registrada, no resuelta

Heredada del spec. Ninguna tarea de este plan la toca.

1. `/api/projects` y `/api/auth/users` quedan públicas, sin token, consistentes con `services` y `monitor`. `GET /api/auth/users` expone nombres, correos y departamentos del personal a cualquiera que alcance el puerto 4000. Decisión explícita del usuario.
2. `JwtStrategy` sigue sin usarse. Ningún controlador aplica `@UseGuards(AuthGuard('jwt'))`.
3. Los dos archivos de datos dependen del directorio de arranque; `path.join(process.cwd(), ...)` no arregla eso. Anclarlos exige `__dirname` o una variable `DATA_DIR`.
4. Las credenciales locales siguen en texto plano en `auth.service.ts`.
5. El frontend no tiene arnés de pruebas. Su verificación es `next build` más la lista manual de la Tarea 6.
