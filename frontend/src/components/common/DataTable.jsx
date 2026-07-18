import { useMemo, useState } from 'react';

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'id', { numeric: true, sensitivity: 'base' });
}

export default function DataTable({ columns, rows, loading, error, emptyLabel = 'Belum ada data', onRowClick, rowKey = 'id' }) {
  const [sort, setSort] = useState({ key: null, direction: 'asc' });

  const sortedRows = useMemo(() => {
    if (!rows || !sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const getValue = col.sortValue || ((row) => row[col.key]);
    const sorted = [...rows].sort((a, b) => compareValues(getValue(a), getValue(b)));
    return sort.direction === 'asc' ? sorted : sorted.reverse();
  }, [rows, sort, columns]);

  if (loading) {
    return <div className="empty-state">Memuat data...</div>;
  }
  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }
  if (!rows || rows.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  const isSortable = (col) => col.sortable !== false && col.label !== '';

  const toggleSort = (col) => {
    if (!isSortable(col)) return;
    setSort((prev) => {
      if (prev.key !== col.key) return { key: col.key, direction: 'asc' };
      if (prev.direction === 'asc') return { key: col.key, direction: 'desc' };
      return { key: null, direction: 'asc' };
    });
  };

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => {
              const sortable = isSortable(col);
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  onClick={sortable ? () => toggleSort(col) : undefined}
                  className={sortable ? 'th-sortable' : undefined}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.label}
                  {sortable && (
                    <span className={`th-sort-icon ${active ? 'th-sort-icon-active' : ''}`}>
                      {active ? (sort.direction === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr
              key={row[rowKey]}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row, index) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
