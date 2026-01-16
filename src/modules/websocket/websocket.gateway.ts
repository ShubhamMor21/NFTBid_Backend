import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class AuctionsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('AuctionsGateway');

    afterInit(server: Server) {
        this.logger.log('WebSocket Gateway Initialized');
    }

    handleConnection(client: Socket, ...args: any[]) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    /**
     * Broadcast a bid placement event.
     */
    emitBidPlaced(payload: any) {
        this.server.emit('bid_placed', payload);
    }

    /**
     * Broadcast an auction status change.
     */
    emitAuctionStatusChanged(event: string, payload: any) {
        this.server.emit(event, payload);
    }

    @SubscribeMessage('ping')
    handlePing(client: Socket, data: any): string {
        return 'pong';
    }
}
