import { BadRequestException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
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

  it("deja el estado en iniciado cuando no se envia", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).status).toBe("iniciado");
  });

  it("acepta los tres estados validos", () => {
    const service = makeService(undefined);
    for (const status of ["iniciado", "en_curso", "en_pausa"]) {
      expect(service.add({ ...entradaValida, status }).status).toBe(status);
    }
  });
});

describe("ProjectsService, modulos y progreso derivado", () => {
  it("crea el proyecto con los siete modulos por defecto, sin marcar", () => {
    const service = makeService(undefined);
    const creado = service.add(entradaValida);
    expect(creado.modules).toHaveLength(7);
    expect(creado.modules.every((m) => m.done === false)).toBe(true);
    expect(creado.progress).toBe(0);
  });

  it("acepta una lista propia de modulos", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [{ name: "Analisis" }, { name: "Entrega", done: true }],
    });
    expect(creado.modules.map((m) => m.name)).toEqual(["Analisis", "Entrega"]);
    expect(creado.progress).toBe(50);
  });

  it("numera los modulos por posicion e ignora los ids enviados", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [{ id: 99, name: "Uno" }, { id: 99, name: "Dos" }],
    });
    expect(creado.modules.map((m) => m.id)).toEqual([1, 2]);
  });

  it("recorta los espacios del nombre del modulo", () => {
    const service = makeService(undefined);
    const creado = service.add({ ...entradaValida, modules: [{ name: "  Pruebas  " }] });
    expect(creado.modules[0].name).toBe("Pruebas");
  });

  it("mueve el progreso al marcar modulos en el update", () => {
    const service = makeService(undefined);
    const id = service.add(entradaValida).id;
    const modules = service.getOne(id)!.modules.map((m, i) => ({ ...m, done: i < 3 }));
    // 3 de 7 son 42.857, que se redondea a 43.
    expect(service.update(id, { modules })?.progress).toBe(43);
  });

  it("llega a 100 cuando todos los modulos estan marcados", () => {
    const service = makeService(undefined);
    const id = service.add(entradaValida).id;
    const modules = service.getOne(id)!.modules.map((m) => ({ ...m, done: true }));
    expect(service.update(id, { modules })?.progress).toBe(100);
  });

  it("deja el progreso en 0 cuando el proyecto no tiene modulos", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, modules: [] }).progress).toBe(0);
  });

  it("ignora un progreso enviado en el cuerpo", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, progress: 80 }).progress).toBe(0);
    const id = service.add(entradaValida).id;
    expect(service.update(id, { progress: 80 })?.progress).toBe(0);
  });

  it("rechaza un modulo sin nombre", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, modules: [{ name: "   " }] })).toThrow(BadRequestException);
    expect(() => service.add({ ...entradaValida, modules: [{ done: true }] })).toThrow(BadRequestException);
  });

  it("rechaza unos modulos que no son una lista", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, modules: "uno,dos" })).toThrow(BadRequestException);
  });
});

describe("ProjectsService, fechas de inicio y finalizacion", () => {
  it("nacen en null cuando no se envian", () => {
    const service = makeService(undefined);
    const creado = service.add(entradaValida);
    expect(creado.startDate).toBeNull();
    expect(creado.endDate).toBeNull();
  });

  it("guarda las dos fechas", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      startDate: "2026-10-01",
      endDate: "2026-12-15",
    });
    expect(creado.startDate).toBe("2026-10-01");
    expect(creado.endDate).toBe("2026-12-15");
  });

  it("acepta solo una de las dos", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, startDate: "2026-10-01" }).endDate).toBeNull();
    expect(service.add({ ...entradaValida, endDate: "2026-12-15" }).startDate).toBeNull();
  });

  it("trata la cadena vacia y null como sin fecha", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, startDate: "" }).startDate).toBeNull();
    expect(service.add({ ...entradaValida, startDate: null }).startDate).toBeNull();
  });

  it("recorta los espacios", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, startDate: "  2026-10-01  " }).startDate).toBe("2026-10-01");
  });

  it("rechaza un formato que no es AAAA-MM-DD", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, startDate: "01/10/2026" })).toThrow(BadRequestException);
    expect(() => service.add({ ...entradaValida, startDate: "2026-10-01T00:00:00Z" })).toThrow(BadRequestException);
    expect(() => service.add({ ...entradaValida, startDate: 20261001 })).toThrow(BadRequestException);
  });

  it("rechaza una fecha que no existe en el calendario", () => {
    const service = makeService(undefined);
    expect(() => service.add({ ...entradaValida, startDate: "2026-02-31" })).toThrow(BadRequestException);
    expect(() => service.add({ ...entradaValida, startDate: "2026-13-01" })).toThrow(BadRequestException);
  });

  it("acepta el 29 de febrero de un ano bisiesto", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, startDate: "2028-02-29" }).startDate).toBe("2028-02-29");
  });

  it("rechaza una finalizacion anterior al inicio", () => {
    const service = makeService(undefined);
    expect(() =>
      service.add({ ...entradaValida, startDate: "2026-12-15", endDate: "2026-10-01" }),
    ).toThrow(BadRequestException);
  });

  it("acepta que empiecen y terminen el mismo dia", () => {
    const service = makeService(undefined);
    const creado = service.add({ ...entradaValida, startDate: "2026-10-01", endDate: "2026-10-01" });
    expect(creado.endDate).toBe("2026-10-01");
  });

  it("no deja un alta invalida a medias", () => {
    const service = makeService(undefined);
    expect(() =>
      service.add({ ...entradaValida, startDate: "2026-12-15", endDate: "2026-10-01" }),
    ).toThrow(BadRequestException);
    expect(service.getAll()).toEqual([]);
  });

  it("compara contra la fecha ya guardada cuando el update trae solo una", () => {
    const service = makeService(undefined);
    const id = service.add({ ...entradaValida, startDate: "2026-10-01", endDate: "2026-12-15" }).id;
    expect(() => service.update(id, { endDate: "2026-09-01" })).toThrow(BadRequestException);
    expect(service.getOne(id)?.endDate).toBe("2026-12-15");
    expect(service.update(id, { endDate: "2026-11-01" })?.endDate).toBe("2026-11-01");
  });

  it("permite borrar una fecha en el update", () => {
    const service = makeService(undefined);
    const id = service.add({ ...entradaValida, startDate: "2026-10-01", endDate: "2026-12-15" }).id;
    expect(service.update(id, { endDate: "" })?.endDate).toBeNull();
  });
});

describe("ProjectsService, personas asignadas a un modulo", () => {
  it("los modulos por defecto nacen sin asignar", () => {
    const service = makeService(undefined);
    expect(service.add(entradaValida).modules.every((m) => m.assignedTo.length === 0)).toBe(true);
  });

  it("asigna una persona", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [{ name: "Desarrollo", assignedTo: ["josegarcia"] }],
    });
    expect(creado.modules[0].assignedTo).toEqual(["josegarcia"]);
  });

  it("asigna varias personas al mismo modulo", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [{ name: "Desarrollo", assignedTo: ["josegarcia", "admin"] }],
    });
    expect(creado.modules[0].assignedTo).toEqual(["josegarcia", "admin"]);
  });

  it("no repite a la misma persona", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [{ name: "Desarrollo", assignedTo: ["admin", "admin", "admin"] }],
    });
    expect(creado.modules[0].assignedTo).toEqual(["admin"]);
  });

  it("descarta a quien no es un usuario conocido, sin lanzar", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [{ name: "Desarrollo", assignedTo: ["josegarcia", "nadie"] }],
    });
    expect(creado.modules[0].assignedTo).toEqual(["josegarcia"]);
  });

  it("deja la lista vacia cuando assignedTo no es un arreglo o no se envia", () => {
    const service = makeService(undefined);
    expect(service.add({ ...entradaValida, modules: [{ name: "Uno" }] }).modules[0].assignedTo).toEqual([]);
    expect(
      service.add({ ...entradaValida, modules: [{ name: "Uno", assignedTo: "josegarcia" }] }).modules[0].assignedTo,
    ).toEqual([]);
  });

  it("cada modulo lleva su propia lista", () => {
    const service = makeService(undefined);
    const creado = service.add({
      ...entradaValida,
      modules: [
        { name: "Diseno", assignedTo: ["josegarcia"] },
        { name: "Pruebas", assignedTo: ["admin"] },
        { name: "Despliegue" },
      ],
    });
    expect(creado.modules.map((m) => m.assignedTo)).toEqual([["josegarcia"], ["admin"], []]);
  });

  it("cambia las personas de un modulo en el update", () => {
    const service = makeService(undefined);
    const id = service.add({ ...entradaValida, modules: [{ name: "Diseno", assignedTo: ["josegarcia"] }] }).id;
    const actualizado = service.update(id, {
      modules: [{ name: "Diseno", assignedTo: ["admin"] }],
    });
    expect(actualizado?.modules[0].assignedTo).toEqual(["admin"]);
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
    const creado = service.add({ ...entradaValida, status: "en_curso" });
    return { service, id: creado.id };
  }

  it("devuelve null cuando el id no existe", () => {
    const { service } = conUnProyecto();
    expect(service.update(999, { name: "Otro nombre" })).toBeNull();
  });

  it("solo cambia los campos presentes", () => {
    const { service, id } = conUnProyecto();
    const actualizado = service.update(id, { status: "en_pausa" });
    expect(actualizado?.status).toBe("en_pausa");
    expect(actualizado?.name).toBe("Rediseno de ProtalentHub");
    expect(actualizado?.modules).toHaveLength(7);
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

  it("rechaza unos modulos invalidos en el update", () => {
    const { service, id } = conUnProyecto();
    expect(() => service.update(id, { modules: [{ name: "" }] })).toThrow(BadRequestException);
  });

  it("no cambia nada cuando la validacion falla", () => {
    const { service, id } = conUnProyecto();
    const modules = service.getOne(id)!.modules.map((m) => ({ ...m, done: true }));
    expect(() => service.update(id, { modules, status: "inventado" })).toThrow(BadRequestException);
    expect(service.getOne(id)?.progress).toBe(0);
    expect(service.getOne(id)?.modules.every((m) => m.done === false)).toBe(true);
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

describe("ProjectsService, archivo ilegible (C1)", () => {
  it("respalda el archivo antes de arrancar vacio cuando el JSON esta corrupto", () => {
    makeService("{ esto no es json");
    expect(mockedFs.renameSync).toHaveBeenCalledTimes(1);
    const [desde, hacia] = mockedFs.renameSync.mock.calls[0];
    expect(desde).toBe(path.join(process.cwd(), "projects.json"));
    expect(String(hacia)).toMatch(/projects\.json\.corrupto-\d+$/);
  });

  it("respalda el archivo cuando el JSON es valido pero no es un arreglo", () => {
    makeService('{"proyectos":[]}');
    expect(mockedFs.renameSync).toHaveBeenCalledTimes(1);
  });

  it("no respalda nada cuando el archivo es un arreglo valido", () => {
    makeService("[]");
    expect(mockedFs.renameSync).not.toHaveBeenCalled();
  });

  it("arranca vacio aunque el respaldo falle", () => {
    mockedFs.renameSync.mockImplementation(() => {
      throw new Error("EPERM");
    });
    const service = makeService("{ esto no es json");
    expect(service.getAll()).toEqual([]);
  });
});

describe("ProjectsService.save, destino y contenido (I4)", () => {
  it("escribe en projects.json dentro del directorio de trabajo", () => {
    const service = makeService(undefined);
    service.add(entradaValida);
    const [archivo] = mockedFs.writeFileSync.mock.calls[0];
    expect(archivo).toBe(path.join(process.cwd(), "projects.json"));
  });

  it("escribe la lista completa, no solo el ultimo proyecto", () => {
    const service = makeService(undefined);
    service.add(entradaValida);
    service.add({ ...entradaValida, name: "Segundo proyecto" });
    const llamadas = mockedFs.writeFileSync.mock.calls;
    const [, contenido] = llamadas[llamadas.length - 1];
    expect(JSON.parse(contenido as string)).toEqual(service.getAll());
  });

  it("escribe JSON legible, con dos espacios de indentacion", () => {
    const service = makeService(undefined);
    service.add(entradaValida);
    const [, contenido] = mockedFs.writeFileSync.mock.calls[0];
    expect(contenido as string).toContain('\n  {\n    "id"');
  });
});

describe("ProjectsService, el guardado fallido no deja memoria y disco en desacuerdo (I5)", () => {
  function conFalloAlGuardar() {
    const service = makeService(undefined);
    const creado = service.add(entradaValida);
    mockedFs.writeFileSync.mockImplementation(() => {
      throw new Error("ENOSPC");
    });
    return { service, creado };
  }

  it("deshace el alta cuando el guardado falla", () => {
    const { service } = conFalloAlGuardar();
    expect(() => service.add({ ...entradaValida, name: "No deberia quedar" })).toThrow("ENOSPC");
    expect(service.getAll().map((p) => p.name)).not.toContain("No deberia quedar");
    expect(service.getAll()).toHaveLength(1);
  });

  it("deshace el borrado cuando el guardado falla", () => {
    const { service, creado } = conFalloAlGuardar();
    expect(() => service.remove(creado.id)).toThrow("ENOSPC");
    expect(service.getOne(creado.id)).not.toBeNull();
  });

  it("deshace la edicion cuando el guardado falla", () => {
    const { service, creado } = conFalloAlGuardar();
    const modules = service.getOne(creado.id)!.modules.map((m) => ({ ...m, done: true }));
    expect(() => service.update(creado.id, { modules })).toThrow("ENOSPC");
    expect(service.getOne(creado.id)?.progress).toBe(0);
  });
});

describe("ProjectsService, otro proceso escribio el archivo (I5)", () => {
  const ajeno = {
    id: 55,
    name: "De otro proceso",
    description: null,
    serviceIds: [],
    assignedTo: "admin",
    status: "en_curso",
    progress: 10,
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  function servicioConMtime(mtimeMs: number, contenido: string) {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(contenido as any);
    mockedFs.statSync.mockReturnValue({ mtimeMs } as any);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    const service = new ProjectsService(servicesStub, authStub);
    service.onModuleInit();
    return service;
  }

  it("recarga antes de dar de alta, para no borrar el proyecto del otro proceso", () => {
    const service = servicioConMtime(100, "[]");
    expect(service.getAll()).toEqual([]);

    mockedFs.readFileSync.mockReturnValue(JSON.stringify([ajeno]) as any);
    mockedFs.statSync.mockReturnValue({ mtimeMs: 200 } as any);

    service.add(entradaValida);
    expect(service.getAll().map((p) => p.id)).toContain(55);
    expect(service.getAll()).toHaveLength(2);
  });

  it("recarga antes de borrar", () => {
    const service = servicioConMtime(100, "[]");
    mockedFs.readFileSync.mockReturnValue(JSON.stringify([ajeno]) as any);
    mockedFs.statSync.mockReturnValue({ mtimeMs: 200 } as any);
    expect(service.remove(55)).toBe(true);
    expect(service.getAll()).toEqual([]);
  });

  it("no recarga cuando la mtime no cambio", () => {
    const service = servicioConMtime(100, JSON.stringify([ajeno]));
    mockedFs.readFileSync.mockClear();
    service.add(entradaValida);
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });
});
