import { Req, Res, Injectable, Logger } from "@nestjs/common";
import multer from "multer";
import * as AWS from "aws-sdk";
const s3Storage = require("multer-sharp-s3");
import { ConfigService } from '@nestjs/config';
import {
    failResponse,
    successResponse,
} from "../../common/util/response.handler";
import { BUCKET_TYPE } from "../../common/enums/bucket-type.enum";
import * as fs from "fs";

@Injectable()
export class FileService {
    private readonly logger = new Logger(FileService.name);
    private readonly s3: AWS.S3;
    private readonly bucketName: string;
    private readonly project: string;

    constructor(private configService: ConfigService) {
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
        const region = this.configService.get<string>('AWS_REGION') || 'ap-south-1';

        this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';
        this.project = this.configService.get<string>('PROJECT') || 'NFT_BID';

        AWS.config.update({
            accessKeyId,
            secretAccessKey,
            region,
        });

        this.s3 = new AWS.S3();
    }

    async fileUpload(@Req() req, @Res() res) {
        try {
            const upload = this.getMulterConfig();
            await upload(req, res, (error: any) => {
                if (error) {
                    return failResponse(
                        true,
                        `Failed to upload image file: ${error}`,
                        res
                    );
                }
                if (!req.files || req.files.length < 1) {
                    return failResponse(true, "Something went wrong, no file received", res);
                }

                const image = (req.files as any)[0].Location;
                return successResponse("File upload successfully", { image }, res);
            });
        } catch (error) {
            this.logger.error('fileUpload error:', error);
            return failResponse(true, `Failed to upload file: ${error}`, res);
        }
    }

    private getMulterConfig() {
        return multer({
            limits: { fileSize: 6291456 }, // 6MB
            storage: s3Storage({
                s3: this.s3,
                Bucket: this.bucketName,
                ContentEncoding: "base64",
                Key: (request, file, cb) => {
                    if (
                        !file.originalname.match(
                            /\.(JPG|jpg|jpeg|JPEG|png|PNG|WEBP|webp|csv|CSV)$/
                        )
                    ) {
                        return cb(new Error("Only Image and CSV files are allowed!"));
                    }
                    const originalname: string = file.originalname.substring(
                        file.originalname.lastIndexOf(".") + 1,
                        file.originalname.length
                    );

                    // Get folder name from BUCKET_TYPE based on request body type
                    const folderName = BUCKET_TYPE[request.body.type] || 'misc';

                    const randomName = Array(32)
                        .fill(null)
                        .map(() => Math.round(Math.random() * 16).toString(16))
                        .join("");

                    cb(
                        null,
                        `${folderName}/${Date.now().toString()}_${this.project}_${randomName}.${originalname}`
                    );
                },
            }),
        }).array("upload", 1);
    }

    async uploadUserCollectible(filePath: string, name: string, type: string = "image/png") {
        try {
            const bucket = type === "image/png" ? "user-collectibles" : "user-invoices";
            const ext = type === "image/png" ? "png" : "pdf";

            if (!fs.existsSync(filePath)) {
                this.logger.error("The file does not exist at path: " + filePath);
                return null;
            }

            const fileBuffer = fs.readFileSync(filePath);
            const params = {
                Bucket: `${this.bucketName}/${bucket}`,
                Key: `${name}.${ext}`,
                ACL: "public-read",
                ContentType: type,
                Body: fileBuffer,
            };

            const result = await this.s3.upload(params).promise();
            fs.unlinkSync(filePath);
            return result.Location;
        } catch (error) {
            this.logger.error("uploadUserCollectible error:", error);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return null;
        }
    }

    async uploadBase64Image(
        base64Data: string,
        name: string,
        bucket: string = "live-monitoring",
        folderPath?: string
    ) {
        try {
            const base64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64, "base64");

            const key = folderPath
                ? `${folderPath}/${name}_${Date.now()}.png`
                : `${name}_${Date.now()}.png`;

            const params = {
                Bucket: `${this.bucketName}/${bucket}`,
                Key: key,
                ACL: "public-read",
                ContentType: "image/png",
                Body: buffer,
            };

            const upload = await this.s3.upload(params).promise();
            return upload.Location;
        } catch (error) {
            this.logger.error("Error uploading base64 to S3:", error);
            return null;
        }
    }
}
