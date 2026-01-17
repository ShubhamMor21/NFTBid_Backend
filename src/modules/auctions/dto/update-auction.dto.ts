import { IsOptional, IsNumber, IsDateString, Min } from 'class-validator';

export class UpdateAuctionDto {
    @IsNumber()
    @IsOptional()
    @Min(0)
    startingBid?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    reservePrice?: number;

    @IsDateString()
    @IsOptional()
    startTime?: Date;

    @IsDateString()
    @IsOptional()
    endTime?: Date;
}
