import { IsString, IsOptional } from 'class-validator';

export class UpdateNftDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    description?: string;
}
