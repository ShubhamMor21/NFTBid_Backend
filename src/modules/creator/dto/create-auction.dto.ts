import { IsNotEmpty, IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

export class CreateAuctionDto {
    @IsString()
    @IsNotEmpty()
    nftId: string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    startPrice: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    reservePrice?: number;

    @IsNumber()
    @IsNotEmpty()
    @Min(0)
    minBidIncrement: number;

    @IsDateString()
    @IsNotEmpty()
    startTime: string;

    @IsDateString()
    @IsNotEmpty()
    endTime: string;
}
