import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nft } from '../../database/entities/nft.entity';
import { Auction } from '../../database/entities/auction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { Bid } from '../../database/entities/bid.entity';
import { CreateNftDto } from './dto/create-nft.dto';
import { UpdateNftDto } from './dto/update-nft.dto';
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
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
        @InjectRepository(Bid)
        private readonly bidRepository: Repository<Bid>,
    ) { }

    /**
     * Create a new NFT record (Minting placeholder).
     */
    async createNft(userId: string, walletAddress: string | undefined, dto: CreateNftDto): Promise<Nft> {
        try {
            let activeWallet: string | undefined = walletAddress;

            if (!activeWallet) {
                const primaryWallet = await this.walletRepository.findOne({
                    where: { userId, isPrimary: true }
                });
                activeWallet = primaryWallet?.walletAddress;

                if (!activeWallet) {
                    const anyWallet = await this.walletRepository.findOne({ where: { userId } });
                    activeWallet = anyWallet?.walletAddress;
                }
            }

            if (!activeWallet) {
                throw new BadRequestException('User must have at least one wallet to create an NFT.');
            }

            const nft = this.nftRepository.create({
                ...dto,
                creator_wallet: activeWallet.toLowerCase(),
                current_owner_wallet: activeWallet.toLowerCase(),
                is_listed: false,
            });
            return await this.nftRepository.save(nft);
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            console.error('createNft error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List NFTs created/owned by the current creator.
     */
    async getMyNfts(userId: string): Promise<Nft[]> {
        try {
            const userWallets = await this.walletRepository.find({ where: { userId } });
            const walletAddresses = userWallets.map(w => w.walletAddress.toLowerCase());

            if (walletAddresses.length === 0) return [];

            return await this.nftRepository.createQueryBuilder('nft')
                .where('LOWER(nft.current_owner_wallet) IN (:...wallets)', { wallets: walletAddresses })
                .orderBy('nft.created_at', 'DESC')
                .getMany();
        } catch (error) {
            console.error('getMyNfts error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Start a new auction for an owned NFT.
     */
    async createAuction(userId: string, walletAddress: string | undefined, dto: CreateAuctionDto): Promise<Auction> {
        try {
            const nft = await this.nftRepository.findOne({ where: { id: dto.nftId } });

            if (!nft) {
                throw new NotFoundException(MESSAGES.AUCTION.NOT_FOUND);
            }

            if (!nft.current_owner_wallet) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            // Verify ownership using userId
            const userWallets = await this.walletRepository.find({ where: { userId } });
            const walletAddresses = userWallets.map(w => w.walletAddress.toLowerCase());

            if (!walletAddresses.includes(nft.current_owner_wallet.toLowerCase())) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            if (nft.is_listed) {
                throw new ConflictException(MESSAGES.NFT.ALREADY_LISTED);
            }

            // Use provided wallet or primary wallet
            let activeWallet: string | undefined = walletAddress;
            if (!activeWallet) {
                const primary = userWallets.find(w => w.isPrimary) || userWallets[0];
                activeWallet = primary?.walletAddress;
            }

            if (!activeWallet) {
                throw new BadRequestException('User must have at least one wallet to start an auction.');
            }

            const start = new Date(dto.startTime);
            const end = new Date(dto.endTime);
            const now = new Date();
            const buffer = 5 * 60 * 1000; // 5 minutes buffer

            if (start.getTime() < now.getTime() - buffer) {
                throw new BadRequestException(MESSAGES.AUCTION.START_TIME_FUTURE);
            }

            if (end <= start) {
                throw new BadRequestException(MESSAGES.AUCTION.END_TIME_AFTER_START);
            }

            const auction = this.auctionRepository.create({
                ...dto,
                sellerId: userId,
                sellerWallet: activeWallet.toLowerCase(),
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

    /**
     * Update an NFT (Name/Description).
     */
    async updateNft(id: string, userId: string, dto: UpdateNftDto): Promise<Nft> {
        try {
            const nft = await this.nftRepository.findOne({ where: { id } });

            if (!nft) {
                throw new NotFoundException(MESSAGES.NFT.NOT_FOUND || 'NFT not found');
            }

            if (!nft.current_owner_wallet) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            // Verify ownership using userId
            const userWallets = await this.walletRepository.find({ where: { userId } });
            const walletAddresses = userWallets.map(w => w.walletAddress.toLowerCase());

            if (!walletAddresses.includes(nft.current_owner_wallet.toLowerCase())) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            Object.assign(nft, dto);
            return await this.nftRepository.save(nft);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            console.error('updateNft error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Delete an NFT record.
     */
    async deleteNft(id: string, userId: string): Promise<void> {
        try {
            const nft = await this.nftRepository.findOne({ where: { id } });

            if (!nft) {
                throw new NotFoundException(MESSAGES.NFT.NOT_FOUND);
            }

            if (!nft.current_owner_wallet) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            // Verify ownership using userId
            const userWallets = await this.walletRepository.find({ where: { userId } });
            const walletAddresses = userWallets.map(w => w.walletAddress.toLowerCase());

            if (!walletAddresses.includes(nft.current_owner_wallet.toLowerCase())) {
                throw new ForbiddenException(MESSAGES.NFT.OWNERSHIP_REQUIRED);
            }

            if (nft.is_listed) {
                // Check if there are active auctions
                const activeAuction = await this.auctionRepository.findOne({
                    where: { nftId: id, status: AuctionStatus.ACTIVE }
                });
                if (activeAuction) {
                    throw new ConflictException('Cannot delete NFT listed in an active auction.');
                }
            }

            // Manual cascade deletion to handle foreign key constraints
            const auctions = await this.auctionRepository.find({ where: { nftId: id } });
            for (const auction of auctions) {
                await this.bidRepository.delete({ auctionId: auction.id });
                await this.auctionRepository.remove(auction);
            }

            await this.nftRepository.softRemove(nft);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof ConflictException) {
                throw error;
            }
            console.error('deleteNft error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
