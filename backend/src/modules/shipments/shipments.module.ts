import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ColumnMapperService } from './import/column-mapper.service';
import { ExcelImportService } from './import/excel-import.service';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [ActivityLogModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ExcelImportService, ColumnMapperService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
