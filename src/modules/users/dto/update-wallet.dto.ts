import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateWalletDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    name?: string;

    @IsOptional()
    @IsBoolean()
    isPrimary?: boolean;
}
