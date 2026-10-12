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
