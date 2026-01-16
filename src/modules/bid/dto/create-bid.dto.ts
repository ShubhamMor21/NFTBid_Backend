import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class CreateBidDto {
    @IsString()
    @IsNotEmpty()
    auctionId: string;

    @IsNumber()
    @IsNotEmpty()
    @Min(0.00000001)
    amount: number;

    @IsString()
    @IsNotEmpty()
    transactionHash: string;
}
