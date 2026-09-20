import { supabase } from '../lib/supabase';

export async function uploadProductImage(file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `products/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading image to Supabase storage:', uploadError);
      // Fallback object URL preview if storage bucket is offline in local dev mode
      return URL.createObjectURL(file);
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error('Upload exception:', err);
    return URL.createObjectURL(file);
  }
}

export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  try {
    if (!imageUrl || imageUrl.startsWith('blob:')) return true;
    const parts = imageUrl.split('/product-images/');
    if (parts.length < 2) return true;
    const filePath = parts[1];

    const { error } = await supabase.storage.from('product-images').remove([filePath]);
    if (error) {
      console.error('Error deleting image:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Delete image exception:', err);
    return false;
  }
}
