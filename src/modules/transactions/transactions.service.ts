import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType, TransactionStatus } from '../../database/entities/transaction.entity';
import { MESSAGES } from '../../common/constants/messages';

@Injectable()
export class TransactionsService {
    constructor(
        @InjectRepository(Transaction)
        private readonly transactionRepository: Repository<Transaction>,
    ) { }

    /**
     * Create a transaction record.
     */
    async createTransaction(txHash: string, walletAddress: string, type: TransactionType, description: string, amount: number, chainId: number) {
        try {
            const transaction = this.transactionRepository.create({
                tx_hash: txHash,
                wallet_address: walletAddress.toLowerCase(),
                type,
                status: TransactionStatus.PENDING,
                amount,
                chain_id: chainId,
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
}
