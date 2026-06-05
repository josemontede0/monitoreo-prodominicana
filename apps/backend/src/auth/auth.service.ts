import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Client } from "ldapts";

const LOCAL_USERS: Record<string, { password: string; name: string; email: string; department: string }> = {
  "admin": { password: "Monitor2024!", name: "Administrador Sistema", email: "admin@prodominicana.gob.do", department: "TI" },
  "josemontedeoca": { password: "Monitor2024!", name: "Jose Monte de Oca", email: "josemontedeoca@prodominicana.gob.do", department: "TI" },
  "edwinmercedes": { password: "Monitor2024!", name: "Edwin Mercedes", email: "edwinmercedes@prodominicana.gob.do", department: "TI" },
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger("AuthService");
  private ldapAvailable: boolean | null = null;

  constructor(private readonly jwt: JwtService) {}

  async login(username: string, password: string) {
    if (this.ldapAvailable === false) {
      return this.localLogin(username, password);
    }
    try {
      const result = await this.ldapLogin(username, password);
      this.ldapAvailable = true;
      return result;
    } catch (ldapError: any) {
      if (ldapError.message?.includes("ECONNRESET") || ldapError.message?.includes("ECONNREFUSED") || ldapError.message?.includes("ETIMEDOUT")) {
        this.ldapAvailable = false;
        this.logger.warn("LDAP no disponible, usando autenticacion local");
      }
      return this.localLogin(username, password);
    }
  }

  private localLogin(username: string, password: string) {
    const user = LOCAL_USERS[username.toLowerCase()];
    if (!user || user.password !== password) {
      throw new UnauthorizedException("Credenciales incorrectas");
    }
    const payload = { sub: username, name: user.name, email: user.email, department: user.department };
    const token = this.jwt.sign(payload);
    this.logger.log("Login exitoso: " + user.name);
    return { token, user: { username, ...user } };
  }

  private async ldapLogin(username: string, password: string) {
    const url = "ldap://192.168.0.20:389";
    const baseDn = process.env.LDAP_BASE_DN ?? "dc=cei-rd,dc=gov,dc=do";
    const userDn = username + "@cei-rd.gov.do";

    const client = new Client({ url, tlsOptions: { rejectUnauthorized: false }, timeout: 4000, connectTimeout: 4000 });

    try {
      await client.bind(userDn, password);
      const { searchEntries } = await client.search(baseDn, {
        scope: "sub",
        filter: "(sAMAccountName=" + username + ")",
        attributes: ["displayName", "mail", "department"],
      });
      await client.unbind();

      const entry = searchEntries[0];
      const displayName = entry?.displayName?.toString() ?? username;
      const mail = entry?.mail?.toString() ?? "";
      const department = entry?.department?.toString() ?? "";

      const payload = { sub: username, name: displayName, email: mail, department };
      const token = this.jwt.sign(payload);
      this.logger.log("Login LDAP exitoso: " + displayName);
      return { token, user: { username, name: displayName, email: mail, department } };
    } catch (e) {
      await client.unbind().catch(() => {});
      throw e;
    }
  }
}