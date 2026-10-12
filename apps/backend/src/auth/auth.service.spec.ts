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
