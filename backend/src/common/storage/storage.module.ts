import { Global, Module } from '@nestjs/common';
import { UploadsStorageService } from './uploads-storage.service';

@Global()
@Module({
  providers: [UploadsStorageService],
  exports: [UploadsStorageService],
})
export class StorageModule {}
