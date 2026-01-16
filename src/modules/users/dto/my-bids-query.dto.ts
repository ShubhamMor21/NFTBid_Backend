import { IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum BidStatus {
    ACTIVE = 'ACTIVE',      // All active auction bids
    WINNING = 'WINNING',    // User is currently winning (highest bidder in active auction)
    OUTBID = 'OUTBID',      // User was outbid (not highest bidder in active auction)
    WON = 'WON',           // User won the auction
    LOST = 'LOST',         // User lost the auction
    SETTLED = 'SETTLED',   // Auction settled
}

export class MyBidsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;

    @IsOptional()
    @IsEnum(BidStatus)
    status?: BidStatus;
}