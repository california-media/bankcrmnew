import { useEffect, useRef, useState } from 'react';
import { AutoComplete } from 'antd';
import api from '../api/client';

// Free-text company input with suggestions from the super-admin company list.
// Works as a controlled Form.Item child (value/onChange). If the lookup fails
// it simply behaves like a plain input.
export default function CompanyCombobox({ value, onChange, placeholder, size, style, ...rest }) {
  const [options, setOptions] = useState([]);
  const timer = useRef(null);
  const seq = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text) => {
    clearTimeout(timer.current);
    const q = (text || '').trim();
    timer.current = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await api.get('/companies', { params: { q, limit: 8 } });
        if (mine !== seq.current) return;
        setOptions((res.data?.items || []).slice(0, 8).map((c) => ({ value: c.name })));
      } catch {
        if (mine === seq.current) setOptions([]);
      }
    }, 250);
  };

  return (
    <AutoComplete
      value={value}
      onChange={onChange}
      onSearch={search}
      onFocus={() => search(value)}
      options={options}
      placeholder={placeholder}
      size={size}
      style={{ width: '100%', ...style }}
      {...rest}
    />
  );
}
