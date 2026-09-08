import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsOptional, IsString } from 'class-validator';

/**
 * multipart/form-data uvijek šalje polja kao string. Ako neki klijent (stari frontend build,
 * proxy, itd.) ipak pošalje isto polje više puta, Multer/Busboy ga pretvara u niz stringova
 * umjesto jednog stringa — što bi inače palo na @IsString() validaciji (ili, sa
 * forbidNonWhitelisted, izgledalo kao da polje "ne postoji"). Ova transformacija to normalizuje
 * prije nego što class-validator uopšte pokuša da validira vrijednost.
 */
function normalizeToJsonString(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return value;
}

export class ImportExcelDto {
  @ApiPropertyOptional({
    description: 'JSON niz rednih brojeva redova koji se uvoze, npr. "[2,3,7]". Ako izostane, uvoze se svi validni.',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeToJsonString(value))
  @IsString()
  selectedRowNumbers?: string;

  @ApiPropertyOptional({
    description: 'JSON mapiranje kolona, npr. {"iccid":"Kolona A","ipAddress":"Kolona B"}',
    type: String,
  })
  @IsOptional()
  @Transform(({ value }) => normalizeToJsonString(value))
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
