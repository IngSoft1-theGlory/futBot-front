import './FormField.css'

function FormField({ id, label, type = 'text', value, onChange, error, ...rest }) {
  const errorId = `${id}-error`

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        className={`form-field__input ${error ? 'form-field__input--error' : ''}`}
        {...rest}
      />
      <span id={errorId} className="form-field__error">
        {error || ''}
      </span>
    </div>
  )
}

export default FormField