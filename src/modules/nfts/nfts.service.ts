import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nft } from '../../database/entities/nft.entity';
import { CreateNftDto } from '../creator/dto/create-nft.dto';
import { MESSAGES } from '../../common/constants/messages';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NftsService {
    constructor(
        @InjectRepository(Nft)
        private readonly nftRepository: Repository<Nft>,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Save NFT metadata to the database.
     */
    async create(dto: CreateNftDto): Promise<Nft> {
        try {
            const nft = this.nftRepository.create({
                ...dto,
                is_listed: false,
            });
            return await this.nftRepository.save(nft);
        } catch (error) {
            console.error('NftsService.create error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Fetch NFT details by ID.
     */
    async findById(id: string): Promise<Nft> {
        try {
            const cacheKey = `nft:${id}`;
            const cached = await this.redisService.get<Nft>(cacheKey);
            if (cached) return cached;

            const nft = await this.nftRepository.findOne({ where: { id } });
            if (!nft) {
                throw new NotFoundException(MESSAGES.NFT.NOT_FOUND);
            }

            // Cache for 10 minutes
            await this.redisService.set(cacheKey, nft, 600);
            return nft;
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('NftsService.findById error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List NFTs owned by a specific wallet.
     */
    async findByWallet(wallet: string): Promise<Nft[]> {
        try {
            return await this.nftRepository.find({
                where: { current_owner_wallet: wallet.toLowerCase() },
                order: { created_at: 'DESC' },
            });
        } catch (error) {
            console.error('NftsService.findByWallet error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Update NFT owner by Token ID (On-chain ID).
     */
    async updateOwner(tokenId: string, newOwner: string): Promise<Nft | null> {
        try {
            const nft = await this.nftRepository.findOne({ where: { token_id: tokenId } });
            if (!nft) {
                console.warn(`NFT with token_id ${tokenId} not found in DB during Mint event.`);
                return null;
            }

            nft.current_owner_wallet = newOwner.toLowerCase();
            nft.is_listed = false;

            const savedNft = await this.nftRepository.save(nft);

            // Invalidate cache
            await this.redisService.del(`nft:${nft.id}`);

            return savedNft;
        } catch (error) {
            console.error('NftsService.updateOwner error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
