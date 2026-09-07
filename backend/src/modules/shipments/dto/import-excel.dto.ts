import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class ImportExcelDto {
  @ApiPropertyOptional({
    description: 'JSON niz rednih brojeva redova koji se uvoze, npr. "[2,3,7]". Ako izostane, uvoze se svi validni.',
    type: String,
  })
  @IsOptional()
  @IsString()
  selectedRowNumbers?: string;

  @ApiPropertyOptional({
    description: 'JSON mapiranje kolona, npr. {"iccid":"Kolona A","ipAddress":"Kolona B"}',
    type: String,
  })
  @IsOptional()
  @IsString()
  columnMapping?: string;

  @ApiPropertyOptional({
    description: 'Ako je true, validni redovi se upisuju u bazu. Ako je false ili izostavljeno, vraća se preview.',
    default: 'false',
    type: String,
  })
  @IsOptional()
  @IsBooleanString()
  applyImport?: string;
}
