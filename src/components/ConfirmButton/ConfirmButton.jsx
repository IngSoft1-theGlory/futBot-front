import { useState } from "react";
import Button from "../Button/Button";
import "./ConfirmButton.css";

function ConfirmButton({
  label,                // Texto del botón
  confirmMessage,       // La texto de la pregunta
  onConfirm,            // Función a ejecutar
  variant,
  isLoading = false,
  disabled = false,
}) {
  // false: se ve el botón. true: se ve la pantalla de confirmación.
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = () => {
    // Si la acción falla, el usuario vuelve a ver el botón y puede reintentar.
    setIsConfirming(false);
    onConfirm();
  };

  if (!isConfirming) {
    return (
      <Button
        variant={variant}
        isLoading={isLoading}
        disabled={disabled}
        onClick={() => setIsConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="confirm-button">
      <p className="confirm-button__message">{confirmMessage}</p>
      <div className="confirm-button__actions">
        {/* Si el botón se deshabilita con la confirmación abierta, tampoco se puede confirmar */}
        <Button variant="primary" onClick={handleConfirm} disabled={disabled}>
          Confirmar
        </Button>
        <Button variant="danger" onClick={() => setIsConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default ConfirmButton;