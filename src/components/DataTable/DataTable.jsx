import "./DataTable.css"

const DEFAULT_EMPTY_MESSAGE = "No hay datos para mostrar"

// Devuelve la clase CSS que alinea el texto de una celda
function getAlignClass(align) {
  if (align === "center") return "data-table__cell--center"
  if (align === "right") return "data-table__cell--right"
  return "data-table__cell--left"
}

// Devuelve la clase CSS de una fila: la resaltada lleva una clase extra
function getRowClass(row, rowKey, highlightedRowKey) {
  if (row[rowKey] === highlightedRowKey) {
    return "data-table__row data-table__row--highlighted"
  }
  return "data-table__row"
}

// Decide qué se muestra en una celda: lo que arme render, o el valor del campo
function getCellContent(column, row, index) {
  if (column.render) {
    return column.render(row, index)
  }
  return row[column.key]
}

function DataTable({
  columns,
  rows = [],
  rowKey,
  highlightedRowKey,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}) {
  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={getAlignClass(column.align)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="data-table__empty">
                {emptyMessage}
              </td>
            </tr>
          )}

          {rows.map((row, index) => (
            <tr key={row[rowKey]} className={getRowClass(row, rowKey, highlightedRowKey)}>
              {columns.map((column) => (
                <td key={column.key} className={getAlignClass(column.align)}>
                  {getCellContent(column, row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
