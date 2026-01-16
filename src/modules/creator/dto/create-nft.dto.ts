import { IsNotEmpty, IsString, IsNumber, IsOptional, IsUrl } from 'class-validator';

export class CreateNftDto {
    @IsString()
    @IsNotEmpty()
    token_id: string;

    @IsString()
    @IsNotEmpty()
    contract_address: string;

    @IsNumber()
    @IsOptional()
    chain_id?: number;

    @IsUrl()
    @IsNotEmpty()
    metadata_url: string;

    @IsUrl()
    @IsNotEmpty()
    image_url: string;
}
