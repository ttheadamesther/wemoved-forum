import { supabase } from './supabase';

export async function uploadVoiceMessage(blob, conversationId, userId) {
  const ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : 'webm';
  const fileName = `${conversationId}/${userId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('voice-messages')
    .upload(fileName, blob, { contentType: blob.type, upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('voice-messages').getPublicUrl(fileName);
  return data.publicUrl;
}