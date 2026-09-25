import { Module } from '@nestjs/common';
import { TestRolesController } from './test-roles.controller.js';

@Module({ controllers: [TestRolesController] })
export class TestRolesModule {}
