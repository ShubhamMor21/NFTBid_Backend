import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../../database/entities/transaction.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { MESSAGES } from '../../common/constants/messages';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
        @InjectRepository(Wallet)
        private readonly walletRepository: Repository<Wallet>,
    ) { }

    /**
     * Create a transaction record.
     */
    async createTransaction(txHash: string, walletAddress: string, type: TransactionType, amount: number, metadata: any = {}, chainId: number = 0) {
        try {
            const transaction = this.transactionRepository.create({
                tx_hash: txHash,
                wallet_address: walletAddress.toLowerCase(),
                type,
                status: TransactionStatus.SUCCESS, // Confirmed events are SUCCESS
                amount,
                chain_id: chainId,
                metadata,
            });
            return await this.transactionRepository.save(transaction);
        } catch (error) {
            console.error('createTransaction error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * List transactions for a wallet.
     */
    async getByWallet(wallet: string): Promise<Transaction[]> {
        try {
            return await this.transactionRepository.find({
                where: { wallet_address: wallet.toLowerCase() },
                order: { created_at: 'DESC' }
            });
        } catch (error) {
            console.error('getByWallet error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Update tx status.
     */
    async updateStatus(txHash: string, status: TransactionStatus) {
        try {
            const tx = await this.transactionRepository.findOne({ where: { tx_hash: txHash } });
            if (!tx) throw new NotFoundException(MESSAGES.TRANSACTION.NOT_FOUND);
            tx.status = status;
            return await this.transactionRepository.save(tx);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('updateTransactionStatus error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Get all transactions (Admin only) with filters and pagination.
     */
    async getAllTransactions(query: GetTransactionsDto) {
        try {
            const { page = 1, limit = 10, type, search } = query;
            const skip = (page - 1) * limit;

            const queryBuilder = this.transactionRepository.createQueryBuilder('transaction')
                .skip(skip)
                .take(limit)
                .orderBy('transaction.created_at', 'DESC');

            if (type) {
                queryBuilder.andWhere('transaction.type = :type', { type });
            }

            if (search) {
                queryBuilder.andWhere('LOWER(transaction.wallet_address) LIKE :search', {
                    search: `%${search.toLowerCase()}%`,
                });
            }

            const [transactions, totalItems] = await queryBuilder.getManyAndCount();

            return {
                data: transactions,
                meta: {
                    totalItems,
                    itemCount: transactions.length,
                    itemsPerPage: limit,
                    totalPages: Math.ceil(totalItems / limit),
                    currentPage: page,
                },
            };
        } catch (error) {
            console.error('getAllTransactions error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }

    /**
     * Get user transactions (Creator/User) - only their own transactions.
     */
    async getUserTransactions(userId: string, query: GetTransactionsDto) {
        try {
            const { page = 1, limit = 10, type } = query;
            const skip = (page - 1) * limit;

            // 1. Get all wallet addresses for this user
            const wallets = await this.walletRepository.find({
                where: { userId },
                select: ['walletAddress'],
            });

            if (!wallets || wallets.length === 0) {
                return {
                    data: [],
                    meta: {
                        totalItems: 0,
                        itemCount: 0,
                        itemsPerPage: limit,
                        totalPages: 0,
                        currentPage: page,
                    },
                };
            }

            const walletAddresses = wallets.map(w => w.walletAddress.toLowerCase());

            // 2. Query transactions for these wallets
            const queryBuilder = this.transactionRepository.createQueryBuilder('transaction')
                .where('LOWER(transaction.wallet_address) IN (:...walletAddresses)', { walletAddresses })
                .skip(skip)
                .take(limit)
                .orderBy('transaction.created_at', 'DESC');

            if (type) {
                queryBuilder.andWhere('transaction.type = :type', { type });
            }

            const [transactions, totalItems] = await queryBuilder.getManyAndCount();

            return {
                data: transactions,
                meta: {
                    totalItems,
                    itemCount: transactions.length,
                    itemsPerPage: limit,
                    totalPages: Math.ceil(totalItems / limit),
                    currentPage: page,
                },
            };
        } catch (error) {
            console.error('getUserTransactions error:', error);
            throw new InternalServerErrorException(MESSAGES.GENERAL.INTERNAL_ERROR);
        }
    }
}
