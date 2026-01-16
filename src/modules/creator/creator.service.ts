import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nft } from '../../database/entities/nft.entity';
import { Auction } from '../../database/entities/auction.entity';
import { CreateNftDto } from './dto/create-nft.dto';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { MESSAGES } from '../../common/constants/messages';
import { AuctionStatus } from '../../common/enums/auction-status.enum';

@Injectable()
export class CreatorService {
    constructor(
        @InjectRepository(Nft)
        private readonly nftRepository: Repository<Nft>,
        @InjectRepository(Auction)
        private readonly auctionRepository: Repository<Auction>,
    ) { }

    /**
     * Create a new NFT record (Minting placeholder).
     */
    async createNft(userId: string, walletAddress: string, dto: CreateNftDto): Promise<Nft> {
        try {
            const nft = this.nftRepository.create({
                ...dto,
                creator_wallet: walletAddress?.toLowerCase(),
                current_owner_wallet: walletAddress?.toLowerCase(),
                is_listed: false,
            });
            return await this.nftRepository.save(nft);
        } catch (error) {
            console.error('createNft error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List NFTs created/owned by the current creator.
     */
    async getMyNfts(walletAddress: string): Promise<Nft[]> {
        try {
            return await this.nftRepository.find({
                where: { current_owner_wallet: walletAddress?.toLowerCase() },
                order: { created_at: 'DESC' },
            });
        } catch (error) {
            console.error('getMyNfts error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Start a new auction for an owned NFT.
     */
    async createAuction(userId: string, walletAddress: string, dto: CreateAuctionDto): Promise<Auction> {
        try {
            const nft = await this.nftRepository.findOne({ where: { id: dto.nftId } });

            if (!nft) {
                throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            }

            if (nft.current_owner_wallet.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            if (nft.is_listed) {
                throw new ConflictException(MESSAGES.NFT.ALREADY_LISTED);
            }

            const auction = this.auctionRepository.create({
                ...dto,
                sellerId: userId,
                sellerWallet: walletAddress.toLowerCase(),
                status: AuctionStatus.DRAFT,
            });

            const savedAuction = await this.auctionRepository.save(auction);

            // Mark NFT as listed
            nft.is_listed = true;
            await this.nftRepository.save(nft);

            return savedAuction;
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof ConflictException) {
                throw error;
            }
            console.error('createAuction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List auctions managed by the current creator.
     */
    async getMyAuctions(userId: string): Promise<Auction[]> {
        try {
            return await this.auctionRepository.find({
                where: { sellerId: userId },
                relations: ['nft'],
                order: { created_at: 'DESC' },
            });
        } catch (error) {
            console.error('getMyAuctions error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
