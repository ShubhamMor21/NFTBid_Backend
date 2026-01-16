import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction } from '../../database/entities/transaction.entity';

@Global()
@Module({
    imports: [TypeOrmModule.forFeature([Transaction])],
    providers: [TransactionsService],
    exports: [TransactionsService],
})
export class TransactionsModule { }
