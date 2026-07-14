import axios from 'axios';

// Default relatif ('/api') supaya request selalu ditujukan ke host yang sama dengan halaman
// yang sedang dibuka (lalu diteruskan oleh proxy Vite ke backend) - ini penting agar akses dari
// PC lain di jaringan lokal tetap berfungsi (kalau di-hardcode ke 'localhost' akan merujuk ke
// mesin klien itu sendiri, bukan ke server).
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
