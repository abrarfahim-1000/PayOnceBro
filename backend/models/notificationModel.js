import supabase from '../config/db.js'

export const createAdminAlert = async (message, type = 'rider_rating_alert') => {
  const { data: admins, error: adminError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (adminError) throw adminError
  if (!admins || admins.length === 0) return []

  const payload = admins.map((admin) => ({
    user_id: admin.id,
    message,
    type,
    is_read: false,
  }))

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('*')

  if (error) throw error
  return data ?? []
}

