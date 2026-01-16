import { Module, Global } from '@nestjs/common';
import { AuctionsGateway } from './websocket.gateway';

@Global()
@Module({
    providers: [AuctionsGateway],
    exports: [AuctionsGateway],
})
export class WebsocketModule { }
