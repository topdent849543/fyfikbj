import crypto from 'crypto';
import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { asyncHandler, AppError, audit } from '../lib/http.js';
import { deleteOrphanMediaAssets, ensureMediaBucket, STORAGE_BUCKET } from '../lib/storage.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 10 } });
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function persistImage(file, ownerId) {
  if (!file?.buffer) throw new AppError(400, 'لم يتم رفع ملف', 'MISSING_FILE');
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !acceptedTypes.has(detected.mime)) throw new AppError(400, 'يُسمح بصور JPEG وPNG وWebP فقط', 'INVALID_IMAGE_TYPE');
  const transformed = await sharp(file.buffer, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const key = `users/${ownerId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.webp`;
  await ensureMediaBucket();
  const { error: uploadError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(key, transformed.data, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(key);
  const url = publicData.publicUrl;
  const { error: assetError } = await supabaseAdmin.from('media_assets').insert({
    owner_id: ownerId,
    bucket: STORAGE_BUCKET,
    storage_path: key,
    public_url: url,
    content_type: 'image/webp',
    byte_size: transformed.data.length,
    width: transformed.info.width || null,
    height: transformed.info.height || null
  });
  if (assetError) {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([key]);
    throw assetError;
  }
  return { url, contentType: 'image/webp', byteSize: transformed.data.length, width: transformed.info.width, height: transformed.info.height };
}

router.post('/image', verifyToken, upload.single('file'), asyncHandler(async (req, res) => {
  const file = await persistImage(req.file, req.user.id);
  await audit(req.user.id, 'media_uploaded', 'media_asset', file.url, { byteSize: file.byteSize });
  res.status(201).json({ message: 'تم رفع الصورة وحفظها بشكل دائم', file });
}));

router.post('/images', verifyToken, upload.array('files', 10), asyncHandler(async (req, res) => {
  if (!req.files?.length) throw new AppError(400, 'لم يتم رفع ملفات', 'MISSING_FILES');
  const files = [];
  for (const item of req.files) files.push(await persistImage(item, req.user.id));
  await audit(req.user.id, 'media_uploaded_batch', 'media_asset', null, { count: files.length });
  res.status(201).json({ message: 'تم رفع الصور وحفظها بشكل دائم', files });
}));

router.post('/cleanup-orphans', verifyToken, requireRole(['admin']), asyncHandler(async (req, res) => {
  const hours = Math.min(720, Math.max(1, Number(req.body?.olderThanHours || 24)));
  const deleted = await deleteOrphanMediaAssets(new Date(Date.now() - hours * 60 * 60 * 1000));
  await audit(req.user.id, 'orphan_media_cleaned', 'media_asset', null, { deleted, hours });
  res.json({ message: 'اكتمل تنظيف الصور غير المرتبطة', deleted });
}));

export default router;
