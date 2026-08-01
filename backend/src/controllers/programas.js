import { supabase } from '../config/supabase.js';

export async function listarProgramas(req, res) {
  const { data, error } = await supabase.from('programa').select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
