import { useData } from '../context/DataContext.jsx';

export function useCsvLoader() {
  const { loadFromFile, csvMeta, status, error } = useData();
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadFromFile(file);
    e.target.value = '';
  };
  return { onFileChange, csvMeta, status, error };
}
