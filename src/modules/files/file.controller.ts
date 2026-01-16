import { Body, Controller, Post, Req, Res, Logger } from "@nestjs/common";
import { failResponse } from "../../common/util/response.handler";
import { FileService } from "./file.service";

@Controller("file")
export class FileController {
    private readonly logger = new Logger(FileController.name);

    constructor(private readonly fileService: FileService) { }

    @Post("/upload")
    async fileUpload(@Req() request, @Res() response) {
        try {
            this.logger.log("Initiating file upload to S3...");
            await this.fileService.fileUpload(request, response);
        } catch (error) {
            this.logger.error("File upload failed:", error);
            return failResponse(true, error.message, response);
        }
    }
}
