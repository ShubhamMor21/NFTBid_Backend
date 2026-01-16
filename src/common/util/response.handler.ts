import { Response } from 'express';

export const successResponse = (message: string, data: any, res: Response) => {
    return res.status(200).json({
        error: false,
        status: 200,
        timestamp: new Date().toISOString(),
        message,
        data,
    });
};

export const failResponse = (error: boolean, message: string, res: Response) => {
    return res.status(400).json({
        error,
        status: 400,
        timestamp: new Date().toISOString(),
        message,
        data: null,
    });
};
