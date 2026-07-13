import { useCallback, useEffect, useState } from 'react';

// Hook generik untuk fetch data list/report dengan state loading/error + refetch manual.
// fetcher harus stabil (dibungkus useCallback di pemanggil) agar tidak infinite-loop.
export default function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetcher();
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}
