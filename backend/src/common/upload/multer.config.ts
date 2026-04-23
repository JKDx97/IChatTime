import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';

const ALLOWED_MIME =
  /^(image\/(jpeg|png|webp|gif)|video\/(mp4|quicktime|webm)|audio\/(webm|ogg|mpeg|wav|mp4|aac|opus))$/;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const mediaMulterConfig = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (
    _req: any,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME.test(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Solo imágenes, videos o audio permitidos',
        ),
        false,
      );
    }
    cb(null, true);
  },
};
