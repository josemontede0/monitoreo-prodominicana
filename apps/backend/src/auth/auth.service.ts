import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Client } from "ldapts";

const LOCAL_USERS: Record<string, { password: string; name: string; email: string; department: string }> = {
  "admin": { password: "Monitor2024!", name: "Administrador Sistema", email: "admin@prodominicana.gob.do", department: "TI" },
  "josemontedeoca": { password: "Monitor2024!", name: "Jose Monte de Oca", email: "josemontedeoca@prodominicana.gob.do", department: "TI" },
  "edwinmercedes": { password: "Monitor2024!", name: "Edwin Mercedes", email: "edwinmercedes@prodominicana.gob.do", department: "TI" },
  "wiltonpatrocino": { password: "Monitor2024!", name: "Wilton Patrocino", email: "wiltonpatrocino@prodominicana.gob.do", department: "TI" },
  "josegarcia": { password: "Monitor2024!", name: "Jose Garcia", email: "josegarcia@prodominicana.gob.do", department: "TI" },
  "gonzaloaponte": { password: "Monitor2024!", name: "Gonzalo Aponte", email: "gonzaloaponte@prodominicana.gob.do", department: "TI" },
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger("AuthService");

  constructor(private readonly jwt: JwtService) {}

  listUsers() {
    return Object.entries(LOCAL_USERS).map(([username, user]) => ({
      username,
      name: user.name,
      email: user.email,
      department: user.department,
    }));
  }

  async login(username: string, password: string) {
    try {
      const result = await this.ldapLogin(username, password);
      return result;
    } catch (ldapError: any) {
      this.logger.warn("LDAP fallido (" + ldapError.message + "), intentando local...");
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
    this.logger.log("Login local exitoso: " + user.name);
    return { token, user: { username, ...user } };
  }

  private async ldapLogin(username: string, password: string) {
    const url = process.env.LDAP_URL ?? "ldap://192.168.0.20:389";
    const baseDn = process.env.LDAP_BASE_DN ?? "dc=cei-rd,dc=gov,dc=do";
    const userDn = username + "@cei-rd.gov.do";

    const client = new Client({
      url,
      tlsOptions: { rejectUnauthorized: false },
      timeout: 8000,
      connectTimeout: 8000,
    });

    try {
      this.logger.log("Intentando LDAP bind con: " + userDn);
      await client.bind(userDn, password);

      const { searchEntries } = await client.search(baseDn, {
        scope: "sub",
        filter: "(sAMAccountName=" + username + ")",
        attributes: ["displayName", "mail", "department", "title"],
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