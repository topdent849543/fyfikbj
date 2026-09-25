import { supabaseAdmin } from '../config/supabase.js';

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'topdent-media';

export async function ensureMediaBucket() {
  const { data, error } = await supabaseAdmin.storage.getBucket(STORAGE_BUCKET);
  if (data) return data;
  if (error && !/not found|does not exist/i.test(error.message || '')) throw error;
  const { data: created, error: createError } = await supabaseAdmin.storage.createBucket(STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: '8388608',
    allowedMimeTypes: ['image/webp']
  });
  if (createError && !/already exists/i.test(createError.message || '')) throw createError;
  return created;
}

export async function markMediaAssetsAttached(urls) {
  if (!urls?.length) return;
  const { error } = await supabaseAdmin.from('media_assets').update({ attached_at: new Date().toISOString() }).in('public_url', urls);
  if (error) throw error;
}

export async function deleteMediaAssetsByUrls(urls, ownerId = null) {
  if (!urls?.length) return;
  let query = supabaseAdmin.from('media_assets').select('id, storage_path').in('public_url', urls);
  if (ownerId) query = query.eq('owner_id', ownerId);
  const { data: assets, error } = await query;
  if (error) throw error;
  if (!assets?.length) return;
  const { error: storageError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(assets.map((asset) => asset.storage_path));
  if (storageError) throw storageError;
  const { error: deleteError } = await supabaseAdmin.from('media_assets').delete().in('id', assets.map((asset) => asset.id));
  if (deleteError) throw deleteError;
}

export async function deleteOrphanMediaAssets(before) {
  const { data: assets, error } = await supabaseAdmin.from('media_assets').select('id, storage_path').is('attached_at', null).lt('created_at', before.toISOString());
  if (error) throw error;
  if (!assets?.length) return 0;
  const { error: storageError } = await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(assets.map((asset) => asset.storage_path));
  if (storageError) throw storageError;
  const { error: deleteError } = await supabaseAdmin.from('media_assets').delete().in('id', assets.map((asset) => asset.id));
  if (deleteError) throw deleteError;
  return assets.length;
}
