import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import Ffmpeg from 'fluent-ffmpeg';
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

Ffmpeg.setFfmpegPath(ffmpegPath.path);

export interface UploadResult {
  url: string;
  key: string;
}

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly config: ConfigService) {
    this.region = this.config.getOrThrow<string>('AWS_REGION');
    this.bucket = this.config.getOrThrow<string>('AWS_S3_BUCKET');

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Convierte una imagen a WebP usando sharp.
   */
  private async convertImageToWebP(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate() // auto-rotate based on EXIF orientation
      .resize({
        width: 1080,
        height: 1080,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
  }

  /**
   * Convierte un video a H.264 + MP4 usando ffmpeg.
   */
  private async convertVideoToMp4(buffer: Buffer): Promise<Buffer> {
    const tmpDir = mkdtempSync(join(tmpdir(), 'ict-'));
    const inputPath = join(tmpDir, `input-${randomUUID()}`);
    const outputPath = join(tmpDir, `output-${randomUUID()}.mp4`);

    writeFileSync(inputPath, buffer);

    return new Promise<Buffer>((resolve, reject) => {
      Ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoFilter("scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2")
        .outputOptions([
          '-preset fast',
          '-crf 23',
          '-movflags +faststart',
          '-pix_fmt yuv420p',
        ])
        .format('mp4')
        .on('end', () => {
          try {
            const out = readFileSync(outputPath);
            // Cleanup temp files
            try { unlinkSync(inputPath); } catch {}
            try { unlinkSync(outputPath); } catch {}
            resolve(out);
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (err: any) => {
          try { unlinkSync(inputPath); } catch {}
          try { unlinkSync(outputPath); } catch {}
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Sube un archivo (imagen, video o gif) al bucket S3.
   * Imágenes se convierten a WebP, videos a H.264/MP4.
   *
   * @param file  Archivo recibido por multer (memoryStorage)
   * @param folder  Carpeta dentro del bucket (ej: "posts", "avatars")
   * @returns  URL pública y key del objeto
   */
  async upload(
    file: Express.Multer.File,
    folder = 'posts',
  ): Promise<UploadResult> {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const isAudio = file.mimetype.startsWith('audio/');

    let buffer = file.buffer;
    let ext: string;
    let contentType: string;

    if (isImage) {
      buffer = await this.convertImageToWebP(buffer);
      ext = '.webp';
      contentType = 'image/webp';
      this.logger.log(`Imagen convertida a WebP (${(buffer.length / 1024).toFixed(0)} KB)`);
    } else if (isVideo) {
      try {
        buffer = await this.convertVideoToMp4(buffer);
        ext = '.mp4';
        contentType = 'video/mp4';
        this.logger.log(`Video convertido a H.264/MP4 (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
      } catch (err) {
        this.logger.warn(`Conversión de video falló, subiendo original: ${err}`);
        ext = '.mp4';
        contentType = file.mimetype;
      }
    } else if (isAudio) {
      const audioExts: Record<string, string> = {
        'audio/webm': '.webm',
        'audio/ogg': '.ogg',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'audio/mp4': '.m4a',
        'audio/aac': '.aac',
        'audio/opus': '.opus',
      };
      ext = audioExts[file.mimetype] ?? '.webm';
      contentType = file.mimetype;
      this.logger.log(`Audio subido (${(buffer.length / 1024).toFixed(0)} KB)`);
    } else {
      ext = '.bin';
      contentType = file.mimetype;
    }

    const key = `${folder}/${randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    this.logger.log(`Archivo subido → ${url}`);
    return { url, key };
  }

  /**
   * Elimina un archivo del bucket S3 dado su key.
   */
  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
    this.logger.log(`Archivo eliminado → ${key}`);
  }
}
