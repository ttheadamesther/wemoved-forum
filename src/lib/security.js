import { supabase } from './supabase'

export async function rpc(name, args = {}) {
  if (!supabase) throw new Error('Supabase non configuré.')
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data
}

export async function updateOwnProfile(patch) {
  return rpc('update_own_profile', { p_patch: patch })
}

export async function setOnlineStatus(online) {
  return rpc('set_online_status', { p_online: online })
}

export async function awardAction(action, refId = '') {
  return rpc('award_xp_for_action', { p_action: action, p_ref_id: String(refId || '') })
}

export async function toggleVote(targetId, voteType) {
  return rpc('toggle_vote', { p_target_id: targetId, p_vote_type: voteType })
}

export async function togglePhotoLike(targetId, photoIndex) {
  return rpc('toggle_photo_like', { p_target_id: targetId, p_photo_index: photoIndex })
}

export async function setMemberRole(targetId, role) {
  return rpc('set_member_role', { p_target_id: targetId, p_role: role })
}

export async function moderateMember(targetId, banned, bannedUntil = null, reason = '') {
  return rpc('moderate_member', {
    p_target_id: targetId,
    p_banned: banned,
    p_banned_until: bannedUntil,
    p_reason: reason || null,
  })
}

export async function acceptFriendship(friendshipId) {
  return rpc('accept_friendship', { p_friendship_id: friendshipId })
}

export async function deleteMyAccount() {
  return rpc('delete_my_account')
}
