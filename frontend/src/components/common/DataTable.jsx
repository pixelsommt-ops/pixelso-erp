export default function DataTable({ columns, rows, loading, error, emptyLabel = 'Belum ada data', onRowClick, rowKey = 'id' }) {
  if (loading) {
    return <div className="empty-state">Memuat data...</div>;
  }
  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }
  if (!rows || rows.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
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
