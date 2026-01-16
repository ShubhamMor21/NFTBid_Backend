import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    error: boolean;
    status: number;
    timestamp: string;
    message: string;
    data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<Response<T>> {
        const response = context.switchToHttp().getResponse();
        const status = response.statusCode;

        return next.handle().pipe(
            map((result) => {
                let message = 'Request successful';
                let data = result;

                if (result && typeof result === 'object' && !Array.isArray(result)) {
                    if ('message' in result) {
                        message = result.message;
                        const { message: _, ...rest } = result;
                        data = Object.keys(rest).length > 0 ? rest : null;

                        // If the rest is just an object with a 'data' key, unwrap it
                        if (data && typeof data === 'object' && 'data' in data && Object.keys(data).length === 1) {
                            data = (data as any).data;
                        }
                    } else if ('data' in result && Object.keys(result).length === 1) {
                        // If it's just { data: ... }, unwrap it
                        data = result.data;
                    }
                }

                return {
                    error: false,
                    status: status,
                    timestamp: new Date().toISOString(),
                    message: message,
                    data: data,
                };
            }),
        );
    }
}
